"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChefHat, Clock, X } from "lucide-react";
import { parseDbDate } from "@/lib/clientDates";

// A short, unmistakable "new order" chime, generated in-browser — no audio
// file to host or ship. Plays even if the tab has been sitting idle.
function playChime() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [880, 1175].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const start = ctx.currentTime + i * 0.15;
      gain.gain.setValueAtTime(0.2, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
      osc.start(start);
      osc.stop(start + 0.35);
    });
  } catch {
    // Some browsers block audio before any user interaction — fine, the
    // visual flash still gets the chef's attention.
  }
}

function timeAgo(dateStr) {
  const seconds = Math.floor((Date.now() - parseDbDate(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m ago`;
}

export default function KitchenApp({ restaurant, orders: initialOrders }) {
  const [orders, setOrders] = useState(initialOrders);
  const [flash, setFlash] = useState(false);
  const [, setNow] = useState(Date.now());
  const knownIds = useRef(new Set(initialOrders.map((o) => o.id)));

  // Keep "X min ago" labels moving without waiting for a new poll.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  // Try to keep the screen from auto-locking/dimming, since this is meant
  // to stay up on a kitchen tablet all service long.
  useEffect(() => {
    let lock;
    if ("wakeLock" in navigator) {
      navigator.wakeLock.request("screen").then((l) => (lock = l)).catch(() => {});
    }
    return () => lock?.release?.().catch(() => {});
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/admin/${restaurant.slug}/orders`);
        if (!res.ok) return;
        const data = await res.json();
        const pending = data.orders
          .filter((o) => o.status === "pending" || o.status === "preparing")
          .sort((a, b) => parseDbDate(a.created_at) - parseDbDate(b.created_at));

        const newOnes = pending.filter((o) => !knownIds.current.has(o.id));
        if (newOnes.length > 0) {
          playChime();
          setFlash(true);
          setTimeout(() => setFlash(false), 1500);
        }
        knownIds.current = new Set(pending.map((o) => o.id));
        setOrders(pending);
      } catch {
        // network hiccup — try again next tick
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [restaurant.slug]);

  async function startPreparing(orderNumber) {
    setOrders((prev) => prev.map((o) => (o.order_number === orderNumber ? { ...o, status: "preparing" } : o)));
    await fetch(`/api/admin/${restaurant.slug}/orders/${orderNumber}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "preparing" }),
    }).catch(() => {});
  }

  async function markServed(orderNumber) {
    setOrders((prev) => prev.filter((o) => o.order_number !== orderNumber));
    await fetch(`/api/admin/${restaurant.slug}/orders/${orderNumber}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "served" }),
    }).catch(() => {});
  }

  return (
    <div className={`min-h-screen bg-ink transition-colors duration-300 ${flash ? "bg-herb/20" : ""}`}>
      <header className="flex items-center justify-between px-6 py-4 border-b border-paper/10">
        <div className="flex items-center gap-3">
          <ChefHat size={26} className="text-turmeric" />
          <div>
            <p className="font-display text-lg font-bold text-paper">{restaurant.name} — Kitchen</p>
            <p className="text-xs text-paper/50">{orders.length} order{orders.length === 1 ? "" : "s"} to prepare</p>
          </div>
        </div>
        <Link href={`/dashboard/${restaurant.slug}`} className="text-paper/50 hover:text-paper text-xs font-semibold flex items-center gap-1">
          <X size={14} /> Exit
        </Link>
      </header>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-center">
          <ChefHat size={56} className="text-paper/20 mb-4" />
          <p className="text-paper/40 text-lg">No pending orders — all caught up.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
          {orders.map((o) => (
            <div key={o.id} className="bg-paper rounded-2xl p-5 shadow-xl flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <p className="font-display text-2xl font-bold text-ink">Table {o.table_number || "—"}</p>
                <span className="flex items-center gap-1 text-xs font-semibold text-clay">
                  <Clock size={13} /> {timeAgo(o.created_at)}
                </span>
              </div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <p className="text-xs text-clay">#{o.order_number}</p>
                {o.status === "preparing" && (
                  <span className="text-[11px] font-bold text-chili-dark bg-turmeric/25 px-2 py-0.5 rounded-full">PREPARING</span>
                )}
              </div>
              {o.customer_name && (
                <p className="text-sm font-semibold text-sprout-dark mb-2">{o.customer_name}{o.customer_phone ? ` · ${o.customer_phone}` : ""}</p>
              )}

              <div className="grid gap-2 flex-1">
                {o.items.map((it) => (
                  <div key={it.id} className="flex items-baseline justify-between">
                    <span className="text-lg font-semibold text-ink">{it.name}</span>
                    <span className="text-lg font-bold text-chili-dark ml-3 flex-shrink-0">×{it.quantity}</span>
                  </div>
                ))}
              </div>

              {o.customer_note && (
                <p className="text-sm text-chili-dark bg-chili/10 rounded-card px-3 py-2 mt-3">
                  Note: {o.customer_note}
                </p>
              )}

              {o.status === "pending" ? (
                <button
                  onClick={() => startPreparing(o.order_number)}
                  className="mt-4 bg-turmeric hover:bg-turmeric/90 transition-colors text-ink font-bold py-3 rounded-card text-base"
                >
                  Start Preparing
                </button>
              ) : (
                <button
                  onClick={() => markServed(o.order_number)}
                  className="mt-4 bg-herb hover:bg-herb/90 transition-colors text-white font-bold py-3 rounded-card text-base"
                >
                  Mark Served
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
