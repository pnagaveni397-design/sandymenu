// Shared config for the animated table-guide mascot.
// Used by the customer view (plays it), the dashboard editor (edits it)
// and the table page (loads it). Plain module: safe on server and client.

export const MASCOT_POSES = [
  { key: "random", label: "🎲 Surprise me (random funny move)" },
  { key: "idle", label: "Standing" },
  { key: "wave", label: "Waving hello" },
  { key: "bye", label: "Waving bye" },
  { key: "point", label: "Pointing / suggesting" },
  { key: "think", label: "Thinking (hand on chin)" },
  { key: "yum", label: "Yum (happy sway)" },
  { key: "cheer", label: "Cheering & jumping" },
  { key: "dance", label: "Funny dance" },
  { key: "spin", label: "3D spin" },
  { key: "flip", label: "Backflip" },
  { key: "moonwalk", label: "Moonwalk" },
  { key: "robot", label: "Robot dance" },
  { key: "boing", label: "Boing! (bouncy squash)" },
  { key: "laughroll", label: "Rolling with laughter" },
  { key: "wobble", label: "Dizzy wobble" },
  { key: "shiver", label: "Shivering / scared" },
  { key: "faint", label: "Dramatic faint" },
];

// Moves used when a situation is set to "Surprise me".
export const FUNNY_POSES = ["dance", "spin", "flip", "moonwalk", "robot", "boing", "laughroll", "wobble", "cheer"];
export const FUNNY_EXPRESSIONS = ["laugh", "cool", "excited", "wink", "starstruck", "smirk", "love", "kiss", "dizzy"];

export const MASCOT_EXPRESSIONS = [
  { key: "random", label: "🎲 Surprise me" },
  { key: "happy", label: "Happy 😊" },
  { key: "excited", label: "Excited 🤩" },
  { key: "starstruck", label: "Star-struck 🌟" },
  { key: "laugh", label: "Laughing 😆" },
  { key: "wink", label: "Wink 😉" },
  { key: "love", label: "Heart eyes 😍" },
  { key: "kiss", label: "Kiss 😘" },
  { key: "yum", label: "Yummy 😋" },
  { key: "cool", label: "Cool (sunglasses) 😎" },
  { key: "smirk", label: "Smirk 😏" },
  { key: "surprised", label: "Surprised 😮" },
  { key: "thinking", label: "Thinking 🤔" },
  { key: "sad", label: "Sad / crying 🥺" },
  { key: "angry", label: "Angry 😠" },
  { key: "dizzy", label: "Dizzy 😵‍💫" },
  { key: "sleepy", label: "Sleepy 😴" },
];

export function resolveRandom(pose, expression) {
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  return {
    pose: pose === "random" ? pick(FUNNY_POSES) : pose,
    expression: expression === "random" ? pick(FUNNY_EXPRESSIONS) : expression,
  };
}

export const MASCOT_STYLES = [
  { key: "cap", label: "Cap boy" },
  { key: "chef", label: "Chef" },
  { key: "bun", label: "Girl (bun)" },
];

// Every moment of the customer's journey the mascot reacts to.
// `hint` is shown in the editor so owners know when it plays.
export const MASCOT_SITUATIONS = [
  { key: "welcome", group: "Scanning the table", title: "Greeting (QR just scanned)", hint: "Plays the moment the customer scans the table and the welcome page opens.", },
  { key: "welcomeIdle", group: "Scanning the table", title: "Waiting on welcome page", hint: "If the customer waits a few seconds without tapping, the mascot nudges them.", },
  { key: "menuEnter", group: "Browsing the menu", title: "Menu opened", hint: "When the customer taps in and the menu appears." },
  { key: "suggestion", group: "Browsing the menu", title: "Dish suggestion", hint: "Every few seconds it recommends a dish. Use {dish} and {price}.", },
  { key: "itemOpen", group: "Browsing the menu", title: "Customer opens a dish", hint: "When a dish detail card is opened. Use {dish}." },
  { key: "funnyDance", group: "Browsing the menu", title: "Funny dance (idle entertainment)", hint: "If the customer is idle for a while, it dances to entertain them." },
  { key: "joke", group: "Browsing the menu", title: "Tells a food joke", hint: "Now and then, instead of a suggestion, it tells a joke and cracks up laughing." },
  { key: "addToCart", group: "Ordering", title: "Dish added to cart", hint: "Use {dish}, {count}, {total}." },
  { key: "removeFromCart", group: "Ordering", title: "Dish removed from cart", hint: "When the customer removes something. Use {dish}." },
  { key: "cartOpen", group: "Ordering", title: "Cart opened", hint: "Use {count} and {total}." },
  { key: "orderPlaced", group: "After ordering", title: "Order placed", hint: "Celebration right after the customer places the order." },
  { key: "preparing", group: "After ordering", title: "Kitchen is cooking", hint: "When the kitchen marks the order as preparing." },
  { key: "served", group: "After ordering", title: "Food served", hint: "When the food reaches the table." },
  { key: "completed", group: "After ordering", title: "Goodbye", hint: "Order completed: mascot says bye and walks away." },
  { key: "tap", group: "Fun", title: "Customer taps the mascot", hint: "Funny reactions when the customer pokes the mascot." },
];

export const DEFAULT_MASCOT = {
  enabled: true,
  name: "Chotu",
  size: 0.7, // 0.4 – 1.5
  position: "right", // "left" | "right"
  bubbleTheme: "light", // "light" | "dark"
  bubbleTextSize: 13, // px, 11 – 18
  look: { style: "cap", skin: "#F2C9A0", shirt: "#8A8F98", hat: "#D8372E", pants: "#2B2F3A" },
  suggestionEverySeconds: 18,
  suggestFrom: "popular", // "popular" | "all"
  situations: {
    welcome: { enabled: true, pose: "wave", expression: "happy", messages: ["Hi! Welcome to {restaurant}! 👋 Tap to open the menu"] },
    welcomeIdle: { enabled: true, pose: "moonwalk", expression: "cool", messages: ["Psst… tap the button and let's eat! 🍽️", "Hungry? Tap to open the menu! 😋"] },
    menuEnter: { enabled: true, pose: "point", expression: "excited", messages: ["Great! Take a look around. I'll help you pick! 😄"] },
    suggestion: { enabled: true, pose: "point", expression: "yum", messages: ["Try our {dish}! Only {price} 😋", "Everyone loves the {dish}. Trust me! 🤤", "Can't decide? Go for {dish}! 🔥"] },
    itemOpen: { enabled: true, pose: "boing", expression: "love", messages: ["Ooh, {dish}! Great choice! 😍", "{dish}? You have taste! 👌"] },
    funnyDance: { enabled: true, pose: "random", expression: "random", messages: ["Dancing while you decide… 💃", "Take your time, I'll entertain you! 🕺", "Watch this move! 😎"] },
    joke: { enabled: true, pose: "laughroll", expression: "laugh", messages: ["Why did the chicken join a band? It had the drumsticks! 🥁", "I told my pizza a joke… it was too cheesy! 🍕", "What do you call cheese that isn't yours? Nacho cheese! 🧀", "Why was the tomato red? It saw the salad dressing! 🍅"] },
    addToCart: { enabled: true, pose: "dance", expression: "wink", messages: ["Yum! {dish} added! 🎉", "{dish} in the cart! Dance time! 🕺"] },
    removeFromCart: { enabled: true, pose: "faint", expression: "sad", messages: ["Aww, bye bye {dish}… 🥺", "Changed your mind? It's okay! 😅"] },
    cartOpen: { enabled: true, pose: "think", expression: "thinking", messages: ["{count} item(s), total {total}. Looks delicious! 🤔", "Anything else? Maybe a dessert? 🍰"] },
    orderPlaced: { enabled: true, pose: "flip", expression: "starstruck", messages: ["Order placed! The chef is on it! 🎉👨‍🍳"] },
    preparing: { enabled: true, pose: "yum", expression: "yum", messages: ["Smells amazing in the kitchen! 😋", "Your food is being cooked with love ❤️"] },
    served: { enabled: true, pose: "cheer", expression: "love", messages: ["Your food is here! Enjoy! 😍🍽️"] },
    completed: { enabled: true, pose: "bye", expression: "happy", messages: ["Thank you for dining with us! Bye bye! 👋 See you again! ❤️"] },
    tap: { enabled: true, pose: "random", expression: "random", messages: ["Hehe, that tickles! 😆", "Hey! I'm working here! 😜", "Boop! 🤭", "Whoa, you spun me round! 😵‍💫", "Again, again! 🎉"] },
  },
};

function clamp(n, lo, hi, fallback) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(hi, Math.max(lo, v));
}
function str(v, fallback, max = 200) {
  return typeof v === "string" ? v.slice(0, max) : fallback;
}
function color(v, fallback) {
  return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v : fallback;
}

// Takes whatever is stored (maybe nothing, maybe partial / old) and returns a
// complete, safe config. Anything the restaurant didn't customise falls back
// to the defaults, so new situations added later never break old saves.
export function mergeMascotConfig(raw) {
  let saved = raw;
  if (typeof raw === "string") {
    try { saved = raw ? JSON.parse(raw) : {}; } catch { saved = {}; }
  }
  if (!saved || typeof saved !== "object") saved = {};
  const d = DEFAULT_MASCOT;
  const poseKeys = MASCOT_POSES.map((p) => p.key);
  const exprKeys = MASCOT_EXPRESSIONS.map((e) => e.key);

  const situations = {};
  for (const s of MASCOT_SITUATIONS) {
    const def = d.situations[s.key];
    const sv = saved.situations?.[s.key] || {};
    const msgs = Array.isArray(sv.messages)
      ? sv.messages.map((m) => str(m, "", 160).trim()).filter(Boolean).slice(0, 8)
      : def.messages;
    situations[s.key] = {
      enabled: sv.enabled === undefined ? def.enabled : !!sv.enabled,
      pose: poseKeys.includes(sv.pose) ? sv.pose : def.pose,
      expression: exprKeys.includes(sv.expression) ? sv.expression : def.expression,
      messages: msgs.length ? msgs : def.messages,
    };
  }

  return {
    enabled: saved.enabled === undefined ? d.enabled : !!saved.enabled,
    name: str(saved.name, d.name, 24).trim() || d.name,
    size: clamp(saved.size, 0.4, 1.5, d.size),
    position: saved.position === "left" ? "left" : "right",
    bubbleTheme: saved.bubbleTheme === "dark" ? "dark" : "light",
    bubbleTextSize: clamp(saved.bubbleTextSize, 11, 18, d.bubbleTextSize),
    look: {
      style: MASCOT_STYLES.some((s) => s.key === saved.look?.style) ? saved.look.style : d.look.style,
      skin: color(saved.look?.skin, d.look.skin),
      shirt: color(saved.look?.shirt, d.look.shirt),
      hat: color(saved.look?.hat, d.look.hat),
      pants: color(saved.look?.pants, d.look.pants),
    },
    suggestionEverySeconds: clamp(saved.suggestionEverySeconds, 8, 120, d.suggestionEverySeconds),
    suggestFrom: saved.suggestFrom === "all" ? "all" : "popular",
    situations,
  };
}

// {restaurant}, {dish}, {price}, ... -> real values. Unknown tokens are kept
// out of the text instead of showing raw braces to customers.
export function fillTemplate(text, vars = {}) {
  return String(text || "")
    .replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : ""))
    .replace(/\s{2,}/g, " ")
    .trim();
}
