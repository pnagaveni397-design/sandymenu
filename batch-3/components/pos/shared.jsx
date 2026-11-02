"use client";
import { X } from "lucide-react";

export const money = (n) => `₹${Number(n || 0).toFixed(2).replace(/\.00$/, "")}`;

export function Card({ children, className = "" }) {
  return <div className={`bg-white border border-ink/10 rounded-2xl shadow-sm ${className}`}>{children}</div>;
}

export function PageTitle({ title, subtitle, right }) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap mb-5">
      <div>
        <h2 className="font-display text-2xl font-bold text-ink">{title}</h2>
        {subtitle && <p className="text-sm text-clay mt-0.5 max-w-xl">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function Modal({ title, onClose, children, wide = false }) {
  return (
    <div className="fixed inset-0 z-[60] bg-ink/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className={`bg-paper rounded-2xl w-full ${wide ? "max-w-xl" : "max-w-md"} max-h-[92vh] overflow-y-auto p-6 animate-pop-in`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-bold text-ink">{title}</h3>
          <button onClick={onClose} className="text-clay hover:text-ink" aria-label="Close"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function TextField({ label, value, onChange, placeholder, type = "text", disabled, hint, maxLength }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-ink mb-1">{label}</label>
      <input
        type={type} value={value ?? ""} disabled={disabled} placeholder={placeholder} maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-ink/15 rounded-card px-3 py-2 text-sm bg-white disabled:bg-paper disabled:text-ink/60"
      />
      {hint && <p className="text-[11px] text-clay mt-1">{hint}</p>}
    </div>
  );
}

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// Veg / non-veg mark, like on Swiggy.
export function VegDot({ veg }) {
  const c = veg ? "border-green-600" : "border-red-600";
  const d = veg ? "bg-green-600" : "bg-red-600";
  return (
    <span className={`inline-flex w-4 h-4 border-2 ${c} rounded-sm items-center justify-center flex-shrink-0`}>
      <span className={`w-1.5 h-1.5 rounded-full ${d}`} />
    </span>
  );
}

// Picture for a category circle: first item photo, else the first item's emoji.
export function categoryVisual(cat, items) {
  const list = items.filter((i) => i.category_id === cat.id);
  const withImg = list.find((i) => i.image_url);
  return { img: withImg?.image_url || "", emoji: list[0]?.image_emoji || "🍽️" };
}
