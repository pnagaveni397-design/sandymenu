"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import Monogram from "@/components/Monogram";
import TemplatePlayer from "@/components/TemplatePlayer";
import { parseDbDate } from "@/lib/clientDates";
import {
  Volume2, ArrowRight, Search, Sparkles, ShoppingCart, Minus, Plus,
  Star, Tag, Video, Mic, CheckCheck, Banknote, QrCode, CheckCircle2,
  ChevronLeft, X, UtensilsCrossed, Armchair, ChefHat, Instagram,
  ChefHat as ChefHatIcon, Flame, Truck,
} from "lucide-react";

// Vegetarian / Non-veg are deliberately not offered as quick filters here:
// restaurants already organize that however they want via their own
// categories (e.g. "Veg" / "Non-veg" as category names), so a second,
// hardcoded veg/non-veg control would just duplicate that and confuse the
// customer with two versions of the same choice.
const FILTERS = [
  { key: "spicy", label: "Spicy" },
  { key: "popular", label: "Popular" },
  { key: "budget", label: "Under ₹200" },
];

// A menu item counts as "new" for this many days after it's added -- shown
// in its own row at the top of the menu, plus a small badge on the card.
const NEW_ITEM_WINDOW_DAYS = 10;

function money(n, currency = "INR") {
  const symbol = currency === "INR" ? "₹" : currency + " ";
  return `${symbol}${Math.round(n)}`;
}

function isNewItem(item) {
  if (!item.created_at) return false;
  const ageMs = Date.now() - parseDbDate(item.created_at).getTime();
  return ageMs >= 0 && ageMs < NEW_ITEM_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

// A calm, appetizing placeholder for a dish with no photo yet -- a soft
// green-tinted tile with a plate icon, instead of the dashboard's bold
// hashed-letter Monogram (which looks jarring for food -- a random red or
// orange block with "B" on it for "Biryani" reads as a broken image, not
// a placeholder). Used everywhere a dish photo is shown on the customer
// view: the hero carousel, menu cards, item detail, cart rows, etc.
function DishPlaceholder({ iconSize = 24, rounded = "rounded-xl", className = "" }) {
  return (
    <div className={`bg-sprout/10 flex items-center justify-center flex-shrink-0 ${rounded} ${className}`}>
      <UtensilsCrossed size={iconSize} strokeWidth={1.5} className="text-sprout/45" />
    </div>
  );
}

export default function MenuApp({ restaurant, table, categories, items, offers, payment, campaigns, taxes, platformFeeRate }) {
  const [sessionId] = useState(() => `sess_${Math.random().toString(36).slice(2)}`);
  const [view, setView] = useState("welcome");
  const [entered, setEntered] = useState(false);
  const [activeCategory, setActiveCategory] = useState(categories[0]?.id || null);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [cart, setCart] = useState([]);
  const [order, setOrder] = useState(null);
  const [placing, setPlacing] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  const cartCount = cart.reduce((s, c) => s + c.qty, 0);
  const subtotal = cart.reduce((s, c) => s + c.qty * c.price, 0);

  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      if (query && !it.name.toLowerCase().includes(query.toLowerCase())) return false;
      if (activeCategory && it.category_id !== activeCategory && (query || filters.length)) {
        // when searching/filtering, ignore category tab restriction
      } else if (activeCategory && !query && filters.length === 0 && it.category_id !== activeCategory) {
        return false;
      }
      for (const f of filters) {
        if (f === "spicy" && !(it.spice_level === "medium" || it.spice_level === "hot")) return false;
        if (f === "popular" && !it.is_popular) return false;
        if (f === "budget" && it.price >= 200) return false;
      }
      return true;
    });
  }, [items, query, filters, activeCategory]);

  // A dish counts as "new" if the restaurant has explicitly flagged it to
  // show in the "New on the menu" row; if nobody has flagged anything yet,
  // fall back to items added in the last NEW_ITEM_WINDOW_DAYS so the row
  // still makes sense for restaurants that haven't touched that toggle.
  const newItems = useMemo(() => {
    const flagged = items.filter((it) => it.is_new_pick);
    return flagged.length > 0 ? flagged : items.filter(isNewItem);
  }, [items]);

  function toggleFilter(key) {
    setFilters((f) => (f.includes(key) ? f.filter((x) => x !== key) : [...f, key]));
  }

  function addToCart(item, qty = 1, note = "") {
    setCart((prev) => {
      const existing = prev.find((c) => c.itemId === item.id && c.note === note);
      if (existing) {
        return prev.map((c) => (c === existing ? { ...c, qty: c.qty + qty } : c));
      }
      return [
        ...prev,
        {
          itemId: item.id,
          name: item.name,
          price: item.discounted_price || item.price,
          qty,
          note,
          imageUrl: item.image_url,
        },
      ];
    });
  }

  function updateQty(idx, delta) {
    setCart((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], qty: next[idx].qty + delta };
      return next.filter((c) => c.qty > 0);
    });
  }

  async function placeOrder() {
    setPlacing(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: restaurant.id,
          tableId: table.id,
          items: cart,
          subtotal,
          sessionId,
          customerName,
          customerPhone,
        }),
      });

      let data;
      try {
        data = await res.json();
      } catch {
        throw new Error(`Server error (${res.status}). Please try again.`);
      }
      if (!res.ok) throw new Error(data.error || "Order failed");
      setOrder(data.order);
      setCart([]);
      setView("tracking");
    } catch (e) {
      alert("Could not place order: " + e.message);
    } finally {
      setPlacing(false);
    }
  }

  return (
    <main className="min-h-screen bg-paper">
      {view === "welcome" && (
        <WelcomeScreen
          restaurant={restaurant}
          table={table}
          entered={entered}
          onEnter={() => {
            setEntered(true);
            setView("menu");
          }}
        />
      )}

      {view === "menu" && (
        <MenuScreen
          restaurant={restaurant}
          table={table}
          categories={categories}
          items={filteredItems}
          allItems={items}
          newItems={newItems}
          allItemsCount={items.length}
          query={query}
          setQuery={setQuery}
          filters={filters}
          toggleFilter={toggleFilter}
          activeCategory={activeCategory}
          setActiveCategory={(id) => {
            setActiveCategory(id);
            setQuery("");
            setFilters([]);
          }}
          offers={offers}
          onOpenItem={(it) => setSelectedItem(it)}
          onOpenAssistant={() => setAssistantOpen(true)}
          cartCount={cartCount}
          cartTotal={subtotal}
          onOpenCart={() => setView("cart")}
        />
      )}

      {selectedItem && (
        <ItemDetail
          item={selectedItem}
          currency={restaurant.currency}
          onClose={() => setSelectedItem(null)}
          onAdd={(qty, note) => {
            addToCart(selectedItem, qty, note);
            setSelectedItem(null);
          }}
        />
      )}

      {assistantOpen && (
        <AssistantModal
          restaurantId={restaurant.id}
          items={items}
          currency={restaurant.currency}
          onClose={() => setAssistantOpen(false)}
          onAdd={(item) => addToCart(item, 1)}
        />
      )}

      {view === "cart" && (
        <CartScreen
          cart={cart}
          currency={restaurant.currency}
          subtotal={subtotal}
          onBack={() => setView("menu")}
          onUpdateQty={updateQty}
          onPlaceOrder={placeOrder}
          placing={placing}
          customerName={customerName}
          setCustomerName={setCustomerName}
          customerPhone={customerPhone}
          setCustomerPhone={setCustomerPhone}
        />
      )}

      {view === "tracking" && order && (
        <OrderTrackingScreen
          initialOrder={order}
          restaurant={restaurant}
          table={table}
          offers={offers}
          campaigns={campaigns}
          payment={payment}
          sessionId={sessionId}
          onNewOrder={() => { setOrder(null); setView("menu"); }}
        />
      )}
    </main>
  );
}

// ---------- Menu footer: tagline + Google / Instagram ----------
//
// Replaces the old scrolling marquee banner. The restaurant's messages
// (added/edited/removed from the dashboard, same as before) rotate here as
// a single calm line of text, sitting just above small icon-only links to
// their Google review page and Instagram -- no "Follow us" text, just the
// icons, exactly as asked.

function MenuFooter({ messages, instagramUrl, googleReviewUrl }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!messages || messages.length < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % messages.length), 3800);
    return () => clearInterval(t);
  }, [messages?.length]);

  const hasMessages = messages && messages.length > 0;
  const hasSocial = !!instagramUrl || !!googleReviewUrl;
  if (!hasMessages && !hasSocial) return null;

  return (
    <div className="px-6 pt-8 pb-6 flex flex-col items-center text-center">
      {hasMessages && (
        <p key={index} className="text-sm text-ink/60 font-medium animate-pop-in flex items-center gap-1.5 min-h-[20px]">
          <Sparkles size={13} className="text-sprout flex-shrink-0" /> {messages[index % messages.length]}
        </p>
      )}
      {hasSocial && (
        <div className="flex items-center gap-3 mt-3.5">
          {googleReviewUrl && (
            <a
              href={googleReviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Review us on Google"
              className="w-11 h-11 rounded-full bg-white border border-ink/10 shadow-sm flex items-center justify-center hover:shadow-md transition-shadow"
            >
              <GoogleG size={18} />
            </a>
          )}
          {instagramUrl && (
            <a
              href={instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Visit our Instagram"
              className="w-11 h-11 rounded-full bg-white border border-ink/10 shadow-sm flex items-center justify-center text-ink hover:shadow-md transition-shadow"
            >
              <Instagram size={18} />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// A simple, non-trademarked rendition of Google's four-color "G" mark --
// enough to be instantly recognizable as "Google" on a small icon button,
// without reproducing Google's exact logo artwork.
function GoogleG({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h5.9a5.04 5.04 0 0 1-2.19 3.31v2.75h3.54c2.08-1.92 3.25-4.74 3.25-8.09z" />
      <path fill="#34A853" d="M12 23c2.96 0 5.45-.98 7.26-2.65l-3.54-2.75c-.98.66-2.24 1.05-3.72 1.05-2.86 0-5.28-1.93-6.14-4.52H2.2v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.86 14.13A6.6 6.6 0 0 1 5.5 12c0-.74.13-1.46.36-2.13V7.03H2.2A11 11 0 0 0 1 12c0 1.78.43 3.46 1.2 4.97l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.61 0 3.06.55 4.2 1.64l3.14-3.14C17.44 2.08 14.96 1 12 1a11 11 0 0 0-9.8 6.03l3.66 2.84C6.72 7.3 9.14 5.38 12 5.38z" />
    </svg>
  );
}


// A bold, full-width strip announcing today's live offer, shown as the very
// first thing on the menu page (above the header) so it can't be missed --
// unlike the old subtle rounded chip it replaces, this reads the way a
// restaurant's own "exclusive discount today" banner should: solid color,
// edge to edge, impossible to scroll past unnoticed.
function OfferBanner({ offer }) {
  return (
    <div className="bg-sprout text-white px-4 py-2.5 flex items-center justify-center gap-2 text-center">
      <Sparkles size={14} className="flex-shrink-0" />
      <p className="text-xs font-bold tracking-wide uppercase truncate">{offer.title}</p>
      <Sparkles size={14} className="flex-shrink-0" />
    </div>
  );
}

// ---------- Welcome ----------

function WelcomeScreen({ restaurant, table, onEnter }) {
  const hasCover = !!restaurant.cover_image_url;
  return (
    <div className="min-h-screen flex flex-col bg-ink">
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center relative overflow-hidden">
        {hasCover ? (
          <>
            <img
              src={restaurant.cover_image_url}
              alt=""
              className="absolute inset-0 w-full h-full object-cover scale-105"
            />
            {/* Just enough of a neutral dark veil (no green tint) to keep the
                white logo/text readable over the restaurant's own photo --
                the photo itself is the background, untouched by any color. */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/35 to-black/70" />
          </>
        ) : (
          <>
            <div className="absolute inset-0 bg-gradient-to-br from-ink via-ink to-black" />
            <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute inset-0 opacity-[0.06] flex items-center justify-center select-none">
              <UtensilsCrossed size={280} strokeWidth={1} className="text-white" />
            </div>
          </>
        )}

        <div className="relative z-10 animate-rise-in">
          {restaurant.logo_image_url ? (
            <img
              src={restaurant.logo_image_url}
              alt={restaurant.name}
              className="w-20 h-20 rounded-full object-cover mx-auto mb-5 shadow-xl ring-4 ring-white/25 bg-white"
            />
          ) : (
            <div className="w-20 h-20 mx-auto mb-5 shadow-xl ring-4 ring-white/25 rounded-full overflow-hidden bg-white flex items-center justify-center">
              <UtensilsCrossed size={32} strokeWidth={1.5} className="text-sprout" />
            </div>
          )}
          <p className="text-white/80 tracking-[0.15em] uppercase text-xs font-semibold mb-3">Table {table.table_number}</p>
          <h1 className="font-display text-4xl md:text-5xl font-bold text-white leading-[1.1]">
            Welcome to<br />{restaurant.name}
          </h1>
          <p className="mt-4 text-white/75 max-w-xs mx-auto">
            {restaurant.tagline || "Discover today's delicious specials."}
          </p>
          <button
            onClick={onEnter}
            className="mt-10 bg-white hover:bg-white/90 transition-all hover:scale-[1.03] active:scale-[0.98] text-sprout-dark font-semibold px-9 py-4 rounded-full shadow-lg shadow-black/10 inline-flex items-center gap-2"
          >
            {restaurant.welcome_sound_enabled ? (
              <>Tap to Enter <Volume2 size={18} /></>
            ) : (
              <>Explore Menu <ArrowRight size={18} /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Menu ----------

function MenuScreen({
  restaurant, table, categories, items, allItems, newItems, allItemsCount, query, setQuery,
  filters, toggleFilter, activeCategory, setActiveCategory, offers,
  onOpenItem, onOpenAssistant, cartCount, cartTotal, onOpenCart,
}) {
  const activeCategoryName = categories.find((c) => c.id === activeCategory)?.name;
  const newItemIds = useMemo(() => new Set(newItems.map((it) => it.id)), [newItems]);

  return (
    <div className="pb-28 bg-paper">
      {/* Exclusive-offer banner -- the very first thing on the page, ahead
          of the header/hero, so today's discount can't be missed. */}
      {offers.length > 0 && <OfferBanner offer={offers[0]} />}

      <HeroSection
        restaurant={restaurant}
        table={table}
        categories={categories}
        activeCategory={activeCategory}
        setActiveCategory={setActiveCategory}
        allItems={allItems}
        currency={restaurant.currency}
        onOpenItem={onOpenItem}
        cartCount={cartCount}
        onOpenCart={onOpenCart}
      />

      {/* Slim sticky search + filter bar -- stays reachable once the hero scrolls away */}
      <div className="bg-white/95 backdrop-blur-md border-b border-ink/10 sticky top-0 z-20 px-4 py-3 shadow-sm">
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-clay" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the menu..."
            className="w-full bg-paper border border-ink/10 rounded-full pl-9 pr-4 py-2.5 text-sm outline-none focus:border-sprout"
          />
        </div>

        <div className="mt-2.5 flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveCategory(c.id)}
              className={`whitespace-nowrap text-xs font-semibold px-3.5 py-1.5 rounded-full border transition-colors flex-shrink-0 ${
                activeCategory === c.id && !query && filters.length === 0
                  ? "bg-sprout text-white border-sprout"
                  : "border-ink/15 text-ink/60"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        <div className="mt-2 flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => toggleFilter(f.key)}
              className={`whitespace-nowrap text-[11px] font-medium px-3 py-1.5 rounded-full border transition-colors flex-shrink-0 ${
                filters.includes(f.key)
                  ? "bg-chili text-white border-chili"
                  : "border-ink/15 text-ink/60"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4">
        <button
          onClick={onOpenAssistant}
          className="w-full bg-ink text-paper rounded-card px-4 py-3.5 flex items-center justify-center gap-2 font-semibold hover:bg-ink/90 transition-colors"
        >
          <Sparkles size={18} /> Help me choose
        </button>
      </div>

      {!query && filters.length === 0 && newItems.length > 0 && (
        <div className="pt-5">
          <p className="px-4 text-sm font-semibold text-ink mb-2.5 flex items-center gap-1.5">
            <Sparkles size={15} className="text-turmeric" /> New on the menu
          </p>
          <div className="flex gap-3 overflow-x-auto no-scrollbar px-4 pb-1">
            {newItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onOpenItem(item)}
                className="flex-shrink-0 w-36 text-left bg-white border border-ink/10 rounded-2xl overflow-hidden hover:border-sprout/40 hover:shadow-md transition-all"
              >
                <div className="relative">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="w-36 h-24 object-cover" />
                  ) : (
                    <DishPlaceholder iconSize={28} rounded="rounded-none" className="w-36 h-24" />
                  )}
                  <span className="absolute top-1.5 left-1.5 text-[10px] font-bold text-white bg-sprout px-1.5 py-0.5 rounded-full">NEW</span>
                </div>
                <div className="p-2.5">
                  <p className="font-semibold text-ink text-xs truncate">{item.name}</p>
                  <p className="text-xs text-clay mt-0.5">{money(item.discounted_price || item.price, restaurant.currency)}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="px-4 pt-5">
        <h2 className="font-display text-lg font-bold text-ink mb-3">
          {query || filters.length > 0 ? "Results" : activeCategoryName || "Menu"}
        </h2>
        <div className="grid gap-3">
          {items.length === 0 && (
            <p className="text-center text-clay text-sm py-10">
              No dishes match right now — try a different search or filter.
            </p>
          )}
          {items.map((item) => (
            <MenuItemCard key={item.id} item={item} currency={restaurant.currency} onOpen={() => onOpenItem(item)} isNew={newItemIds.has(item.id)} />
          ))}
        </div>
      </div>

      <MenuFooter
        messages={restaurant.banner_messages}
        instagramUrl={restaurant.instagram_url}
        googleReviewUrl={restaurant.google_review_url}
      />

      {cartCount > 0 && (
        <button
          onClick={onOpenCart}
          className="fixed bottom-5 left-4 right-4 bg-sprout text-white rounded-2xl px-5 py-3.5 flex items-center justify-between shadow-lg font-semibold z-30"
        >
          <span>{cartCount} item{cartCount > 1 ? "s" : ""} in cart</span>
          <span>{money(cartTotal, restaurant.currency)} · View cart</span>
        </button>
      )}
    </div>
  );
}

// The "green dome" header, redrawn to match the reference recording pixel
// for pixel: white top band with the logo/name and headline, then a
// solid-green curved panel (the exact green sampled from the video, not
// the dashboard's muted "herb") holding the category chips, with the
// featured item's photo floating so it spills out past the curve onto the
// white area below it. Everything here still comes from the restaurant's
// live categories / menu items -- add or edit a dish in the dashboard and
// it shows up here immediately, nothing is hardcoded.
function HeroSection({ restaurant, table, categories, activeCategory, setActiveCategory, allItems, currency, onOpenItem, cartCount, onOpenCart }) {
  return (
    <div>
      <div className="bg-paper px-5 pt-5 pb-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            {restaurant.logo_image_url ? (
              <img src={restaurant.logo_image_url} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-sprout/15 flex-shrink-0" />
            ) : (
              <Monogram name={restaurant.name} size="sm" className="w-10 h-10 rounded-full flex-shrink-0" />
            )}
            <div className="min-w-0">
              <p className="font-display font-bold text-ink text-sm leading-tight truncate">{restaurant.name}</p>
              <p className="text-clay text-[11px]">Table {table.table_number}</p>
            </div>
          </div>
          <button
            onClick={onOpenCart}
            className="relative w-10 h-10 rounded-full bg-white border border-ink/10 flex items-center justify-center text-ink shadow-sm flex-shrink-0"
          >
            <ShoppingCart size={17} />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-chili text-white text-[10px] font-bold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>
        </div>

        <h1 className="font-display text-[22px] font-bold text-sprout-dark leading-[1.2] mt-4 whitespace-pre-line">
          {restaurant.tagline || "Fresh flavors,\nmade just for you"}
        </h1>
      </div>

      <div className="relative mt-4">
        {/* The exact solid green from the reference recording, not a gradient */}
        <div className="absolute inset-x-0 top-0 h-28 bg-sprout rounded-b-[45%] overflow-hidden">
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10" />
          <div className="absolute top-6 -left-8 w-24 h-24 rounded-full bg-white/5" />
        </div>

        <div className="relative pt-4 px-5">
          <HeroCarousel items={allItems} currency={currency} onOpenItem={onOpenItem} />
        </div>
      </div>
    </div>
  );
}

// The featured-dish carousel, rebuilt to match the actual motion in the
// reference recording: each product genuinely SLIDES across (the current
// photo glides out to the left while the next one glides in from the
// right along a single track), not a fade/cross-dissolve. Name, price and
// the dot indicator crossfade in step with the currently-centered photo.
// Tapping the visible photo opens the same item detail page as tapping a
// regular menu card.
function HeroCarousel({ items, currency, onOpenItem }) {
  const picks = useMemo(() => {
    // The restaurant explicitly controls this via the "Feature in the
    // Chef's Pick carousel" checkbox (and can order them with the
    // up/down arrows in the dashboard); only fall back to automatic
    // guesses if they haven't curated anything yet.
    const recommended = items.filter((it) => it.is_recommended && it.image_url);
    const popular = items.filter((it) => it.is_popular && it.image_url);
    const withImage = items.filter((it) => it.image_url);
    const pool = recommended.length ? recommended : popular.length ? popular : withImage.length ? withImage : items;
    return pool.slice(0, 6);
  }, [items]);

  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [picks.length]);

  useEffect(() => {
    if (picks.length < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % picks.length), 3600);
    return () => clearInterval(t);
  }, [picks.length]);

  if (picks.length === 0) return null;
  const item = picks[index];
  const price = item.discounted_price || item.price;

  return (
    <div className="flex flex-col items-center -mt-1 pb-1">
      {/* Sliding track: one photo per slot, shifted by -index * 100% with a
          smooth transform transition -- this is the actual slide, not a
          fade, so the outgoing photo visibly glides past the incoming one. */}
      <button
        onClick={() => onOpenItem(item)}
        className="relative w-40 h-40 rounded-full bg-white/20 overflow-hidden transition-transform active:scale-95"
      >
        <div
          className="absolute inset-0 flex transition-transform duration-500 ease-in-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {picks.map((p) => (
            <div key={p.id} className="w-40 h-40 flex-shrink-0 flex items-center justify-center">
              {p.image_url ? (
                <img
                  src={p.image_url}
                  alt={p.name}
                  className="w-32 h-32 object-cover rounded-full shadow-xl ring-4 ring-white/40"
                />
              ) : (
                <div className="w-32 h-32 rounded-full overflow-hidden">
                  <DishPlaceholder iconSize={44} rounded="rounded-full" className="w-full h-full" />
                </div>
              )}
            </div>
          ))}
        </div>
      </button>

      <span key={`name-${index}`} className="mt-3 text-ink font-display font-bold text-base animate-pop-in">{item.name}</span>
      <span key={`price-${index}`} className="text-sprout-dark text-sm font-semibold mt-0.5 animate-pop-in">{money(price, currency)}</span>

      {picks.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-3">
          {picks.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === index ? "w-5 bg-sprout" : "w-1.5 bg-ink/15"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MenuItemCard({ item, currency, onOpen, isNew }) {
  const hasDiscount = item.discounted_price && item.discounted_price < item.price;
  return (
    <button
      onClick={onOpen}
      className="text-left bg-white border border-ink/10 rounded-2xl p-3.5 flex gap-3 hover:border-sprout/40 hover:shadow-md transition-all"
    >
      {item.image_url ? (
        <img src={item.image_url} alt={item.name} className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
      ) : (
        <DishPlaceholder iconSize={24} rounded="rounded-xl" className="w-16 h-16" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold text-ink text-sm">{item.name}</p>
          <VegDot veg={item.is_veg} />
        </div>
        <p className="text-xs text-clay mt-0.5 line-clamp-2">{item.description}</p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {hasDiscount ? (
            <>
              <span className="font-semibold text-ink text-sm">{money(item.discounted_price, currency)}</span>
              <span className="text-xs text-clay line-through">{money(item.price, currency)}</span>
            </>
          ) : (
            <span className="font-semibold text-ink text-sm">{money(item.price, currency)}</span>
          )}
          {isNew ? <Badge label="New" tone="chili" /> : null}
          {item.is_popular ? <Badge label="Popular" tone="turmeric" /> : null}
          {(item.spice_level === "medium" || item.spice_level === "hot") ? (
            <Badge label={item.spice_level === "hot" ? "Very spicy" : "Spicy"} tone="chili" />
          ) : null}
        </div>
      </div>
    </button>
  );
}

function VegDot({ veg }) {
  return (
    <span
      className={`flex-shrink-0 w-4 h-4 border-2 rounded-[3px] flex items-center justify-center ${
        veg ? "border-sprout" : "border-chili"
      }`}
      title={veg ? "Vegetarian" : "Non-vegetarian"}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${veg ? "bg-sprout" : "bg-chili"}`} />
    </span>
  );
}

function Badge({ label, tone }) {
  const toneClasses = tone === "turmeric" ? "bg-turmeric/20 text-chili-dark" : "bg-chili/10 text-chili-dark";
  return <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${toneClasses}`}>{label}</span>;
}

// ---------- Item Detail ----------
//
// Rebuilt as a full-screen page (not a bottom sheet) because that's what
// the reference recording actually shows: tapping a dish replaces the
// whole screen -- white header, back arrow, "Details" title, no dimmed
// backdrop behind it -- and it enters with a quick slide-in, the same way
// a native app pushes a new screen. The green "added to order" card is
// the one moment that *does* sit over a dimmed backdrop, matching the
// video's confirmation popup exactly.

const NOTE_OPTIONS = ["Less spicy", "No onions", "Extra sauce"];

function ItemDetail({ item, currency, onClose, onAdd }) {
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [justAdded, setJustAdded] = useState(false);
  const price = item.discounted_price || item.price;
  const allergens = JSON.parse(item.allergens || "[]");

  function handleAdd() {
    setJustAdded(true);
  }

  function confirmAdd() {
    onAdd(qty, note);
  }

  return (
    <div className="fixed inset-0 z-40 bg-paper overflow-y-auto animate-slide-in-right">
      {/* Back / close + centered "Details" title, exactly like the reference's header */}
      <div className="sticky top-0 z-10 bg-paper/95 backdrop-blur-md flex items-center justify-center px-4 pt-4 pb-2">
        <button
          onClick={onClose}
          className="absolute left-4 w-9 h-9 rounded-full bg-white shadow flex items-center justify-center text-ink"
        >
          <ChevronLeft size={19} />
        </button>
        <span className="text-sm font-bold text-ink">Details</span>
        <span className="absolute right-4 w-9 h-9 rounded-full bg-white shadow flex items-center justify-center text-ink">
          <VegDot veg={item.is_veg} />
        </span>
      </div>

      {/* Product image floating on the reference's solid green circle */}
      <div className="pt-2 pb-3 flex justify-center">
        <div className="relative w-52 h-52 rounded-full bg-sprout/15 flex items-center justify-center overflow-hidden">
          {item.image_url ? (
            <img src={item.image_url} alt={item.name} className="w-44 h-44 object-cover rounded-full shadow-xl" />
          ) : (
            <div className="w-44 h-44 rounded-full overflow-hidden">
              <DishPlaceholder iconSize={52} rounded="rounded-full" className="w-full h-full" />
            </div>
          )}
        </div>
      </div>

      <div className="px-5 pt-2 pb-32">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-2xl font-bold text-ink leading-tight">{item.name}</h2>
          <span className="font-display text-xl font-bold text-sprout-dark flex-shrink-0">{money(price, currency)}</span>
        </div>
        <p className="text-ink/60 mt-1.5 text-sm">{item.description}</p>

        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {item.discounted_price ? (
            <span className="text-sm text-clay line-through">{money(item.price, currency)}</span>
          ) : null}
          {item.is_popular ? <Badge label="Popular" tone="turmeric" /> : null}
          <Badge label={`${item.prep_time_minutes} min`} tone="chili" />
        </div>

        {allergens.length > 0 && (
          <p className="text-xs text-clay mt-3">Allergens: {allergens.join(", ")}</p>
        )}

        {/* "Size Options"-style row from the reference, reused here for customization chips */}
        <div className="mt-6">
          <p className="text-sm font-semibold text-ink mb-2.5">Options</p>
          <div className="flex gap-3">
            {NOTE_OPTIONS.map((s) => {
              const active = note === s;
              return (
                <button
                  key={s}
                  onClick={() => setNote(active ? "" : s)}
                  className="flex flex-col items-center gap-1.5 flex-1"
                >
                  <span
                    className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-colors ${
                      active ? "bg-sprout border-sprout text-white" : "bg-white border-ink/10 text-ink/50"
                    }`}
                  >
                    <Tag size={16} />
                  </span>
                  <span className={`text-[11px] font-semibold text-center leading-tight ${active ? "text-ink" : "text-ink/45"}`}>
                    {s}
                  </span>
                </button>
              );
            })}
          </div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Or type your own note, e.g. no coriander"
            className="mt-3 w-full bg-white border border-ink/10 rounded-card px-3.5 py-2.5 text-sm outline-none focus:border-sprout"
          />
        </div>
      </div>

      {/* Sticky quantity + Add to order bar, pinned like the reference's bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-paper border-t border-ink/10 px-5 py-4 flex items-center gap-3">
        <div className="flex items-center border-2 border-ink/10 rounded-full flex-shrink-0">
          <button
            onClick={() => setQty((q) => Math.max(1, q - 1))}
            className="w-10 h-10 flex items-center justify-center text-ink/70"
          >
            <Minus size={16} />
          </button>
          <span className="w-6 text-center font-bold text-ink">{qty}</span>
          <button
            onClick={() => setQty((q) => q + 1)}
            className="w-10 h-10 flex items-center justify-center text-ink/70"
          >
            <Plus size={16} />
          </button>
        </div>
        <button
          onClick={handleAdd}
          className="flex-1 bg-sprout text-white font-semibold py-3.5 rounded-2xl transition-transform active:scale-[0.98]"
        >
          {`Add to Order · ${money(price * qty, currency)}`}
        </button>
      </div>

      {/* Success confirmation -- the one place a dimmed backdrop appears,
          exactly matching the reference's green "thank you" popup */}
      {justAdded && (
        <div
          className="fixed inset-0 z-50 bg-ink/40 flex items-center justify-center px-8"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="bg-sprout rounded-3xl px-6 py-8 text-center max-w-xs w-full animate-pop-in shadow-2xl">
            <div className="w-14 h-14 rounded-full bg-white/15 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 size={30} className="text-white" />
            </div>
            <p className="font-display text-lg font-bold text-white">Thank you for your order!</p>
            <p className="text-sm text-white/75 mt-1">
              {item.name} × {qty} has been added.
            </p>
            <button
              onClick={confirmAdd}
              className="mt-5 w-full bg-white text-sprout-dark font-semibold py-3 rounded-full"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- AI Assistant ----------

function AssistantModal({ restaurantId, items, currency, onClose, onAdd }) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [added, setAdded] = useState({});

  const quickPrompts = [
    "I want something spicy",
    "Something under ₹250",
    "I'm very hungry",
    "Vegetarian and light",
  ];

  async function ask(text) {
    setLoading(true);
    setResults(null);
    try {
      const res = await fetch("/api/ai/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, query: text }),
      });
      const data = await res.json();
      setResults(data);
    } catch (e) {
      setResults({ message: "Couldn't get recommendations right now.", recommendations: [] });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink/50 flex items-end" onClick={onClose}>
      <div
        className="bg-paper w-full rounded-t-3xl max-h-[85vh] overflow-y-auto p-5 animate-rise-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-bold text-ink flex items-center gap-2"><Sparkles size={20} className="text-sprout" /> Help me choose</h2>
          <button onClick={onClose} className="text-ink/50 hover:text-ink transition-colors p-1"><X size={20} /></button>
        </div>

        <div className="flex gap-2 flex-wrap mb-3">
          {quickPrompts.map((p) => (
            <button
              key={p}
              onClick={() => { setInput(p); ask(p); }}
              className="text-xs border border-ink/15 text-ink/70 px-3 py-1.5 rounded-full"
            >
              {p}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); if (input.trim()) ask(input); }}
          className="flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tell me what you're craving..."
            className="flex-1 bg-white border border-ink/10 rounded-card px-3.5 py-2.5 text-sm outline-none focus:border-sprout"
          />
          <button type="submit" className="bg-sprout text-white px-4 rounded-card text-sm font-semibold">Ask</button>
        </form>

        <div className="mt-5">
          {loading && <p className="text-sm text-clay">Thinking about what's available right now...</p>}

          {results && (
            <>
              <p className="text-sm text-ink/70 mb-3">{results.message}</p>
              <div className="grid gap-3">
                {results.recommendations?.map((r) => (
                  <div key={r.item.id} className="bg-white border border-ink/10 rounded-2xl p-3.5 flex gap-3 shadow-sm">
                    {r.item.image_url ? (
                      <img src={r.item.image_url} alt={r.item.name} className="w-14 h-14 rounded-xl object-cover flex-shrink-0" />
                    ) : (
                      <DishPlaceholder iconSize={18} rounded="rounded-xl" className="w-14 h-14" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-ink text-sm">{r.item.name}</p>
                        <span className="font-semibold text-sm text-ink">
                          {money(r.item.discounted_price || r.item.price, currency)}
                        </span>
                      </div>
                      <p className="text-xs text-clay mt-0.5">{r.reason}</p>
                      <button
                        onClick={() => { onAdd(r.item); setAdded((a) => ({ ...a, [r.item.id]: true })); }}
                        className="mt-2 text-xs font-semibold bg-sprout/10 text-sprout-dark px-3 py-1.5 rounded-full inline-flex items-center gap-1"
                      >
                        {added[r.item.id] ? (<><CheckCheck size={13} /> Added</>) : "Add to cart"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------- Cart (items only -- no discounts/payment here anymore; those
// come after the food is served) ----------

function CartScreen({
  cart, currency, subtotal, onBack, onUpdateQty, onPlaceOrder, placing,
  customerName, setCustomerName, customerPhone, setCustomerPhone,
}) {
  return (
    <div className="min-h-screen pb-32 bg-paper animate-slide-in-right">
      <div className="bg-white border-b border-ink/10 px-4 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={onBack} className="w-9 h-9 rounded-full bg-paper flex items-center justify-center text-ink hover:bg-ink/5 transition-colors"><ChevronLeft size={18} /></button>
        <h1 className="font-display text-lg font-bold text-ink">Your order</h1>
      </div>

      {cart.length === 0 ? (
        <div className="text-center py-20 px-6">
          <div className="w-16 h-16 rounded-full bg-sprout/10 flex items-center justify-center mx-auto mb-3">
            <ShoppingCart size={26} className="text-sprout" strokeWidth={1.5} />
          </div>
          <p className="text-ink/60">Your cart is empty.</p>
          <button onClick={onBack} className="mt-4 text-sprout-dark font-semibold text-sm">Browse the menu</button>
        </div>
      ) : (
        <>
          <div className="px-4 pt-4 grid gap-2.5">
            {cart.map((c, idx) => (
              <div key={idx} className="bg-white border border-ink/10 rounded-2xl p-3.5 flex items-center gap-3 shadow-sm">
                {c.imageUrl ? (
                  <img src={c.imageUrl} alt={c.name} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                ) : (
                  <DishPlaceholder iconSize={18} rounded="rounded-xl" className="w-12 h-12" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-ink text-sm">{c.name}</p>
                  {c.note && <p className="text-xs text-clay">Note: {c.note}</p>}
                  <p className="text-xs text-clay">{money(c.price, currency)} each</p>
                </div>
                <div className="flex items-center border-2 border-ink/10 rounded-full">
                  <button onClick={() => onUpdateQty(idx, -1)} className="w-8 h-8 flex items-center justify-center text-ink/70">−</button>
                  <span className="px-1 font-semibold text-sm w-4 text-center">{c.qty}</span>
                  <button onClick={() => onUpdateQty(idx, 1)} className="w-8 h-8 flex items-center justify-center text-ink/70">+</button>
                </div>
              </div>
            ))}
          </div>

          <div className="px-4 mt-5">
            <div className="bg-white border border-ink/10 rounded-2xl p-4 shadow-sm">
              <p className="text-sm font-semibold text-ink mb-2.5">Your details</p>
              <div className="grid gap-2.5">
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Your name"
                  maxLength={60}
                  className="w-full bg-paper border border-ink/10 rounded-card px-3.5 py-2.5 text-sm outline-none focus:border-sprout"
                />
                <input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Phone number (optional)"
                  type="tel"
                  maxLength={20}
                  className="w-full bg-paper border border-ink/10 rounded-card px-3.5 py-2.5 text-sm outline-none focus:border-sprout"
                />
              </div>
            </div>
          </div>

          <div className="px-4 mt-3">
            <div className="bg-white border border-ink/10 rounded-2xl p-4 text-sm shadow-sm">
              <Row label="Subtotal" value={money(subtotal, currency)} bold />
            </div>
            <p className="text-xs text-clay mt-2.5 px-1">
              Tax and any discount are added to your final bill after your food is served — you'll
              have a chance to get a discount then too.
            </p>
          </div>

          <button
            disabled={placing}
            onClick={onPlaceOrder}
            className="fixed bottom-5 left-4 right-4 bg-sprout disabled:opacity-60 text-white rounded-2xl px-5 py-3.5 font-semibold shadow-lg"
          >
            {placing ? "Sending to kitchen..." : `Send order to kitchen · ${money(subtotal, currency)}`}
          </button>
        </>
      )}
    </div>
  );
}

function Row({ label, value, bold }) {
  return (
    <div className={`flex items-center justify-between py-1 ${bold ? "font-bold text-ink text-base" : "text-ink/70"}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

// ---------- Order tracking + post-meal bill (the whole journey after
// "Send order to kitchen", in one polling screen) ----------

const STAGES = [
  { key: "pending", label: "Received", icon: CheckCircle2 },
  { key: "preparing", label: "Preparing", icon: Flame },
  { key: "served", label: "Served", icon: Truck },
];

function OrderTrackingScreen({ initialOrder, restaurant, table, offers, campaigns, payment, sessionId, onNewOrder }) {
  const [order, setOrder] = useState(initialOrder);
  const [billOpen, setBillOpen] = useState(false);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/orders/${order.order_number}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.order) setOrder((prev) => ({ ...prev, ...data.order }));
      } catch {
        // network hiccup — just try again next tick
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [order.order_number]);

  const stageIndex = STAGES.findIndex((s) => s.key === order.status);
  const isServedOrLater = ["served", "completed"].includes(order.status);
  const billFinalized = !!order.payment_method;

  // The moment the food is marked served, offer the bill/discount step
  // automatically (only once, and only if it hasn't been finalized yet).
  useEffect(() => {
    if (isServedOrLater && !billFinalized) setBillOpen(true);
  }, [isServedOrLater, billFinalized]);

  if (isServedOrLater && !billFinalized && billOpen) {
    return (
      <BillScreen
        order={order}
        restaurant={restaurant}
        offers={offers}
        campaigns={campaigns}
        payment={payment}
        sessionId={sessionId}
        onFinalized={(updatedOrder) => { setOrder((prev) => ({ ...prev, ...updatedOrder })); setBillOpen(false); }}
      />
    );
  }

  if (billFinalized) {
    return (
      <ReceiptScreen order={order} restaurant={restaurant} table={table} payment={payment} onNewOrder={onNewOrder} />
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center px-6 pt-14 pb-10 text-center bg-paper animate-slide-in-right">
      <div className="w-16 h-16 rounded-full bg-sprout/12 flex items-center justify-center mb-4 animate-rise-in">
        <CheckCircle2 size={34} className="text-sprout" />
      </div>
      <h1 className="font-display text-2xl font-bold text-ink">Order sent to the kitchen!</h1>
      <p className="text-ink/60 mt-1.5">#{order.order_number} · Table {table.table_number}</p>

      <div className="mt-8 w-full max-w-sm">
        <div className="flex items-center justify-between">
          {STAGES.map((s, i) => {
            const Icon = s.icon;
            const reached = i <= (stageIndex < 0 ? 0 : stageIndex);
            return (
              <div key={s.key} className="flex-1 flex flex-col items-center relative">
                {i > 0 && (
                  <div className={`absolute top-4 right-1/2 w-full h-0.5 ${reached ? "bg-sprout" : "bg-ink/10"}`} style={{ zIndex: 0 }} />
                )}
                <div
                  className={`relative z-10 w-9 h-9 rounded-full flex items-center justify-center border-2 ${
                    reached ? "bg-sprout border-sprout text-white" : "bg-white border-ink/15 text-ink/30"
                  }`}
                >
                  <Icon size={16} />
                </div>
                <p className={`text-xs mt-2 font-medium ${reached ? "text-ink" : "text-ink/40"}`}>{s.label}</p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-8 bg-white border border-ink/10 rounded-2xl p-5 w-full max-w-sm text-left shadow-sm">
        <p className="text-xs font-semibold text-ink mb-2">Your order</p>
        <div className="grid gap-1 text-sm">
          {order.items?.map((it) => (
            <div key={it.name + it.quantity} className="flex justify-between text-ink/70">
              <span>{it.name} × {it.quantity}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-clay mt-6 max-w-xs">
        Sit back and relax — once your food is on its way to the table, you'll see the bill here,
        with a chance to get a discount for sharing quick feedback.
      </p>
    </div>
  );
}

// ---------- Bill screen (shown once food is served): pick an offer or
// complete a campaign for a discount, then choose how to pay ----------

function BillScreen({ order, restaurant, offers, campaigns, payment, sessionId, onFinalized }) {
  const [selectedOfferId, setSelectedOfferId] = useState(null);
  // Keyed by campaign id -- a customer can complete more than one campaign
  // (e.g. the video one AND the audio one) and both discounts stack.
  const [campaignFeedbacks, setCampaignFeedbacks] = useState({});
  const [openCampaign, setOpenCampaign] = useState(null);
  const [autoTemplateId, setAutoTemplateId] = useState(null);
  const [payMethod, setPayMethod] = useState(payment.cash_enabled ? "cash" : "online_upi");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const currency = restaurant.currency;
  const subtotal = order.subtotal;
  const eligibleOffers = useMemo(() => offers.filter((o) => subtotal >= o.min_order_value), [offers, subtotal]);
  const selectedOffer = eligibleOffers.find((o) => o.id === selectedOfferId) || null;
  // A template link (/r/<slug>/edit/<id>) lands here as ?edit=<id>: open that
  // template's edit place straight away, once, when the bill screen shows.
  useEffect(() => {
    try {
      const id = new URLSearchParams(window.location.search).get("edit");
      if (!id) return;
      const c = campaigns.find((x) => x.media_type !== "audio" && (x.templates || []).some((tp) => tp.id === id && tp.active !== false && tp.scenes?.length));
      if (c) { setAutoTemplateId(id); setOpenCampaign(c); }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const completedCampaigns = campaigns.filter((c) => campaignFeedbacks[c.id]);
  const hasCampaignDiscount = completedCampaigns.length > 0;

  const roundMoney = (n) => Math.round(n);
  // Selecting any campaign discount takes priority over an "offer" (same
  // either/or rule as before), but multiple campaigns' own discounts --
  // each computed against the subtotal using that campaign's own type and
  // value, exactly as the restaurant configured it -- are added together,
  // capped so the total can never exceed the subtotal itself.
  const discount = roundMoney(
    hasCampaignDiscount
      ? Math.min(
          subtotal,
          completedCampaigns.reduce(
            (sum, c) => sum + (c.discount_type === "percent" ? (subtotal * c.discount_value) / 100 : c.discount_value),
            0
          )
        )
      : selectedOffer
      ? selectedOffer.discount_type === "percent" ? (subtotal * selectedOffer.discount_value) / 100 : selectedOffer.discount_value
      : 0
  );
  // (Tax and total are intentionally not previewed here -- the server
  // computes the trusted final figures at finalize time; the customer
  // sees those on the receipt screen right after confirming.)

  async function submitBill() {
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(`/api/orders/${order.order_number}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          offerId: hasCampaignDiscount ? null : selectedOffer?.id || null,
          campaignParticipations: hasCampaignDiscount
            ? completedCampaigns.map((c) => ({ campaignId: c.id, feedback: campaignFeedbacks[c.id] }))
            : [],
          paymentMethod: payMethod,
          sessionId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not finalize your bill.");
      onFinalized(data.order);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen pb-32 bg-paper animate-slide-in-right">
      <div className="bg-white border-b border-ink/10 px-4 py-4 sticky top-0 z-10">
        <h1 className="font-display text-lg font-bold text-ink">Your food has arrived!</h1>
        <p className="text-xs text-clay mt-0.5">#{order.order_number} · Table {order.table_number}</p>
      </div>

      <div className="px-4 pt-5">
        {(eligibleOffers.length > 0 || campaigns.length > 0) && (
          <div className="mb-5">
            <p className="text-sm font-semibold text-ink mb-2 flex items-center gap-1.5"><Tag size={15} className="text-sprout" /> Want a discount on this bill?</p>
            <p className="text-xs text-clay mb-2 -mt-1">
              {campaigns.length > 1
                ? "Pick an offer, or complete any/all of the campaigns below — campaign discounts stack."
                : "Pick at most one — offer or campaign, not both."}
            </p>
            <div className="grid gap-2">
              {eligibleOffers.map((o) => {
                const isSelected = selectedOfferId === o.id && !hasCampaignDiscount;
                return (
                  <button
                    key={o.id}
                    onClick={() => { setSelectedOfferId(isSelected ? null : o.id); }}
                    className={`text-left border rounded-2xl p-3.5 flex items-center justify-between gap-3 transition-colors ${
                      isSelected ? "border-sprout bg-sprout/5" : "border-ink/10 bg-white"
                    }`}
                  >
                    <div>
                      <p className="font-semibold text-ink text-sm">{o.title}</p>
                      <p className="text-xs text-clay mt-0.5">
                        {o.discount_type === "percent" ? `${o.discount_value}% off` : `${money(o.discount_value, currency)} off`}
                      </p>
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${isSelected ? "bg-sprout text-white" : "bg-paper text-ink/60"}`}>
                      {isSelected ? (<span className="inline-flex items-center gap-1"><CheckCheck size={13} /> Applied</span>) : "Select"}
                    </span>
                  </button>
                );
              })}

              {campaigns.map((c) => {
                const feedback = campaignFeedbacks[c.id];
                return feedback ? (
                  <div key={c.id} className="text-left border border-sprout bg-sprout/5 rounded-2xl p-3.5 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink text-sm flex items-center gap-1.5">
                        {c.media_type === "audio" ? <Mic size={15} /> : <Video size={15} />} {c.title}
                      </p>
                      <p className="text-xs text-sprout-dark mt-0.5">
                        {c.discount_type === "percent" ? `${c.discount_value}% off` : `${money(c.discount_value, currency)} off`} applied
                      </p>
                    </div>
                    <button
                      onClick={() => setCampaignFeedbacks((prev) => { const next = { ...prev }; delete next[c.id]; return next; })}
                      className="text-xs font-semibold text-clay flex-shrink-0"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <button
                    key={c.id}
                    onClick={() => setOpenCampaign(c)}
                    className="text-left border border-ink/10 bg-white rounded-2xl p-3.5 flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="font-semibold text-ink text-sm flex items-center gap-1.5">
                        {c.media_type === "audio" ? <Mic size={15} /> : <Video size={15} />} {c.title}
                      </p>
                      <p className="text-xs text-clay mt-0.5">
                        {c.description || "Share quick feedback about your meal for a discount."}
                      </p>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-paper text-ink/60 flex-shrink-0">Participate</span>
                  </button>
                );
              })}
            </div>

            {discount > 0 && (
              <div key={hasCampaignDiscount ? completedCampaigns.map((c) => c.id).join(",") : selectedOfferId} className="mt-2.5 bg-sprout text-white rounded-2xl px-4 py-3 text-sm font-semibold flex items-center gap-2 animate-pop-in">
                <Sparkles size={16} className="flex-shrink-0" />
                {restaurant.offer_success_message || "Awesome! Your discount has been applied to this bill."}
              </div>
            )}
          </div>
        )}

        <div className="bg-white border border-ink/10 rounded-2xl p-4 text-sm mb-5 shadow-sm">
          {order.items?.map((it) => (
            <Row key={it.name} label={`${it.name} × ${it.quantity}`} value={money(it.unit_price * it.quantity, currency)} />
          ))}
          <div className="border-t border-ink/10 my-2" />
          <Row label="Subtotal" value={money(subtotal, currency)} />
          {discount > 0 && <Row label="Discount" value={"− " + money(discount, currency)} />}
          <p className="text-xs text-clay mt-1">Tax and any platform fee are added to your final receipt.</p>
        </div>

        <p className="text-sm font-semibold text-ink mb-2">How would you like to pay?</p>
        <div className="grid gap-2.5 mb-4">
          {payment.cash_enabled && (
            <button
              onClick={() => setPayMethod("cash")}
              className={`text-left border rounded-2xl p-4 flex items-center justify-between ${
                payMethod === "cash" ? "border-sprout bg-sprout/5" : "border-ink/10 bg-white"
              }`}
            >
              <div>
                <p className="font-semibold text-ink text-sm">Pay with cash</p>
                <p className="text-xs text-clay">Pay at the table now.</p>
              </div>
              <Banknote size={22} className="text-sprout flex-shrink-0" />
            </button>
          )}
          {payment.online_enabled && (
            <button
              onClick={() => setPayMethod("online_upi")}
              className={`text-left border rounded-2xl p-4 flex items-center justify-between ${
                payMethod === "online_upi" ? "border-sprout bg-sprout/5" : "border-ink/10 bg-white"
              }`}
            >
              <div>
                <p className="font-semibold text-ink text-sm">Pay online (UPI)</p>
                <p className="text-xs text-clay">Scan the restaurant's QR to pay directly.</p>
              </div>
              <QrCode size={22} className="text-ink/60 flex-shrink-0" />
            </button>
          )}
        </div>

        {error && <p className="text-xs text-chili-dark font-medium mb-3">{error}</p>}
      </div>

      <button
        disabled={submitting}
        onClick={submitBill}
        className="fixed bottom-5 left-4 right-4 bg-sprout disabled:opacity-60 text-white rounded-2xl px-5 py-3.5 font-semibold shadow-lg"
      >
        {submitting ? "Preparing your bill..." : "Confirm & see final bill"}
      </button>

      {openCampaign && (
        <CampaignModal
          campaign={openCampaign}
          initialTemplateId={autoTemplateId}
          onClose={() => { setOpenCampaign(null); setAutoTemplateId(null); }}
          onDone={(feedback) => {
            setCampaignFeedbacks((prev) => ({ ...prev, [openCampaign.id]: feedback }));
            setSelectedOfferId(null);
            setOpenCampaign(null);
          }}
        />
      )}
    </div>
  );
}

// ---------- Receipt (after the bill is finalized: pay online now, or wait
// for staff to confirm cash) ----------

function ReceiptScreen({ order, restaurant, table, payment, onNewOrder }) {
  const [marking, setMarking] = useState(false);
  const currency = restaurant.currency;
  const isDone = order.status === "completed";

  async function markPaid() {
    setMarking(true);
    try {
      await fetch(`/api/orders/${order.order_number}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerMarkedPaid: true }),
      });
    } finally {
      setMarking(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center px-6 pt-14 pb-10 text-center bg-paper animate-slide-in-right">
      <div className="w-16 h-16 rounded-full bg-sprout/12 flex items-center justify-center mb-4 animate-rise-in">
        <CheckCircle2 size={34} className="text-sprout" />
      </div>
      <h1 className="font-display text-2xl font-bold text-ink">
        {isDone ? "All done — thank you!" : "Here's your bill"}
      </h1>
      <p className="text-ink/60 mt-1.5">#{order.order_number} · Table {table.table_number}</p>

      <div className="mt-7 bg-white border border-ink/10 rounded-2xl p-5 w-full max-w-sm text-left shadow-sm">
        <div className="grid gap-1 text-sm">
          {order.items?.map((it) => (
            <div key={it.name + it.quantity} className="flex justify-between text-ink/70">
              <span>{it.name} × {it.quantity}</span>
              <span>{money(it.unit_price * it.quantity, currency)}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-ink/10 my-3" />
        <div className="grid gap-1 text-sm text-ink/70">
          {order.discount_amount > 0 && (
            <div className="flex justify-between"><span>Discount</span><span>− {money(order.discount_amount, currency)}</span></div>
          )}
          {(order.tax_breakdown || []).map((t) => (
            <div key={t.name} className="flex justify-between">
              <span>{t.name} ({t.type === "fixed" ? "flat" : `${t.percent}%`})</span>
              <span>{money(t.amount, currency)}</span>
            </div>
          ))}
          {order.platform_fee > 0 && (
            <div className="flex justify-between"><span>Platform fee</span><span>{money(order.platform_fee, currency)}</span></div>
          )}
        </div>
        <div className="border-t border-ink/10 my-3" />
        <div className="flex justify-between font-bold text-ink">
          <span>Total</span>
          <span>{money(order.total, currency)}</span>
        </div>
      </div>

      {!isDone && order.payment_method === "online_upi" && order.payment_status !== "paid" && (
        <div className="mt-5 bg-white border border-ink/10 rounded-2xl p-5 w-full max-w-sm text-center shadow-sm">
          {payment.phonepe_qr_image_url ? (
            <img src={payment.phonepe_qr_image_url} alt="UPI QR" className="w-44 h-44 mx-auto rounded-lg" />
          ) : (
            <div className="w-44 h-44 mx-auto rounded-lg bg-paper border border-dashed border-ink/20 flex items-center justify-center text-clay text-xs px-4">
              Restaurant hasn't uploaded a payment QR yet — ask staff for their UPI ID.
            </div>
          )}
          <p className="mt-3 text-sm font-semibold text-ink">Pay {money(order.total, currency)}</p>
          {payment.upi_id && <p className="text-xs text-clay mt-0.5">UPI ID: {payment.upi_id}</p>}
          {order.payment_status !== "pending_confirmation" ? (
            <button
              onClick={markPaid}
              disabled={marking}
              className="mt-4 w-full bg-sprout disabled:opacity-60 text-white font-semibold py-2.5 rounded-xl text-sm"
            >
              {marking ? "Marking..." : "I've completed the payment via UPI"}
            </button>
          ) : (
            <p className="text-xs text-sprout-dark font-semibold mt-4">Marked as paid — waiting for staff to confirm.</p>
          )}
        </div>
      )}

      {!isDone && order.payment_method === "cash" && (
        <p className="text-sm text-clay mt-5 max-w-xs">Please pay the staff at your table with cash.</p>
      )}

      {isDone && (
        <button onClick={onNewOrder} className="mt-8 text-sprout-dark font-semibold text-sm">
          Order something else
        </button>
      )}

      {!isDone && (
        <p className="text-xs text-clay mt-6">This page updates automatically once staff confirm your payment.</p>
      )}

      {(restaurant.instagram_url || restaurant.google_review_url) && (
        <div className="mt-8 flex items-center justify-center gap-3">
          {restaurant.google_review_url && (
            <a
              href={restaurant.google_review_url}
              target="_blank"
              rel="noreferrer"
              aria-label="Review us on Google"
              className="w-10 h-10 rounded-full bg-white border border-ink/10 shadow-sm flex items-center justify-center"
            >
              <GoogleG size={18} />
            </a>
          )}
          {restaurant.instagram_url && (
            <a
              href={restaurant.instagram_url}
              target="_blank"
              rel="noreferrer"
              aria-label="Visit our Instagram"
              className="w-10 h-10 rounded-full bg-white border border-ink/10 shadow-sm flex items-center justify-center text-ink/70"
            >
              <Instagram size={18} />
            </a>
          )}
        </div>
      )}
    </div>
  );
}

// ---------- Campaign (video or audio feedback, completed after the meal;
// discount applies to THIS order's final bill) ----------

function CampaignModal({ campaign, initialTemplateId = null, onClose, onDone }) {
  const [step, setStep] = useState("terms"); // terms -> feedback
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedInsta, setAgreedInsta] = useState(false);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  // Finished-video path (own upload, or one of the restaurant's ready-made files)
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreviewName, setMediaPreviewName] = useState("");
  const [selectedTemplateUrl, setSelectedTemplateUrl] = useState(null);
  // Edit-place path (a scene template the customer fills with their own clips)
  const [chosenTemplate, setChosenTemplate] = useState(null);
  const [drafts, setDrafts] = useState([]);
  const draftsRef = useRef([]);
  draftsRef.current = drafts;
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");

  const isAudio = campaign.media_type === "audio";
  const MAX_MEDIA_BYTES = 200 * 1024 * 1024; // 200MB, whole-video upload
  const MAX_CLIP_BYTES = 100 * 1024 * 1024; // 100MB per clip in the edit place

  // Scene templates the restaurant has switched on.
  const sceneTemplates = useMemo(
    () => (isAudio ? [] : (campaign.templates || []).filter((t) => t.active !== false && t.scenes?.length)),
    [campaign, isAudio]
  );
  // Ready-made video files (older style): plain URLs or {url, active}.
  const legacyTemplates = useMemo(() => {
    if (isAudio) return [];
    return (campaign.template_videos || [])
      .map((t) => (typeof t === "string" ? { url: t, active: true } : t))
      .filter((t) => t.active !== false);
  }, [campaign, isAudio]);
  const hasPreset = sceneTemplates.length > 0 || legacyTemplates.length > 0;

  // Free the temporary preview URLs of picked clips when the modal closes.
  useEffect(() => () => {
    draftsRef.current.forEach((d) => d.previewUrl && URL.revokeObjectURL(d.previewUrl));
  }, []);

  function handleMedia(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_MEDIA_BYTES) {
      setError("That file is too large (max 200MB). Please choose a shorter clip or lower quality.");
      e.target.value = "";
      return;
    }
    setError("");
    setSelectedTemplateUrl(null);
    setChosenTemplate(null);
    setMediaPreviewName(file.name);
    const reader = new FileReader();
    reader.onload = () => setMediaFile(reader.result);
    reader.readAsDataURL(file);
  }

  function pickLegacyTemplate(url) {
    setSelectedTemplateUrl(url);
    setMediaFile(null);
    setMediaPreviewName("");
    setChosenTemplate(null);
    setError("");
  }

  function chooseTemplate(t) {
    setChosenTemplate(t);
    setSelectedTemplateUrl(null);
    setMediaFile(null);
    setMediaPreviewName("");
    setError("");
    setDrafts(
      t.scenes.map((s) => ({
        id: s.id,
        caption: s.caption || "",
        duration: s.duration || 4,
        transition: s.transition || "fade",
        clientMedia: s.media || "",
        clientMediaType: s.mediaType || "",
        file: null,
        previewUrl: "",
        mediaType: "",
      }))
    );
  }

  // Arrived through a template link: load that template as soon as the
  // customer has accepted the terms and reached the edit place.
  const autoPicked = useRef(false);
  useEffect(() => {
    if (step !== "feedback" || !initialTemplateId || autoPicked.current) return;
    const tpl = sceneTemplates.find((x) => x.id === initialTemplateId);
    autoPicked.current = true;
    if (tpl) chooseTemplate(tpl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, initialTemplateId]);

  function leaveTemplate() {
    drafts.forEach((d) => d.previewUrl && URL.revokeObjectURL(d.previewUrl));
    setChosenTemplate(null);
    setDrafts([]);
  }

  function setDraftClip(idx, file) {
    if (!file) return;
    if (file.size > MAX_CLIP_BYTES) {
      setError("That clip is too large (max 100MB). Try a shorter one.");
      return;
    }
    setError("");
    setDrafts((prev) =>
      prev.map((d, i) => {
        if (i !== idx) return d;
        if (d.previewUrl) URL.revokeObjectURL(d.previewUrl);
        return { ...d, file, previewUrl: URL.createObjectURL(file), mediaType: file.type.startsWith("video/") ? "video" : "image" };
      })
    );
  }

  function clearDraftClip(idx) {
    setDrafts((prev) =>
      prev.map((d, i) => {
        if (i !== idx) return d;
        if (d.previewUrl) URL.revokeObjectURL(d.previewUrl);
        return { ...d, file: null, previewUrl: "", mediaType: "" };
      })
    );
  }

  function updateDraftCaption(idx, caption) {
    setDrafts((prev) => prev.map((d, i) => (i === idx ? { ...d, caption } : d)));
  }

  function readAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function uploadDataUrl(dataUrl, maxBytes) {
    const upRes = await fetch("/api/uploads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataUrl, maxBytes }),
    });
    const upData = await upRes.json();
    if (!upRes.ok) throw new Error(upData.error);
    return upData.url;
  }

  async function submit() {
    setError("");
    const usingScenes = !!chosenTemplate;
    const hasOwnMedia = usingScenes ? drafts.some((d) => d.file) : !!(mediaFile || selectedTemplateUrl);
    if (campaign.requires_video && !hasOwnMedia) {
      setError(
        isAudio ? "Please attach a short voice note to continue."
        : usingScenes ? "Add at least one of your own clips or photos to the template."
        : hasPreset ? "Pick a template (or upload your own video) to continue."
        : "Please attach a short video to continue."
      );
      return;
    }
    if (!customerName.trim()) {
      setError("Please enter your name so the restaurant knows who this is from.");
      return;
    }
    setSubmitting(true);
    try {
      let mediaUrl = selectedTemplateUrl || "";
      let scenes = [];

      if (usingScenes) {
        const own = drafts.filter((d) => d.file);
        let n = 0;
        const uploaded = [];
        for (const d of drafts) {
          if (d.file) {
            n += 1;
            setProgress(`Uploading clip ${n} of ${own.length}...`);
            const url = await uploadDataUrl(await readAsDataUrl(d.file), MAX_CLIP_BYTES);
            uploaded.push({ media: url, mediaType: d.mediaType });
            if (!mediaUrl) mediaUrl = url;
          } else {
            uploaded.push({ media: d.clientMedia, mediaType: d.clientMediaType });
          }
        }
        scenes = drafts.map((d, i) => ({
          caption: d.caption,
          duration: d.duration,
          transition: d.transition,
          media: uploaded[i].media,
          mediaType: uploaded[i].mediaType,
        }));
      } else if (mediaFile) {
        setProgress("Uploading...");
        mediaUrl = await uploadDataUrl(mediaFile, MAX_MEDIA_BYTES);
      }

      onDone({
        rating,
        textFeedback: text,
        mediaUrl,
        templateName: chosenTemplate ? chosenTemplate.name || "" : "",
        scenes,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        agreedToSubmitContent: agreedTerms,
        agreedToInstagramUse: campaign.allow_instagram_repost ? agreedInsta : undefined,
      });
    } catch (e) {
      setError(e.message || "Something went wrong.");
    } finally {
      setSubmitting(false);
      setProgress("");
    }
  }

  const previewScenes = drafts.map((d) => ({
    media: d.previewUrl || d.clientMedia,
    mediaType: d.previewUrl ? d.mediaType : d.clientMediaType,
    caption: d.caption,
    duration: d.duration,
    transition: d.transition,
  }));

  return (
    <div className="fixed inset-0 z-50 bg-ink/50 flex items-end" onClick={onClose}>
      <div className="bg-paper w-full rounded-t-3xl max-h-[92vh] overflow-y-auto p-5 animate-rise-in" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-bold text-ink">{campaign.title}</h2>
          <button onClick={onClose} className="text-ink/50 hover:text-ink transition-colors p-1"><X size={20} /></button>
        </div>

        {step === "terms" && (
          <>
            <div className="bg-white border border-ink/10 rounded-card p-4 text-xs text-ink/70 max-h-40 overflow-y-auto">
              {campaign.terms_text ||
                "By submitting, you agree to share honest feedback about your order. We're not asking for a positive review — just your real experience."}
            </div>
            <label className="flex items-start gap-2 text-sm text-ink mt-4">
              <input type="checkbox" className="mt-0.5" checked={agreedTerms} onChange={(e) => setAgreedTerms(e.target.checked)} />
              I agree to the campaign terms and understand what content I'm submitting and how it may be used.
            </label>
            {!!campaign.allow_instagram_repost && (
              <label className="flex items-start gap-2 text-sm text-ink mt-3">
                <input type="checkbox" className="mt-0.5" checked={agreedInsta} onChange={(e) => setAgreedInsta(e.target.checked)} />
                Separately, I'm okay with this restaurant reposting my content on Instagram/social media.
              </label>
            )}
            <button
              disabled={!agreedTerms}
              onClick={() => setStep("feedback")}
              className="mt-5 w-full bg-sprout disabled:bg-ink/20 text-white font-semibold py-3 rounded-card"
            >
              Continue
            </button>
          </>
        )}

        {step === "feedback" && (
          <>
            <p className="text-sm font-semibold text-ink mb-1.5">How was your experience? (honest feedback welcome)</p>
            <div className="flex gap-1 mb-3">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => setRating(n)} className="transition-transform hover:scale-110">
                  <Star size={26} className={n <= rating ? "fill-turmeric text-turmeric" : "text-clay-light"} />
                </button>
              ))}
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Tell us what you liked or what we can improve..."
              rows={3}
              className="w-full bg-white border border-ink/10 rounded-card px-3.5 py-2.5 text-sm outline-none focus:border-sprout"
            />

            {/* ---- Template picker ---- */}
            {sceneTemplates.length > 0 && !chosenTemplate && (
              <div className="mt-4">
                <p className="text-sm font-semibold text-ink mb-1.5">Make your video — pick a template</p>
                <p className="text-xs text-clay -mt-1 mb-2.5">Open one, add your own clips to its scenes, and send it to the restaurant.</p>
                <div className="grid gap-2">
                  {sceneTemplates.map((t, i) => (
                    <button
                      key={t.id || i}
                      onClick={() => chooseTemplate(t)}
                      className="text-left bg-white border border-ink/10 rounded-2xl p-3.5 flex items-center gap-3 hover:border-sprout/50 transition-colors"
                    >
                      <span className="w-10 h-10 rounded-xl bg-sprout/10 flex items-center justify-center flex-shrink-0">
                        <Video size={18} className="text-sprout-dark" />
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block font-semibold text-ink text-sm truncate">{t.name || `Template ${i + 1}`}</span>
                        <span className="block text-xs text-clay">
                          {t.scenes.length} scene{t.scenes.length === 1 ? "" : "s"}{t.description ? ` · ${t.description}` : ""}
                        </span>
                      </span>
                      <ArrowRight size={16} className="text-ink/40 flex-shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ---- The edit place ---- */}
            {chosenTemplate && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-ink">{chosenTemplate.name || "Your video"}</p>
                  <button onClick={leaveTemplate} className="text-xs font-semibold text-sprout-dark">Change template</button>
                </div>
                {chosenTemplate.description && <p className="text-xs text-clay mb-3">{chosenTemplate.description}</p>}

                <div className="flex justify-center mb-4">
                  <TemplatePlayer scenes={previewScenes} width={170} />
                </div>

                <div className="grid gap-2.5">
                  {drafts.map((d, i) => {
                    const shown = d.previewUrl || d.clientMedia;
                    const shownType = d.previewUrl ? d.mediaType : d.clientMediaType;
                    return (
                      <div key={d.id || i} className="bg-white border border-ink/10 rounded-2xl p-3.5">
                        <p className="text-xs font-semibold text-ink mb-2">Scene {i + 1}</p>
                        <div className="flex items-start gap-3">
                          <div className="w-16 h-16 rounded-xl bg-paper border border-ink/10 overflow-hidden flex items-center justify-center flex-shrink-0">
                            {shown && shownType === "video" ? (
                              <video src={shown} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                            ) : shown ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={shown} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <Video size={18} className="text-clay" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap gap-1.5">
                              <label className="text-xs font-semibold bg-sprout text-white px-3 py-1.5 rounded-full cursor-pointer">
                                {d.file ? "Change" : "Upload"}
                                <input type="file" accept="video/*,image/*" className="hidden"
                                  onChange={(e) => { setDraftClip(i, e.target.files?.[0]); e.target.value = ""; }} />
                              </label>
                              <label className="text-xs font-semibold border border-ink/15 text-ink/70 px-3 py-1.5 rounded-full cursor-pointer">
                                Record
                                <input type="file" accept="video/*" capture="environment" className="hidden"
                                  onChange={(e) => { setDraftClip(i, e.target.files?.[0]); e.target.value = ""; }} />
                              </label>
                              {d.file && (
                                <button onClick={() => clearDraftClip(i)} className="text-xs font-semibold text-clay px-2 py-1.5">Remove</button>
                              )}
                            </div>
                            <p className="text-[11px] text-clay mt-1.5">
                              {d.file ? "Your clip" : d.clientMedia ? "The restaurant's shot — add yours to replace it" : "Add your clip or photo"}
                            </p>
                          </div>
                        </div>
                        <input
                          value={d.caption}
                          onChange={(e) => updateDraftCaption(i, e.target.value)}
                          maxLength={140}
                          placeholder="Caption"
                          className="mt-2.5 w-full bg-paper border border-ink/10 rounded-xl px-3 py-2 text-sm outline-none focus:border-sprout"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ---- Ready-made videos / own upload (finished video) ---- */}
            {!chosenTemplate && legacyTemplates.length > 0 && (
              <>
                <p className="text-sm font-semibold text-ink mt-4 mb-1.5">Or use a ready-made video</p>
                <div className="grid grid-cols-3 gap-2">
                  {legacyTemplates.map((t, idx) => {
                    const isSelected = selectedTemplateUrl === t.url;
                    return (
                      <button
                        key={idx}
                        onClick={() => pickLegacyTemplate(t.url)}
                        className={`relative rounded-lg overflow-hidden border-2 ${isSelected ? "border-sprout" : "border-transparent"}`}
                      >
                        <video src={t.url} className="w-full h-20 object-cover bg-ink/5" muted playsInline preload="metadata" />
                        {isSelected && (
                          <span className="absolute inset-0 bg-sprout/25 flex items-center justify-center">
                            <CheckCircle2 size={22} className="text-white drop-shadow" />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {!chosenTemplate && (
              hasPreset ? (
                <label className="flex items-center gap-2 text-xs text-clay mt-3">
                  <span>Prefer to send a finished video of your own?</span>
                  <span className="text-sprout-dark font-semibold cursor-pointer underline">
                    Upload one
                    <input type="file" accept="video/*" onChange={handleMedia} className="hidden" />
                  </span>
                </label>
              ) : (
                <>
                  <p className="text-sm font-semibold text-ink mt-4 mb-1.5">
                    {campaign.requires_video
                      ? (isAudio ? "Record a short voice note" : "Upload a short video")
                      : (isAudio ? "Add a voice note (optional)" : "Upload a photo or video (optional)")}
                  </p>
                  <label className="flex items-center gap-3 border border-dashed border-ink/25 rounded-card p-3 cursor-pointer">
                    <span className="w-10 h-10 rounded-lg bg-clay-light flex items-center justify-center flex-shrink-0">
                      {mediaPreviewName ? (
                        <CheckCircle2 size={18} className="text-sprout" />
                      ) : isAudio ? (
                        <Mic size={18} className="text-clay" />
                      ) : (
                        <Video size={18} className="text-clay" />
                      )}
                    </span>
                    <span className="text-xs text-clay truncate">
                      {mediaPreviewName || (isAudio ? "Tap to record or choose a voice note" : "Tap to record or choose a video")}
                    </span>
                    <input type="file" accept={isAudio ? "audio/*" : "video/*"} onChange={handleMedia} className="hidden" />
                  </label>
                </>
              )
            )}
            {!chosenTemplate && mediaPreviewName && hasPreset && (
              <p className="text-xs text-ink/70 mt-1">Using your upload: {mediaPreviewName}</p>
            )}

            <p className="text-sm font-semibold text-ink mt-5 mb-1.5">Who's this from?</p>
            <div className="grid gap-2.5">
              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Your name"
                className="w-full bg-white border border-ink/10 rounded-card px-3.5 py-2.5 text-sm outline-none focus:border-sprout"
              />
              <input
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Phone number (optional)"
                inputMode="tel"
                className="w-full bg-white border border-ink/10 rounded-card px-3.5 py-2.5 text-sm outline-none focus:border-sprout"
              />
            </div>

            {error && <p className="text-xs text-chili-dark font-medium mt-3">{error}</p>}

            <button
              disabled={submitting}
              onClick={submit}
              className="mt-5 w-full bg-sprout disabled:opacity-60 text-white font-semibold py-3 rounded-card"
            >
              {submitting
                ? (progress || "Applying discount...")
                : `Get ${campaign.discount_type === "percent" ? campaign.discount_value + "%" : money(campaign.discount_value, "INR")} off this order`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
