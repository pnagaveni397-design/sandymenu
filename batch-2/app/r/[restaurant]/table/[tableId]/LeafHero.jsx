"use client";

// The customer-view hero, rebuilt to follow the reference recording's motion:
//
//   * a floating pill nav (brand on the left, "CART (n)" on the right)
//   * a dish card: "DISH 01 / 11", a tag chip, the name, a short description,
//     the price, a green "+ Serve on Leaf" button and a thin autoplay bar
//   * the featured dish floats beside it; when it changes the old photo slides
//     out, the new one slides in, the card text blurs in, and the whole
//     background drifts to a new soft tint
//   * "Serve on Leaf": the dish photo flies in an arc onto a banana leaf,
//     lands with a pop, a dark "Added ... to your plate" toast slides out next
//     to the leaf, the cart count bumps and the next dish takes the stage
//   * under the leaf: "Clear" and a "N dishes · ₹X" pill that opens the cart
//
// Everything here is driven by the restaurant's real menu and the same cart the
// rest of the app uses -- the leaf simply IS the cart, drawn as a plate.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Leaf, MapPin, UtensilsCrossed } from "lucide-react";
import Monogram from "@/components/Monogram";

const TINTS = ["#F9F4EA", "#F1F3E2", "#E8F1E2", "#F6EFDB"];
const AUTOPLAY_MS = 5200;
const FLIGHT_MS = 760;
const TOAST_MS = 2300;

// Where each dish rests on the leaf (percent of the leaf box, centre point).
const SLOTS = [
  { x: 18, y: 58, r: -8 },
  { x: 38, y: 64, r: 10 },
  { x: 58, y: 62, r: 4 },
  { x: 79, y: 52, r: -12 },
  { x: 28, y: 40, r: 12 },
  { x: 48, y: 42, r: -6 },
  { x: 68, y: 38, r: 8 },
  { x: 88, y: 46, r: -4 },
];
const DISH_ON_LEAF = 0.21; // dish diameter as a fraction of the leaf's width

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);
  return reduced;
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function Plate({ src, alt, className = "", imgClassName = "" }) {
  return src ? (
    <img src={src} alt={alt || ""} draggable={false} className={`w-full h-full object-cover rounded-full ${imgClassName}`} />
  ) : (
    <div className={`w-full h-full rounded-full bg-leaf/10 flex items-center justify-center ${className}`}>
      <UtensilsCrossed size={28} strokeWidth={1.5} className="text-leaf/50" />
    </div>
  );
}

function VegMark({ veg }) {
  return (
    <span
      className={`inline-flex flex-shrink-0 w-3.5 h-3.5 border-[1.5px] rounded-[3px] items-center justify-center ${veg ? "border-leaf" : "border-chili"}`}
      title={veg ? "Vegetarian" : "Non-vegetarian"}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${veg ? "bg-leaf" : "bg-chili"}`} />
    </span>
  );
}

// The banana leaf, drawn in SVG: a tapering blade with a midrib and side veins.
function BananaLeaf() {
  const veins = [];
  for (let x = 26; x <= 268; x += 11) {
    const t = (x - 8) / 284;
    const mid = 70 - 32 * t;
    const spread = Math.sin(Math.PI * Math.min(Math.max(t, 0.04), 0.98)) * 30;
    veins.push(
      <path key={`u${x}`} d={`M${x} ${mid} Q${x + 8} ${mid - spread * 0.55} ${x + 22} ${mid - spread}`} />,
      <path key={`d${x}`} d={`M${x} ${mid} Q${x + 8} ${mid + spread * 0.55} ${x + 22} ${mid + spread}`} />
    );
  }
  return (
    <svg viewBox="0 0 300 130" className="absolute inset-0 w-full h-full overflow-visible" style={{ filter: "drop-shadow(0 10px 10px rgba(30,60,10,.28))" }} aria-hidden="true">
      <defs>
        <linearGradient id="lh-leaf" x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0" stopColor="#8BCB3E" />
          <stop offset="0.45" stopColor="#3E9A1C" />
          <stop offset="1" stopColor="#1B6A14" />
        </linearGradient>
      </defs>
      <path d="M6 72 C 34 22, 150 2, 294 36 C 276 96, 160 126, 6 72 Z" fill="url(#lh-leaf)" />
      <g stroke="#CFEFA0" strokeWidth="0.9" strokeLinecap="round" fill="none" opacity="0.38">{veins}</g>
      <path d="M8 71 C 100 62, 200 48, 292 37" stroke="#D9F3AE" strokeWidth="2.2" strokeLinecap="round" fill="none" opacity="0.7" />
      <path d="M20 66 C 80 36, 170 18, 270 36" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.18" />
    </svg>
  );
}

// One dish photo travelling from the stage to its spot on the leaf.
function Flyer({ flyer, onLanded }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { from, to } = flyer;
    const dx = to.cx - (from.left + from.width / 2);
    const dy = to.cy - (from.top + from.height / 2);
    const s = to.size / from.width;
    const lift = Math.max(70, Math.min(140, Math.abs(dy) * 0.35));
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      onLanded(flyer);
    };
    if (!el.animate) {
      finish();
      return;
    }
    const anim = el.animate(
      [
        { transform: "translate(0px,0px) scale(1) rotate(0deg)", opacity: 1, offset: 0 },
        { transform: `translate(${dx * 0.5}px,${dy * 0.5 - lift}px) scale(${(1 + s) / 2 + 0.12}) rotate(150deg)`, opacity: 1, offset: 0.5 },
        { transform: `translate(${dx}px,${dy}px) scale(${s}) rotate(${to.rot + 300}deg)`, opacity: 1, offset: 1 },
      ],
      { duration: FLIGHT_MS, easing: "cubic-bezier(0.45, 0.05, 0.35, 1)", fill: "forwards" }
    );
    anim.onfinish = finish;
    return () => {
      anim.onfinish = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const { from } = flyer;
  return (
    <div
      ref={ref}
      className="fixed z-[60] pointer-events-none rounded-full overflow-hidden ring-4 ring-white/80 shadow-2xl"
      style={{ left: from.left, top: from.top, width: from.width, height: from.height, willChange: "transform" }}
    >
      <Plate src={flyer.src} alt="" />
    </div>
  );
}

export default function LeafHero({
  restaurant, table, categories = [], items, currency, money,
  cart, cartCount, cartTotal,
  onAdd, onClear, onOpenCart, onOpenItem,
}) {
  const reduced = useReducedMotion();

  // Only dishes the owner switched "Show on the Leaf" on for appear here (first 10, in menu order).
  // Switch it off and the dish stays in the normal menu list only.
  const picks = useMemo(() => items.filter((it) => it.is_recommended).slice(0, 10), [items]);

  const [index, setIndex] = useState(0);
  const [leaving, setLeaving] = useState(null); // { item, key } photo sliding out
  const [swap, setSwap] = useState(0);
  const [toast, setToast] = useState(null); // { id, text, out }
  const [flyers, setFlyers] = useState([]);
  const [bump, setBump] = useState(0);

  const stageImgRef = useRef(null);
  const leafRef = useRef(null);
  const flyId = useRef(0);
  const pendingNew = useRef(0);
  const touchX = useRef(null);
  const timers = useRef([]);
  const indexRef = useRef(0);
  indexRef.current = index;

  const later = useCallback((fn, ms) => {
    const t = setTimeout(fn, ms);
    timers.current.push(t);
    return t;
  }, []);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  useEffect(() => {
    setIndex(0);
    setLeaving(null);
  }, [picks.length]);

  const goTo = useCallback(
    (next) => {
      if (picks.length < 2) return;
      const cur = indexRef.current;
      const target = ((next % picks.length) + picks.length) % picks.length;
      if (target === cur) return;
      setLeaving({ item: picks[cur], key: Date.now() });
      setIndex(target);
      setSwap((n) => n + 1);
      later(() => setLeaving(null), 600);
    },
    [picks, later]
  );

  const safeIndex = picks.length ? Math.min(index, picks.length - 1) : 0;
  const item = picks[safeIndex] || null;
  const price = item ? item.discounted_price || item.price : 0;
  const hasDiscount = !!item && item.discounted_price && item.discounted_price < item.price;
  const categoryName = item ? categories.find((c) => c.id === item.category_id)?.name || "" : "";
  const tint = TINTS[safeIndex % TINTS.length];

  function serve() {
    if (!item) return;
    const src = stageImgRef.current?.getBoundingClientRect();
    const leafRect = leafRef.current?.getBoundingClientRect();
    const existing = cart.findIndex((c) => c.itemId === item.id && !c.note);
    const slotIndex = existing >= 0 ? existing : cart.length + pendingNew.current;
    if (existing < 0) pendingNew.current += 1;
    const slot = SLOTS[slotIndex % SLOTS.length];

    if (reduced || !src || !leafRect || !src.width) {
      land({ item, isNew: existing < 0 });
      return;
    }
    const size = leafRect.width * DISH_ON_LEAF;
    const flyer = {
      id: ++flyId.current,
      item,
      isNew: existing < 0,
      src: item.image_url,
      from: { left: src.left, top: src.top, width: src.width, height: src.height },
      to: {
        cx: leafRect.left + (slot.x / 100) * leafRect.width,
        cy: leafRect.top + (slot.y / 100) * leafRect.height,
        size,
        rot: slot.r,
      },
    };
    setFlyers((f) => [...f, flyer]);
  }

  function land({ item: dish, isNew }) {
    if (isNew) pendingNew.current = Math.max(0, pendingNew.current - 1);
    onAdd(dish);
    setBump((n) => n + 1);
    const id = Date.now() + Math.random();
    setToast({ id, text: `Added ${dish.name} to your plate`, out: false });
    later(() => setToast((t) => (t && t.id === id ? { ...t, out: true } : t)), TOAST_MS);
    later(() => setToast((t) => (t && t.id === id ? null : t)), TOAST_MS + 350);
    // the next dish takes the stage, like the reference
    if (picks.length > 1) later(() => goTo(indexRef.current + 1), reduced ? 0 : 1000);
  }

  function onFlyerLanded(flyer) {
    setFlyers((f) => f.filter((x) => x.id !== flyer.id));
    land(flyer);
  }

  const dishes = cart.length;

  return (
    <section
      className="relative overflow-hidden pt-3 pb-6 px-3 rounded-b-[40px] font-quick transition-colors duration-[900ms] ease-in-out"
      style={{ backgroundColor: `${tint}99` }}
    >
      {/* soft light behind the dish */}
      <div className="pointer-events-none absolute -right-20 top-10 w-80 h-80 rounded-full bg-white/50 blur-3xl" />

      {/* floating pill nav */}
      <nav className="relative z-10 mx-auto max-w-5xl flex items-center gap-2 bg-white/55 backdrop-blur-xl rounded-full pl-2 pr-1.5 py-1.5 shadow-[0_8px_30px_rgba(58,74,38,0.12)] border border-white/80 animate-nav-drop">
        {restaurant.logo_image_url ? (
          <img src={restaurant.logo_image_url} alt="" className="w-9 h-9 rounded-full object-cover ring-2 ring-leaf/15 flex-shrink-0" />
        ) : (
          <Monogram name={restaurant.name} size="sm" className="w-9 h-9 rounded-full flex-shrink-0" />
        )}
        <div className="min-w-0 leading-tight">
          <p className="font-script font-semibold text-leaf-dark text-[15px] truncate">{restaurant.name}</p>
          <p className="text-[10px] tracking-[0.14em] uppercase text-ink/45">Table {table.table_number}</p>
        </div>
        <div className="ml-auto flex items-center gap-1 flex-shrink-0">
          <a href="#menu-list" className="hidden min-[420px]:inline text-[10px] font-semibold tracking-[0.16em] uppercase text-ink/55 hover:text-leaf px-2.5 py-2">
            Menu
          </a>
          <button
            key={`nav-cart-${bump}`}
            onClick={onOpenCart}
            className={`bg-leaf hover:bg-leaf-dark text-white text-[11px] font-bold tracking-[0.12em] uppercase rounded-full px-4 py-2.5 transition-colors ${bump ? "animate-bump" : ""}`}
          >
            Cart ({cartCount})
          </button>
        </div>
      </nav>

      {restaurant.tagline ? (
        <p className="relative z-10 mx-auto max-w-5xl text-center text-[11px] tracking-wide text-ink/50 mt-3 animate-card-rise whitespace-pre-line">{restaurant.tagline}</p>
      ) : null}

      {item ? (
        <>
      {/* dish card + floating dish */}
      <div className="relative z-10 mx-auto max-w-5xl mt-4 grid grid-cols-1 min-[480px]:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)] gap-3 items-center">
        <div className="order-2 min-[480px]:order-1 relative z-10 bg-white/60 backdrop-blur-xl rounded-3xl shadow-[0_14px_40px_rgba(58,74,38,0.14)] border border-white/80 p-4 animate-card-rise">
          <div className="flex items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-[9px] font-bold tracking-[0.2em] uppercase text-turmeric">
              Dish {pad(safeIndex + 1)} / {pad(picks.length)}
              <VegMark veg={item.is_veg} />
            </p>
            {categoryName ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-ink/60 bg-white border border-ink/10 rounded-full px-2 py-0.5 max-w-[45%]">
                <MapPin size={9} className="text-leaf flex-shrink-0" />
                <span className="truncate">{categoryName}</span>
              </span>
            ) : null}
          </div>

          <div key={`txt-${swap}`} className="animate-text-in">
            <h2 className="font-script text-[26px] leading-[1.1] font-medium text-ink mt-2.5">{item.name}</h2>
            <p className="text-[12px] text-ink/60 mt-1.5 line-clamp-2 min-h-[2.4em]">{item.description}</p>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <div key={`price-${swap}`} className="animate-text-in flex items-baseline gap-1.5">
              <span className="text-xl font-bold text-ink">{money(price, currency)}</span>
              {hasDiscount ? <span className="text-xs text-clay line-through">{money(item.price, currency)}</span> : null}
            </div>
            <button
              onClick={serve}
              className="bg-leaf hover:bg-leaf-dark text-white text-[12px] font-semibold rounded-full px-4 py-2.5 shadow-md shadow-leaf/25 transition-all active:scale-95 hover:-translate-y-0.5 whitespace-nowrap"
            >
              + Serve on Leaf
            </button>
          </div>

          {picks.length > 1 && !reduced ? (
            <div className="mt-3 h-[3px] rounded-full bg-ink/10 overflow-hidden">
              <div
                key={`bar-${swap}`}
                className="lh-bar h-full w-full rounded-full"
                style={{ "--lh-dur": `${AUTOPLAY_MS}ms`, background: "linear-gradient(90deg, #D9A441, #14641E)" }}
                onAnimationEnd={() => goTo(indexRef.current + 1)}
              />
            </div>
          ) : (
            <div className="mt-3 h-[3px]" />
          )}
        </div>

        <div
          className="order-1 min-[480px]:order-2 relative mx-auto w-full max-w-[215px] min-[480px]:max-w-[290px] aspect-square select-none -mb-5 min-[480px]:mb-0"
          onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => {
            if (touchX.current == null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            touchX.current = null;
            if (Math.abs(dx) > 45) goTo(indexRef.current + (dx < 0 ? 1 : -1));
          }}
        >
          {leaving ? (
            <div key={`out-${leaving.key}`} className="absolute inset-0 flex items-center justify-center animate-stage-out pointer-events-none">
              <div className="w-[82%] aspect-square rounded-full shadow-[0_26px_40px_-14px_rgba(40,30,10,0.4)] ring-[7px] ring-white/70 overflow-hidden">
                <Plate src={leaving.item.image_url} alt="" />
              </div>
            </div>
          ) : null}
          <button
            key={`in-${swap}`}
            onClick={() => onOpenItem(item)}
            aria-label={`View ${item.name}`}
            className="absolute inset-0 flex items-center justify-center animate-stage-in"
          >
            <span className="block w-[82%] aspect-square animate-float-dish">
              <span ref={stageImgRef} className="block w-full h-full rounded-full shadow-[0_26px_40px_-14px_rgba(40,30,10,0.4)] ring-[7px] ring-white/70 overflow-hidden">
                <Plate src={item.image_url} alt={item.name} />
              </span>
            </span>
          </button>
        </div>
      </div>
        </>
      ) : (
        <div className="relative z-10 mx-auto max-w-5xl mt-6 mb-1 text-center px-4 animate-card-rise">
          <p className="font-script text-[28px] leading-tight text-leaf-dark">{restaurant.name}</p>
          <p className="text-sm text-ink/60 mt-1.5 max-w-sm mx-auto">Pick any dish below and tap <strong>ADD</strong>. It lands on your banana leaf.</p>
        </div>
      )}

      {/* the banana leaf = the cart */}
      <div className="relative z-10 mx-auto max-w-5xl mt-3">
        <div className="flex items-center gap-2">
          <Leaf size={13} className="text-leaf flex-shrink-0" />
          <div className="leading-tight min-w-0">
            <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-ink/70 truncate">Your banana-leaf plate</p>
            <p className="text-[9px] text-ink/40 truncate">Dishes you serve land here</p>
          </div>
          <div className="ml-auto flex items-center gap-2 flex-shrink-0">
            {dishes > 0 ? (
              <button onClick={onClear} className="text-[10px] text-ink/45 hover:text-chili-dark transition-colors">Clear</button>
            ) : null}
            {cartCount > 0 ? (
              <button
                key={`pill-${bump}`}
                onClick={onOpenCart}
                className="bg-leaf text-white text-[10px] font-bold rounded-full px-2.5 py-1 animate-bump"
              >
                {cartCount} {cartCount === 1 ? "dish" : "dishes"} · {money(cartTotal, currency)}
              </button>
            ) : null}
          </div>
        </div>

        <div className="relative mt-1.5">
          <div ref={leafRef} className="relative w-[min(76vw,310px)] aspect-[300/130]">
            <BananaLeaf />
            {cart.map((c, i) => {
              const slot = SLOTS[i % SLOTS.length];
              const lift = Math.floor(i / SLOTS.length) * 7;
              return (
                <div
                  key={`${c.itemId}-${c.note || ""}`}
                  className="absolute"
                  style={{
                    left: `${slot.x}%`, top: `${slot.y + lift}%`, width: `${DISH_ON_LEAF * 100}%`, aspectRatio: "1",
                    transform: `translate(-50%, -50%) rotate(${slot.r}deg)`,
                  }}
                >
                  <div className="relative w-full h-full animate-leaf-pop">
                    <div className="w-full h-full rounded-full overflow-hidden ring-[3px] ring-white/85 shadow-[0_6px_10px_rgba(20,40,10,0.35)]">
                      <Plate src={c.imageUrl} alt={c.name} />
                    </div>
                    {c.qty > 1 ? (
                      <span className="absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 rounded-full bg-cocoa text-white text-[9px] font-bold flex items-center justify-center">
                        ×{c.qty}
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
            {cart.length === 0 ? (
              <p className="absolute left-1/2 -translate-x-1/2 bottom-[6%] whitespace-nowrap text-[9px] text-white/95 bg-ink/65 backdrop-blur rounded-full px-3 py-1">
                {item ? "Hit “Serve on Leaf” to put food on the leaf" : "Tap ADD on a dish to put it on the leaf"}
              </p>
            ) : null}
          </div>

          {toast ? (
            <div
              key={toast.id}
              className={`absolute right-0 bottom-3 z-20 max-w-[min(64vw,270px)] bg-cocoa text-white text-[11px] font-medium rounded-full px-4 py-2.5 shadow-xl ${toast.out ? "animate-toast-out" : "animate-toast-in"}`}
              style={{ transformOrigin: "left center" }}
            >
              <span className="block truncate">{toast.text}</span>
            </div>
          ) : null}
        </div>
      </div>

      {flyers.map((f) => (
        <Flyer key={f.id} flyer={f} onLanded={onFlyerLanded} />
      ))}
    </section>
  );
}
