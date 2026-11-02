// One small wrapper around the AI used by both voice agents (owner + customer).
// Two providers are supported; the first key found is used:
//   GEMINI_API_KEY  -> Google Gemini (has a free tier, get it at aistudio.google.com/apikey)
//   AI_API_KEY      -> Anthropic Claude (paid, console.anthropic.com)
// GEMINI_MODEL / VOICE_AI_MODEL are optional.
const API_URL = "https://api.anthropic.com/v1/messages";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
// Tried in order. Gemini 2.5 models were shut down on 16 Oct 2026, so these are the 3.x Flash models.
const GEMINI_MODELS = ["gemini-3.5-flash", "gemini-3.1-flash-lite"];

const geminiKey = () => process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";

export function voiceConfigured() {
  return !!(geminiKey() || process.env.AI_API_KEY);
}

async function postAnthropic(body) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.AI_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model: process.env.VOICE_AI_MODEL || "claude-haiku-5-5", max_tokens: 700, ...body }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`AI request failed (${res.status}) ${t.slice(0, 200)}`);
  }
  return res.json();
}

// Turn the history the browser sends into valid alternating messages, ending with the new user line.
export function buildMessages(history, text) {
  const out = [];
  const push = (role, content) => {
    const c = String(content || "").slice(0, 600);
    if (!c) return;
    if (out.length && out[out.length - 1].role === role) out[out.length - 1].content += "\n" + c;
    else out.push({ role, content: c });
  };
  for (const h of Array.isArray(history) ? history.slice(-6) : []) {
    if (h && (h.role === "user" || h.role === "assistant")) push(h.role, h.text);
  }
  while (out.length && out[0].role !== "user") out.shift();
  push("user", text);
  return out;
}

// Runs one turn. `resolve(toolUses)` is called with the model's tool calls and must return
// [{ id, ok, content }] (content = what happened, in plain English). If anything failed, or the
// model gave no spoken text, we ask the model once more to word the final answer in the user's language.
async function runTurnAnthropic({ system, messages, tools, resolve }) {
  const first = await postAnthropic({ system, messages, tools });
  const text1 = (first.content || []).filter((b) => b.type === "text").map((b) => b.text).join(" ").trim();
  const uses = (first.content || []).filter((b) => b.type === "tool_use").slice(0, 8);
  if (!uses.length) return { reply: text1, uses: [], results: [] };

  const results = await resolve(uses);
  const anyBad = results.some((r) => !r.ok);
  if (text1 && !anyBad) return { reply: text1, uses, results };

  const second = await postAnthropic({
    system,
    tools,
    messages: [
      ...messages,
      { role: "assistant", content: first.content },
      {
        role: "user",
        content: uses.map((u) => {
          const r = results.find((x) => x.id === u.id) || { ok: false, content: "Not done." };
          return { type: "tool_result", tool_use_id: u.id, content: r.content, is_error: !r.ok };
        }),
      },
    ],
  });
  const text2 = (second.content || []).filter((b) => b.type === "text").map((b) => b.text).join(" ").trim();
  return { reply: text2 || text1, uses, results };
}

// ---------------- Google Gemini ----------------
let workingModel = null; // remembered once a model name has answered

async function postGemini(body) {
  const list = [...new Set([workingModel, process.env.GEMINI_MODEL || process.env.VOICE_AI_MODEL, ...GEMINI_MODELS].filter((m) => m && m.startsWith("gemini")))];
  let lastErr = null;
  for (const model of list) {
    const res = await fetch(`${GEMINI_BASE}/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": geminiKey() },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25000),
    });
    if (res.ok) { workingModel = model; return res.json(); }
    const t = await res.text().catch(() => "");
    lastErr = new Error(`AI request failed (${res.status}, ${model}) ${t.slice(0, 300)}`);
    if (res.status !== 404) throw lastErr; // only a missing / retired model name moves on to the next one
  }
  throw lastErr || new Error("No Gemini model available");
}

// Our tools are written in Anthropic's shape; Gemini wants functionDeclarations.
function geminiTools(tools) {
  return [{
    functionDeclarations: tools.map((t) => {
      const hasProps = t.input_schema && t.input_schema.properties && Object.keys(t.input_schema.properties).length > 0;
      return { name: t.name, description: t.description, ...(hasProps ? { parameters: t.input_schema } : {}) };
    }),
  }];
}

const toGeminiContents = (messages) =>
  messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: String(m.content || "") }] }));

function geminiParts(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const text = parts.filter((p) => typeof p.text === "string" && !p.thought).map((p) => p.text).join(" ").trim();
  const uses = parts
    .filter((p) => p.functionCall)
    .slice(0, 8)
    .map((p, i) => ({ id: p.functionCall.id || `call_${i}`, name: p.functionCall.name, input: p.functionCall.args || {}, rawId: p.functionCall.id }));
  return { parts, text, uses };
}

async function runTurnGemini({ system, messages, tools, resolve }) {
  const base = {
    systemInstruction: { parts: [{ text: system }] },
    tools: geminiTools(tools),
    toolConfig: { functionCallingConfig: { mode: "AUTO" } },
    generationConfig: { maxOutputTokens: 2048, temperature: 0.2 },
  };
  const contents = toGeminiContents(messages);
  const first = geminiParts(await postGemini({ ...base, contents }));
  if (!first.uses.length) return { reply: first.text, uses: [], results: [] };

  const results = await resolve(first.uses);
  const anyBad = results.some((r) => !r.ok);
  if (first.text && !anyBad) return { reply: first.text, uses: first.uses, results };

  // send the model's own turn back untouched (Gemini 3 needs its thought signatures), plus what happened
  const second = geminiParts(await postGemini({
    ...base,
    contents: [
      ...contents,
      { role: "model", parts: first.parts },
      {
        role: "user",
        parts: first.uses.map((u) => {
          const r = results.find((x) => x.id === u.id) || { ok: false, content: "Not done." };
          return { functionResponse: { ...(u.rawId ? { id: u.rawId } : {}), name: u.name, response: r.ok ? { result: r.content } : { error: r.content } } };
        }),
      },
    ],
  }));
  return { reply: second.text || first.text, uses: first.uses, results };
}

// ---------------- entry point used by the routes ----------------
export async function runTurn(args) {
  return geminiKey() ? runTurnGemini(args) : runTurnAnthropic(args);
}
