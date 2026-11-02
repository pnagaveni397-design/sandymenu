"use client";
// Shared voice assistant used on BOTH the owner dashboard and the customer table page.
// Speech-to-text and text-to-speech come from the phone/browser (free). The "thinking" happens on our
// server (/api/voice/...), which is also where plan access and daily limits are checked.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Mic, X, Volume2, VolumeX, Send, Loader2, Check, Sparkles } from "lucide-react";

const LANGS = [
  { id: "kn", label: "ಕನ್ನಡ", tag: "kn-IN" },
  { id: "hi", label: "हिन्दी", tag: "hi-IN" },
  { id: "en", label: "English", tag: "en-IN" },
];

const T = {
  title: { en: "Voice assistant", hi: "वॉइस असिस्टेंट", kn: "ವಾಯ್ಸ್ ಅಸಿಸ್ಟೆಂಟ್" },
  placeholder: { en: "Or type here…", hi: "या यहाँ लिखें…", kn: "ಅಥವಾ ಇಲ್ಲಿ ಬರೆಯಿರಿ…" },
  listening: { en: "Listening…", hi: "सुन रहा हूँ…", kn: "ಕೇಳುತ್ತಿದ್ದೇನೆ…" },
  tapToSpeak: { en: "Tap the mic and speak", hi: "माइक दबाकर बोलिए", kn: "ಮೈಕ್ ಒತ್ತಿ ಮಾತನಾಡಿ" },
  yes: { en: "Yes", hi: "हाँ", kn: "ಹೌದು" },
  no: { en: "No", hi: "नहीं", kn: "ಬೇಡ" },
  noMic: {
    en: "Voice input isn't supported in this browser. You can still type, or use Chrome.",
    hi: "इस ब्राउज़र में वॉइस इनपुट नहीं चलता। आप लिख सकते हैं, या Chrome इस्तेमाल करें।",
    kn: "ಈ ಬ್ರೌಸರ್‌ನಲ್ಲಿ ವಾಯ್ಸ್ ಇಲ್ಲ. ನೀವು ಬರೆಯಬಹುದು ಅಥವಾ Chrome ಬಳಸಿ.",
  },
  blocked: {
    en: "Microphone is blocked. Allow it in the browser's site settings, or type instead.",
    hi: "माइक ब्लॉक है। ब्राउज़र की साइट सेटिंग में अनुमति दें, या लिखें।",
    kn: "ಮೈಕ್ ನಿರ್ಬಂಧಿತವಾಗಿದೆ. ಬ್ರೌಸರ್ ಸೆಟ್ಟಿಂಗ್‌ನಲ್ಲಿ ಅನುಮತಿಸಿ, ಅಥವಾ ಬರೆಯಿರಿ.",
  },
  sessionHint: { en: "Hands-free: keep talking. Say “finish” when you're done.", hi: "हैंड्स-फ़्री: बोलते रहिए। काम पूरा होने पर “बस” या “finish” बोलिए।", kn: "ಹ್ಯಾಂಡ್ಸ್-ಫ್ರೀ: ಮಾತನಾಡುತ್ತಿರಿ. ಮುಗಿದಾಗ “ಮುಗಿಯಿತು” ಅಥವಾ “finish” ಎನ್ನಿ." },
  ended: { en: "Okay, finished.", hi: "ठीक है, पूरा हुआ।", kn: "ಸರಿ, ಮುಗಿಯಿತು." },
  idle: { en: "Stopped listening after a quiet spell. Tap the mic to start again.", hi: "काफ़ी देर शांति रही, इसलिए सुनना बंद किया। फिर शुरू करने के लिए माइक दबाएँ।", kn: "ಬಹಳ ಹೊತ್ತು ಮೌನವಾಗಿದ್ದರಿಂದ ಕೇಳುವುದನ್ನು ನಿಲ್ಲಿಸಿದೆ. ಮತ್ತೆ ಶುರು ಮಾಡಲು ಮೈಕ್ ಒತ್ತಿ." },
  speak: { en: "Speak", hi: "बोलिए", kn: "ಮಾತನಾಡಿ" },
  netErr: { en: "Couldn't reach the server. Please try again.", hi: "सर्वर तक नहीं पहुँच सका। फिर कोशिश करें।", kn: "ಸರ್ವರ್ ತಲುಪಲಾಗಲಿಲ್ಲ. ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ." },
};

const YES = new Set(["yes", "yeah", "yep", "yup", "ok", "okay", "confirm", "sure", "haan", "han", "haa", "ji", "kar", "theek", "thik", "sahi", "houdu", "howdu", "sari", "aytu", "ಹೌದು", "ಸರಿ", "ಹೂಂ", "ಆಯ್ತು", "ಮಾಡಿ", "हाँ", "हां", "जी", "ठीक", "करो", "कर"]);
const NO = new Set(["no", "nope", "cancel", "stop", "nahi", "nahin", "nako", "beda", "illa", "ಬೇಡ", "ಇಲ್ಲ", "नहीं", "नही", "मत", "रुको", "रद्द"]);
function yesNo(text) {
  const tokens = String(text || "").toLowerCase().split(/[\s,.!?।]+/).filter(Boolean);
  if (!tokens.length || tokens.length > 5) return null;
  if (tokens.some((t) => NO.has(t))) return "no";
  if (tokens.some((t) => YES.has(t))) return "yes";
  return null;
}

const END_WORDS = new Set(["finish", "finished", "done", "stop", "bas", "khatam", "samapt", "ಮುಗಿಯಿತು", "ಮುಗೀತು", "ಮುಗಿದಿದೆ", "ನಿಲ್ಲಿಸಿ", "ಅಷ್ಟೇ", "बस", "खत्म", "समाप्त", "बंद"]);
const END_PHRASES = ["that's all", "thats all", "that is all", "ho gaya", "band karo", "ಅಷ್ಟೇ ಸಾಕು", "हो गया", "बंद करो"];
function isEnd(text) {
  const raw = String(text || "").toLowerCase().trim();
  const tokens = raw.split(/[\s,.!?।]+/).filter(Boolean);
  if (!tokens.length || tokens.length > 4) return false;
  return tokens.some((t) => END_WORDS.has(t)) || END_PHRASES.some((p) => raw.includes(p));
}
const IDLE_MS = 3 * 60 * 1000; // hands-free mode switches itself off after 3 quiet minutes

export default function VoiceAgent({ endpoint, extra, onResult, greeting, speakDefault = false, continuous = false, inline = false, pillPosition = "top-3 right-3", position = "top-16 right-3", accent = "bg-leaf" }) {
  const [open, setOpen] = useState(false);
  const [lang, setLang] = useState("en");
  const [speakOn, setSpeakOn] = useState(speakDefault);
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState([]); // {role, text}
  const [interim, setInterim] = useState("");
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(null); // { kind:'server'|'client', token?, lines, yes? }
  const [err, setErr] = useState("");
  const [session, setSession] = useState(false); // hands-free mode on
  const recRef = useRef(null);
  const sessionRef = useRef(false);
  const wakeRef = useRef(null);
  const lastHeardRef = useRef(0);
  const errCountRef = useRef(0);
  const startRecRef = useRef(null);
  const langRef = useRef("en");
  const sendRef = useRef(null);
  const scrollRef = useRef(null);
  langRef.current = lang;
  const tag = LANGS.find((l) => l.id === lang).tag;
  const t = (k) => T[k][lang];

  useEffect(() => {
    try {
      const saved = localStorage.getItem("ts_voice_lang");
      if (saved && LANGS.some((l) => l.id === saved)) setLang(saved);
      const sp = localStorage.getItem("ts_voice_speak");
      if (sp === "1" || sp === "0") setSpeakOn(sp === "1");
    } catch {}
    return () => { sessionRef.current = false; try { recRef.current?.abort(); window.speechSynthesis?.cancel(); wakeRef.current?.release(); } catch {} };
  }, []);
  useEffect(() => { scrollRef.current?.scrollTo({ top: 1e6, behavior: "smooth" }); }, [log, pending, busy, interim]);

  function chooseLang(id) {
    setLang(id);
    try { localStorage.setItem("ts_voice_lang", id); } catch {}
  }
  function toggleSpeak() {
    const v = !speakOn;
    setSpeakOn(v);
    if (!v) try { window.speechSynthesis?.cancel(); } catch {}
    try { localStorage.setItem("ts_voice_speak", v ? "1" : "0"); } catch {}
  }

  function speak(text) {
    return new Promise((resolve) => {
      if (!speakOn || !text || typeof window === "undefined" || !window.speechSynthesis) return resolve();
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = tag;
        const v = window.speechSynthesis.getVoices().find((x) => x.lang?.replace("_", "-").toLowerCase().startsWith(tag.slice(0, 2).toLowerCase()));
        if (v) u.voice = v; // if this phone has no voice for the language, the reply simply stays on screen
        u.onend = resolve;
        u.onerror = resolve;
        window.speechSynthesis.speak(u);
        setTimeout(resolve, 15000);
      } catch { resolve(); }
    });
  }

  async function startSession() {
    sessionRef.current = true;
    errCountRef.current = 0;
    lastHeardRef.current = Date.now();
    setSession(true);
    try { wakeRef.current = await navigator.wakeLock?.request("screen"); } catch {} // keep the screen awake while hands-free
    startRecRef.current?.();
  }
  function endSession(timedOut) {
    sessionRef.current = false;
    setSession(false);
    try { recRef.current?.abort(); } catch {}
    try { wakeRef.current?.release(); } catch {}
    wakeRef.current = null;
    setListening(false);
    setInterim("");
    if (timedOut) setLog((l) => [...l, { role: "assistant", text: T.idle[langRef.current] }]);
  }

  async function send(raw) {
    const text = String(raw || "").trim();
    if (!text || busy) return;
    setErr("");
    setInput("");
    setInterim("");
    const next = [...log, { role: "user", text }];
    setLog(next);

    // a spoken "yes" / "no" answers a waiting confirmation
    if (pending) {
      const yn = yesNo(text);
      if (yn) {
        const p = pending;
        setPending(null);
        return answerConfirm(p, yn === "yes", next);
      }
      setPending(null); // anything else = a new command; the old one is dropped
    }

    if (isEnd(text)) {
      const m = T.ended[lang];
      if (sessionRef.current) endSession();
      setLog([...next, { role: "assistant", text: m }]);
      await speak(m);
      return;
    }

    setBusy(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang, history: log.slice(-6), ...(extra ? extra() : {}) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok && !data.reply) {
        // the server answered but refused: keep its real reason (AI key missing, login expired, plan...)
        const err = new Error(data.error || "error");
        err.fromServer = !!data.error;
        throw err;
      }
      await handle(data, next);
    } catch (e) {
      // only a failed request (no answer at all) is "couldn't reach the server"
      setLog([...next, { role: "assistant", text: e.fromServer ? e.message : t("netErr") }]);
    } finally {
      setBusy(false);
    }
  }

  async function handle(data, base) {
    const reply = data.reply || "";
    setLog([...base, ...(reply ? [{ role: "assistant", text: reply }] : [])]);
    if (data.confirm) setPending({ kind: "server", token: data.confirm.token, lines: data.confirm.lines || [] });
    const r = onResult ? await onResult(data) : null;
    if (r && r.confirm) setPending({ kind: "client", lines: r.confirm.lines || [], yes: r.confirm.yes });
    await speak(reply);
  }

  async function answerConfirm(p, yes, base) {
    if (p.kind === "client") {
      if (yes) { p.yes?.(); } 
      const msg = yes ? { en: "Done.", hi: "हो गया।", kn: "ಮುಗಿದಿದೆ." }[lang] : { en: "Okay, not now.", hi: "ठीक है, अभी नहीं।", kn: "ಸರಿ, ಈಗ ಬೇಡ." }[lang];
      setLog([...base, { role: "assistant", text: msg }]);
      await speak(msg);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmToken: p.token, decision: yes ? "yes" : "no", lang }),
      });
      const data = await res.json().catch(() => ({}));
      await handle(data, base);
    } catch {
      setLog([...base, { role: "assistant", text: t("netErr") }]);
    } finally {
      setBusy(false);
    }
  }
  sendRef.current = send;

  function startRec() {
    if (recRef.current) return;
    const SR = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);
    if (!SR) { setErr(t("noMic")); if (sessionRef.current) endSession(); return; }
    setErr("");
    try { window.speechSynthesis?.cancel(); } catch {}
    const r = new SR();
    r.lang = LANGS.find((l) => l.id === langRef.current).tag;
    r.interimResults = true;
    r.maxAlternatives = 1;
    let heard = "";
    r.onresult = (e) => {
      let sTxt = "";
      for (let i = 0; i < e.results.length; i++) sTxt += e.results[i][0].transcript + " ";
      heard = sTxt.trim();
      setInterim(heard);
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") { setErr(t("blocked")); endSession(); }
      else if (e.error !== "no-speech" && e.error !== "aborted") errCountRef.current += 1;
    };
    r.onend = () => {
      setListening(false);
      recRef.current = null;
      if (heard) { lastHeardRef.current = Date.now(); errCountRef.current = 0; }
      // hands-free: after each command is done, quietly start listening again
      const again = () => {
        if (!sessionRef.current) return;
        if (errCountRef.current >= 3) { setErr(t("netErr")); endSession(); return; }
        if (Date.now() - lastHeardRef.current > IDLE_MS) { endSession(true); return; }
        setTimeout(() => { if (sessionRef.current && !recRef.current) startRecRef.current?.(); }, 300);
      };
      if (heard.length > 1) Promise.resolve(sendRef.current?.(heard)).finally(again);
      else { setInterim(""); again(); }
    };
    recRef.current = r;
    try { r.start(); setListening(true); } catch { recRef.current = null; setListening(false); }
  }
  startRecRef.current = startRec;

  function micClick() {
    if (continuous) {
      if (sessionRef.current) endSession();
      else startSession();
      return;
    }
    if (listening) { try { recRef.current?.stop(); } catch {} return; }
    startRec();
  }

  return (
    <>
      <button
        onClick={() => { if (open) { endSession(); try { window.speechSynthesis?.cancel(); } catch {} } setOpen(!open); }}
        aria-label={t("title")}
        aria-expanded={open}
        className={`${inline ? "relative" : `fixed ${pillPosition}`} z-[60] h-10 pl-3 pr-4 rounded-full text-white text-sm font-semibold shadow-lg inline-flex items-center gap-2 active:scale-95 transition ${listening || session ? "bg-chili animate-pulse" : accent}`}
      >
        <Mic size={18} />
        <span>{t("speak")}</span>
      </button>

      {/* the panel is rendered on <body> so the dashboard header's blur effect can't trap or clip it */}
      {open && typeof document !== "undefined" && createPortal(
        <div className={`fixed ${position} z-[60] w-[min(92vw,360px)] max-h-[72vh] flex flex-col rounded-3xl bg-paper border border-ink/10 shadow-2xl overflow-hidden`}>
          <div className="px-4 pt-3 pb-2 border-b border-ink/10 flex items-center gap-2">
            <Sparkles size={16} className="text-leaf" />
            <p className="font-semibold text-sm text-ink flex-1">{t("title")}</p>
            <button onClick={toggleSpeak} aria-label="Speak replies" className="p-1.5 rounded-full text-ink/60 hover:bg-ink/5">
              {speakOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>
            <button onClick={() => { endSession(); try { window.speechSynthesis?.cancel(); } catch {} setOpen(false); }} aria-label="Close" className="p-1.5 rounded-full text-ink/60 hover:bg-ink/5">
              <X size={16} />
            </button>
          </div>

          <div className="px-4 py-2 flex gap-1.5">
            {LANGS.map((l) => (
              <button key={l.id} onClick={() => chooseLang(l.id)} className={`px-3 py-1 rounded-full text-xs font-semibold border ${lang === l.id ? `${accent} text-white border-transparent` : "border-ink/15 text-ink/70"}`}>
                {l.label}
              </button>
            ))}
          </div>

          {continuous && session && <p className="px-4 pb-1 text-[11px] font-medium text-leaf">{t("sessionHint")}</p>}

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pb-2 space-y-2 min-h-[90px]">
            {log.length === 0 && !interim && <p className="text-sm text-ink/55 pt-1">{greeting?.[lang] || t("tapToSpeak")}</p>}
            {log.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <p className={`text-sm px-3 py-2 rounded-2xl max-w-[85%] ${m.role === "user" ? `${accent} text-white` : "bg-white border border-ink/10 text-ink"}`}>{m.text}</p>
              </div>
            ))}
            {interim && <div className="flex justify-end"><p className="text-sm px-3 py-2 rounded-2xl max-w-[85%] bg-ink/10 text-ink/70 italic">{interim}</p></div>}
            {busy && <div className="flex"><Loader2 size={16} className="animate-spin text-ink/40" /></div>}
            {pending && (
              <div className="rounded-2xl border border-leaf/30 bg-leaf-light/60 p-3">
                <ul className="text-xs text-ink/80 space-y-0.5 mb-2">
                  {pending.lines.map((ln, i) => <li key={i}>• {ln}</li>)}
                </ul>
                <div className="flex gap-2">
                  <button onClick={() => { const p = pending; setPending(null); setLog((l) => [...l, { role: "user", text: t("yes") }]); answerConfirm(p, true, [...log, { role: "user", text: t("yes") }]); }} className={`flex-1 ${accent} text-white text-sm font-semibold rounded-full py-2 flex items-center justify-center gap-1`}><Check size={15} />{t("yes")}</button>
                  <button onClick={() => { const p = pending; setPending(null); setLog((l) => [...l, { role: "user", text: t("no") }]); answerConfirm(p, false, [...log, { role: "user", text: t("no") }]); }} className="flex-1 border border-ink/20 text-ink text-sm font-semibold rounded-full py-2">{t("no")}</button>
                </div>
              </div>
            )}
            {err && <p className="text-xs text-chili">{err}</p>}
          </div>

          <div className="p-3 border-t border-ink/10 flex items-center gap-2">
            <button onClick={micClick} aria-label="Speak" className={`shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-white ${listening || session ? "bg-chili animate-pulse" : accent}`}>
              <Mic size={20} />
            </button>
            <input
              value={listening || session ? "" : input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") send(input); }}
              placeholder={listening || session ? t("listening") : t("placeholder")}
              className="flex-1 min-w-0 rounded-full border border-ink/15 bg-white px-3 py-2 text-sm outline-none"
            />
            <button onClick={() => send(input)} disabled={!input.trim() || busy} aria-label="Send" className="shrink-0 w-10 h-10 rounded-full border border-ink/15 flex items-center justify-center text-ink/70 disabled:opacity-40">
              <Send size={16} />
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
