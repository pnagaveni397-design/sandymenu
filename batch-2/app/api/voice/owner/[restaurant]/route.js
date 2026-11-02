import { NextResponse } from "next/server";
import crypto from "crypto";
import { authRestaurant } from "@/lib/posAuth";
import { restaurantHasVoice, takeVoiceCredit, throttle } from "@/lib/voiceAccess";
import { voiceConfigured, buildMessages, runTurn } from "@/lib/voiceLLM";
import { buildOwnerContext, ownerSystemPrompt, OWNER_TOOLS, resolveOwnerAction, executeOwnerAction, ownerSnapshot } from "@/lib/voiceOwner";

export const dynamic = "force-dynamic";

// Actions waiting for a spoken/tapped "yes" (deletes and price changes). Kept in memory for 2 minutes,
// tied to the logged-in user and restaurant, so nothing can be confirmed by anyone else.
const pending = new Map();
function sweep() {
  const now = Date.now();
  for (const [k, v] of pending) if (v.expires < now) pending.delete(k);
}

const DONE = { en: "Done.", hi: "हो गया।", kn: "ಮುಗಿದಿದೆ." };
const CANCELLED = { en: "Okay, cancelled.", hi: "ठीक है, रद्द कर दिया।", kn: "ಸರಿ, ರದ್ದುಗೊಳಿಸಲಾಗಿದೆ." };
const LIMIT = {
  en: "The voice agent has reached today's limit. It will work again tomorrow.",
  hi: "आज की वॉइस सीमा पूरी हो गई है। कल फिर काम करेगा।",
  kn: "ಇಂದಿನ ವಾಯ್ಸ್ ಮಿತಿ ತಲುಪಿದೆ. ನಾಳೆ ಮತ್ತೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ.",
};
const FAIL = {
  en: "Sorry, something went wrong. Please try again.",
  hi: "माफ़ कीजिए, कुछ गड़बड़ हो गई। फिर से कोशिश करें।",
  kn: "ಕ್ಷಮಿಸಿ, ಏನೋ ತೊಂದರೆಯಾಯಿತು. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ.",
};

function runActions(actions, restaurant) {
  const notes = [];
  const changed = [];
  for (const a of actions) {
    try {
      const r = executeOwnerAction(a, restaurant);
      notes.push(r.note);
      changed.push(...r.changed);
    } catch (e) {
      notes.push("Could not complete one action.");
    }
  }
  return { notes, refresh: ownerSnapshot(restaurant.id, changed) };
}

export async function POST(request, { params }) {
  const { restaurant: slug } = await params;
  const auth = await authRestaurant(slug);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { restaurant, user } = auth;

  if (!restaurantHasVoice(restaurant.id)) {
    return NextResponse.json({ error: "The voice agent is part of the Pro plan." }, { status: 403 });
  }
  if (!voiceConfigured()) {
    return NextResponse.json({ error: "The voice agent isn't switched on yet: no AI key is set on the server (GEMINI_API_KEY or AI_API_KEY)." }, { status: 503 });
  }

  const body = await request.json().catch(() => ({}));
  const lang = ["en", "hi", "kn"].includes(body.lang) ? body.lang : "en";
  sweep();

  // 1) a yes / no for something we asked to confirm
  if (body.confirmToken) {
    const p = pending.get(body.confirmToken);
    pending.delete(body.confirmToken);
    if (!p || p.userId !== user.id || p.restaurantId !== restaurant.id || p.expires < Date.now()) {
      return NextResponse.json({ reply: FAIL[lang], actions: [] });
    }
    if (body.decision !== "yes") return NextResponse.json({ reply: CANCELLED[lang], actions: [] });
    const { notes, refresh } = runActions(p.actions, restaurant);
    return NextResponse.json({ reply: DONE[lang], notes, refresh });
  }

  // 2) a new spoken / typed command
  const text = String(body.text || "").trim().slice(0, 400);
  if (!text) return NextResponse.json({ error: "Nothing heard." }, { status: 400 });
  if (!throttle(`o:${user.id}`, 20)) return NextResponse.json({ reply: FAIL[lang] });
  if (!takeVoiceCredit(restaurant.id)) return NextResponse.json({ reply: LIMIT[lang] });

  const ctx = buildOwnerContext(restaurant);
  let proposed = []; // resolved, checked actions from this turn

  try {
    const { reply, results } = await runTurn({
      system: ownerSystemPrompt(restaurant, ctx),
      messages: buildMessages(body.history, text),
      tools: OWNER_TOOLS,
      resolve: async (uses) => {
        const checked = uses.map((u) => ({ u, r: resolveOwnerAction(u.name, u.input || {}, ctx.map, restaurant) }));
        const hasBad = checked.some((c) => !c.r.ok);
        if (!hasBad) proposed = checked.map((c) => ({ ...c.r }));
        return checked.map((c) => ({
          id: c.u.id,
          ok: c.r.ok && !hasBad,
          content: !c.r.ok ? c.r.error : hasBad ? "Not done because another action in the same request had a problem." : c.r.risky ? "Waiting for the owner to confirm." : "Done.",
        }));
      },
    });

    if (!proposed.length) return NextResponse.json({ reply: reply || FAIL[lang], actions: [] });

    // anything risky (delete, price change) holds the WHOLE turn until the owner confirms
    if (proposed.some((p) => p.risky)) {
      const token = crypto.randomUUID();
      pending.set(token, { userId: user.id, restaurantId: restaurant.id, actions: proposed.map((p) => p.action), expires: Date.now() + 120000 });
      return NextResponse.json({ reply: reply || FAIL[lang], confirm: { token, lines: proposed.map((p) => p.summary) } });
    }

    const { notes, refresh } = runActions(proposed.map((p) => p.action), restaurant);
    return NextResponse.json({ reply: reply || DONE[lang], notes, refresh });
  } catch (e) {
    console.error("[voice/owner]", e.message);
    return NextResponse.json({ reply: FAIL[lang] }, { status: 200 });
  }
}
