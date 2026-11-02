import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { restaurantHasVoice, takeVoiceCredit, throttle, clientIp } from "@/lib/voiceAccess";
import { voiceConfigured, buildMessages, runTurn } from "@/lib/voiceLLM";
import { buildCustomerContext, customerSystemPrompt, CUSTOMER_TOOLS, resolveCustomerAction } from "@/lib/voiceCustomer";

export const dynamic = "force-dynamic";

const FAIL = {
  en: "Sorry, I didn't catch that. Could you try again?",
  hi: "माफ़ कीजिए, मैं समझ नहीं पाया। फिर से बोलिए?",
  kn: "ಕ್ಷಮಿಸಿ, ಅರ್ಥವಾಗಲಿಲ್ಲ. ಮತ್ತೆ ಹೇಳುತ್ತೀರಾ?",
};
const BUSY = {
  en: "The voice guide is resting for now. Please use the menu, or ask the staff.",
  hi: "वॉइस गाइड अभी उपलब्ध नहीं है। कृपया मेन्यू देखें या स्टाफ़ से पूछें।",
  kn: "ವಾಯ್ಸ್ ಗೈಡ್ ಈಗ ಲಭ್ಯವಿಲ್ಲ. ದಯವಿಟ್ಟು ಮೆನು ನೋಡಿ ಅಥವಾ ಸಿಬ್ಬಂದಿಯನ್ನು ಕೇಳಿ.",
};

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const lang = ["en", "hi", "kn"].includes(body.lang) ? body.lang : "en";

  const restaurant = db.prepare("SELECT * FROM restaurants WHERE id = ?").get(String(body.restaurantId || ""));
  const table = restaurant && db.prepare("SELECT * FROM tables WHERE id = ? AND restaurant_id = ? AND active = 1").get(String(body.tableId || ""), restaurant.id);
  if (!restaurant || !table) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (restaurant.status === "suspended" || !restaurantHasVoice(restaurant.id)) {
    return NextResponse.json({ error: "Voice is not available here." }, { status: 403 });
  }
  if (!voiceConfigured()) return NextResponse.json({ reply: BUSY[lang], actions: [] });

  const text = String(body.text || "").trim().slice(0, 300);
  if (!text) return NextResponse.json({ error: "Nothing heard." }, { status: 400 });

  // per-device throttle, then the restaurant's daily AI budget
  if (!throttle(`c:${clientIp(request)}:${restaurant.id}`, 10)) return NextResponse.json({ reply: BUSY[lang], actions: [] });
  if (!takeVoiceCredit(restaurant.id)) return NextResponse.json({ reply: BUSY[lang], actions: [] });

  const ctx = buildCustomerContext(restaurant, table, body.cart, body.orderNumber);
  let actions = [];
  try {
    const { reply } = await runTurn({
      system: customerSystemPrompt(restaurant, table, ctx),
      messages: buildMessages(body.history, text),
      tools: CUSTOMER_TOOLS,
      resolve: async (uses) => {
        const checked = uses.map((u) => ({ u, r: resolveCustomerAction(u.name, u.input || {}, ctx.map) }));
        actions = checked.filter((c) => c.r.ok).map((c) => c.r.action);
        return checked.map((c) => ({ id: c.u.id, ok: c.r.ok, content: c.r.ok ? "Done." : c.r.error }));
      },
    });
    return NextResponse.json({ reply: reply || FAIL[lang], actions });
  } catch (e) {
    console.error("[voice/customer]", e.message);
    return NextResponse.json({ reply: FAIL[lang], actions: [] });
  }
}
