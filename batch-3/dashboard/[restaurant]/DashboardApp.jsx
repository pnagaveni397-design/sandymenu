"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Monogram from "@/components/Monogram";
import TemplatePlayer, { TEMPLATE_EFFECTS, SCENE_COLORS } from "@/components/TemplatePlayer";
import { parseDbDate } from "@/lib/clientDates";
import {
  Eye, Bell, CreditCard, Check, Camera, Video, Star, QrCode,
  Smartphone, RefreshCw, ExternalLink, Printer, Upload, ChefHat,
  Mic, Plus, Trash2, Sparkles, ChevronUp, ChevronDown,
  ClipboardList, UtensilsCrossed, Tag, Percent, Receipt, Menu as MenuIcon,
} from "lucide-react";

const TABS = [
  { name: "Orders", icon: ClipboardList },
  { name: "Menu", icon: UtensilsCrossed },
  { name: "Offers", icon: Tag },
  { name: "Campaigns", icon: Video },
  { name: "Taxes", icon: Percent },
  { name: "Tables & QR", icon: QrCode },
  { name: "Customer View", icon: Eye },
  { name: "Payment settings", icon: CreditCard },
  { name: "Billing", icon: Receipt },
];
const STATUS_FLOW = ["pending", "preparing", "served", "completed"];
const SPICE_LEVELS = ["none", "mild", "medium", "hot"];

function money(n, currency = "INR") {
  const symbol = currency === "INR" ? "₹" : currency + " ";
  return `${symbol}${Math.round(n)}`;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function DashboardApp({
  restaurant: initialRestaurant, categories: initialCategories, items: initialItems, tables: initialTables,
  offers: initialOffers, orders: initialOrders, paymentSettings: initialPaymentSettings, subscription, totals,
  campaigns: initialCampaigns, reviews: initialReviews, userName, taxes: initialTaxes, platformContact,
  paymentProofs: initialPaymentProofs,
}) {
  const router = useRouter();
  const [restaurant, setRestaurant] = useState(initialRestaurant);
  const [tab, setTab] = useState("Orders");
  const [orders, setOrders] = useState(initialOrders);
  const [items, setItems] = useState(initialItems);
  const [categories, setCategories] = useState(initialCategories);
  const [tables, setTables] = useState(initialTables);
  const [offers, setOffers] = useState(initialOffers);
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [taxes, setTaxes] = useState(initialTaxes);
  const [reviews, setReviews] = useState(initialReviews);
  const [paymentSettings, setPaymentSettings] = useState(initialPaymentSettings);
  const [paymentProofs, setPaymentProofs] = useState(initialPaymentProofs || []);
  const [paymentModalOpen, setPaymentModalOpen] = useState(restaurant.status === "pending_payment");
  const [confirmDialog, setConfirmDialog] = useState(null); // { message, onConfirm } | null
  const [newOrderToast, setNewOrderToast] = useState(null);
  const previewTableNumber = tables.find((t) => t.active)?.table_number || tables[0]?.table_number;

  function askConfirm(message, onConfirm) {
    setConfirmDialog({ message, onConfirm });
  }

  useEffect(() => {
    // Fast polling rather than a streaming connection — this is the more
    // reliable choice across dev/production, corporate networks, and
    // reverse proxies that don't forward Server-Sent Events cleanly. Every
    // 2 seconds is fast enough to feel immediate without any streaming
    // infrastructure that could silently fail on some setups.
    let previousOrderNumbers = new Set(orders.map((o) => o.order_number));

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/admin/${restaurant.slug}/orders`);
        if (!res.ok) return;
        const { orders: fresh } = await res.json();

        const freshNumbers = new Set(fresh.map((o) => o.order_number));
        const newOnes = fresh.filter((o) => !previousOrderNumbers.has(o.order_number));
        if (newOnes.length > 0) {
          setNewOrderToast(newOnes[0]);
          // Popup shows briefly, then goes away on its own.
          setTimeout(() => setNewOrderToast((cur) => (cur === newOnes[0] ? null : cur)), 3000);
        }
        previousOrderNumbers = freshNumbers;
        setOrders(fresh);
      } catch {
        // network hiccup — just try again next tick
      }
    }, 2000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant.slug]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <main className="min-h-screen bg-paper">
      <header className="bg-white border-b border-ink/10 px-6 py-5">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {restaurant.logo_image_url ? (
              <img src={restaurant.logo_image_url} className="w-11 h-11 rounded-xl object-cover ring-2 ring-sprout/15" alt="" />
            ) : (
              <Monogram name={restaurant.name} size="sm" className="w-11 h-11 text-base" />
            )}
            <div>
              <p className="font-display font-bold text-ink leading-tight">{restaurant.name}</p>
              <p className="text-xs text-clay">{userName ? `Signed in as ${userName}` : "Restaurant dashboard"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={`/dashboard/${restaurant.slug}/kitchen`}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold bg-sprout/10 text-sprout-dark px-3.5 py-2 rounded-full hover:bg-sprout/20 transition-colors inline-flex items-center gap-1.5"
              title="Open this on a kitchen tablet/screen — live order tickets, no email needed"
            >
              <ChefHat size={14} /> Kitchen Display
            </a>
            {previewTableNumber && (
              <a
                href={`/r/${restaurant.slug}/table/${previewTableNumber}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold bg-paper text-ink border border-ink/10 px-3.5 py-2 rounded-full hover:bg-ink/5 transition-colors inline-flex items-center gap-1.5"
              >
                <Eye size={14} /> View customer menu
              </a>
            )}
            <StatusPill status={restaurant.status} />
            <button onClick={logout} className="text-xs font-medium text-clay hover:text-ink transition-colors">
              Log out
            </button>
          </div>
        </div>
      </header>

      {restaurant.status === "pending_payment" && !paymentModalOpen && (
        <div className="bg-turmeric/20 border-b border-turmeric/40 px-6 py-2.5">
          <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs font-medium text-chili-dark">
              Your subscription payment is due to keep TableServe active.
            </p>
            <button onClick={() => setPaymentModalOpen(true)} className="text-xs font-semibold text-chili-dark underline">
              View payment details
            </button>
          </div>
        </div>
      )}

      {paymentModalOpen && (
        <PaymentDueModal
          subscription={subscription}
          platformContact={platformContact}
          onClose={() => setPaymentModalOpen(false)}
        />
      )}

      {/* Left sidebar for navigation on wider screens; a horizontal
          scrollable strip of the same items on narrow ones. Clicking an
          item shows its content in the panel next to (or below) it. */}
      <div className="max-w-[1600px] mx-auto px-6 py-6 flex gap-6 items-start">
        <aside className="hidden md:block w-56 flex-shrink-0 sticky top-6">
          <nav className="bg-white border border-ink/10 rounded-2xl p-2">
            {TABS.map(({ name, icon: Icon }) => {
              const isActive = tab === name;
              return (
                <button
                  key={name}
                  onClick={() => setTab(name)}
                  className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm transition-colors text-left ${
                    isActive ? "bg-sprout/10 text-sprout-dark font-semibold" : "text-ink/60 hover:bg-paper hover:text-ink font-medium"
                  }`}
                >
                  <Icon size={16} className="flex-shrink-0" />
                  {name}
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="flex-1 min-w-0">
          <div className="md:hidden overflow-x-auto no-scrollbar -mx-6 px-6 pb-4 flex gap-2">
            {TABS.map(({ name, icon: Icon }) => {
              const isActive = tab === name;
              return (
                <button
                  key={name}
                  onClick={() => setTab(name)}
                  className={`flex-shrink-0 inline-flex items-center gap-1.5 whitespace-nowrap px-3.5 py-2 rounded-full text-xs font-semibold border ${
                    isActive ? "bg-sprout text-white border-sprout" : "bg-white text-ink/60 border-ink/10"
                  }`}
                >
                  <Icon size={13} /> {name}
                </button>
              );
            })}
          </div>

          {tab === "Orders" && <OrdersTab restaurant={restaurant} orders={orders} setOrders={setOrders} askConfirm={askConfirm} paymentSettings={paymentSettings} />}
          {tab === "Menu" && (
            <MenuTab restaurant={restaurant} categories={categories} setCategories={setCategories} items={items} setItems={setItems} askConfirm={askConfirm} />
          )}
          {tab === "Offers" && <OffersTab restaurant={restaurant} offers={offers} setOffers={setOffers} askConfirm={askConfirm} />}
          {tab === "Campaigns" && (
            <CampaignsTab restaurant={restaurant} campaigns={campaigns} setCampaigns={setCampaigns} reviews={reviews} setReviews={setReviews} askConfirm={askConfirm} />
          )}
          {tab === "Taxes" && <TaxesTab restaurant={restaurant} taxes={taxes} setTaxes={setTaxes} askConfirm={askConfirm} />}
          {tab === "Tables & QR" && <TablesTab restaurant={restaurant} tables={tables} setTables={setTables} />}
          {tab === "Customer View" && <CustomerViewTab restaurant={restaurant} tables={tables} onRestaurantUpdate={setRestaurant} />}
          {tab === "Payment settings" && (
            <PaymentSettingsTab restaurant={restaurant} paymentSettings={paymentSettings} setPaymentSettings={setPaymentSettings} />
          )}
          {tab === "Billing" && (
            <BillingTab
              restaurant={restaurant}
              subscription={subscription}
              platformContact={platformContact}
              orders={orders}
              paymentProofs={paymentProofs}
              setPaymentProofs={setPaymentProofs}
            />
          )}
        </div>
      </div>

      {newOrderToast && (
        <div className="fixed top-4 right-4 z-[70] bg-ink text-paper rounded-2xl px-5 py-3.5 shadow-2xl animate-rise-in max-w-xs flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-chili/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Bell size={16} className="text-turmeric" />
          </div>
          <div>
            <p className="font-semibold text-sm">New order #{newOrderToast.order_number}</p>
            <p className="text-xs text-paper/60 mt-0.5">Table {newOrderToast.table_number} · ₹{Math.round(newOrderToast.total)}</p>
          </div>
        </div>
      )}

      {confirmDialog && (
        <ConfirmDialog
          message={confirmDialog.message}
          onCancel={() => setConfirmDialog(null)}
          onConfirm={() => {
            confirmDialog.onConfirm();
            setConfirmDialog(null);
          }}
        />
      )}
    </main>
  );
}

function ConfirmDialog({ message, onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 z-[60] bg-ink/50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-paper rounded-2xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm text-ink">{message}</p>
        <div className="flex gap-3 mt-5">
          <button onClick={onCancel} className="flex-1 border border-ink/15 text-ink font-semibold py-2.5 rounded-card">Cancel</button>
          <button onClick={onConfirm} className="flex-1 bg-chili text-white font-semibold py-2.5 rounded-card">Delete</button>
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  const map = {
    active: ["Active", "bg-sprout/15 text-sprout-dark"],
    grace_period: ["Grace period", "bg-turmeric/25 text-chili-dark"],
    pending_payment: ["Payment due", "bg-turmeric/25 text-chili-dark"],
    suspended: ["Suspended", "bg-chili/15 text-chili-dark"],
    trial: ["Free trial", "bg-ink/8 text-ink/70"],
  };
  const [label, cls] = map[status] || map.active;
  return <span className={`text-xs font-semibold px-3 py-1 rounded-full ${cls}`}>{label}</span>;
}

function PaymentDueModal({ subscription, platformContact, onClose }) {
  const amountDue = subscription?.onboarding_paid ? subscription?.monthly_fee : subscription?.onboarding_fee;
  const label = subscription?.onboarding_paid ? "Monthly subscription" : "Onboarding + first month";

  return (
    <div className="fixed inset-0 z-50 bg-ink/60 flex items-center justify-center p-4">
      <div className="bg-paper rounded-2xl w-full max-w-sm p-6 text-center">
        <div className="w-14 h-14 rounded-full bg-turmeric/20 flex items-center justify-center mx-auto mb-3">
          <CreditCard size={26} className="text-chili-dark" />
        </div>
        <h2 className="font-display text-lg font-bold text-ink">Subscription payment due</h2>
        <p className="text-sm text-ink/70 mt-2">
          Your free trial has ended. Pay {label.toLowerCase()} — <strong>₹{amountDue}</strong> — to
          keep your QR menu and ordering live.
        </p>

        {platformContact?.phonepe_qr_image_url ? (
          <img src={platformContact.phonepe_qr_image_url} alt="Pay via UPI" className="w-40 h-40 mx-auto rounded-lg mt-5" />
        ) : (
          <div className="w-40 h-40 mx-auto rounded-lg bg-white border border-dashed border-ink/20 flex items-center justify-center text-xs text-clay mt-5 px-4">
            QR not uploaded yet
          </div>
        )}

        {platformContact?.phone && (
          <p className="mt-3 text-sm text-ink">
            Or call/WhatsApp <strong>{platformContact.phone}</strong> to arrange payment.
          </p>
        )}

        <p className="text-xs text-clay mt-4">
          Once you've paid, contact us using the number above — we'll confirm and activate your
          account from our side.
        </p>

        <button onClick={onClose} className="mt-5 w-full border border-ink/15 text-ink font-semibold py-2.5 rounded-card">
          I'll pay later
        </button>
      </div>
    </div>
  );
}

function Card({ children, className = "" }) {
  return <div className={`bg-white border border-ink/10 rounded-2xl shadow-sm ${className}`}>{children}</div>;
}

// ---------- Orders ----------

function OrdersTab({ restaurant, orders, setOrders, askConfirm }) {
  // Computed live from the (polled) orders list instead of a one-time
  // server-rendered snapshot, so these numbers update within a couple of
  // seconds of a new order coming in or one being deleted — no page
  // refresh needed.
  const totals = useMemo(() => {
    let totalSales = 0, cashOrders = 0, onlineOrders = 0;
    for (const o of orders) {
      totalSales += o.total;
      if (o.payment_method === "cash") cashOrders += 1;
      else if (o.payment_method === "online_upi") onlineOrders += 1;
    }
    return { totalOrders: orders.length, totalSales, cashOrders, onlineOrders };
  }, [orders]);

  // Bulk delete — either clear everything in one go, or switch into
  // "select" mode and check off specific orders (useful for clearing out
  // test orders without hunting for each Delete button one at a time).
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState(() => new Set());

  function toggleSelectMode() {
    setSelectMode((v) => !v);
    setSelected(new Set());
  }
  function toggleSelected(orderNumber) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(orderNumber)) next.delete(orderNumber);
      else next.add(orderNumber);
      return next;
    });
  }
  function selectAll() {
    setSelected(new Set(orders.map((o) => o.order_number)));
  }
  function clearSelection() {
    setSelected(new Set());
  }

  async function deleteAllOrders() {
    if (orders.length === 0) return;
    askConfirm(`Delete all ${orders.length} order(s) from your history? This can't be undone.`, async () => {
      const res = await fetch(`/api/admin/${restaurant.slug}/orders`, {
        method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ all: true }),
      });
      if (res.ok) {
        setOrders([]);
        setSelectMode(false);
        setSelected(new Set());
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Could not delete orders. Please try again.");
      }
    });
  }

  async function deleteSelectedOrders() {
    if (selected.size === 0) return;
    const orderNumbers = Array.from(selected);
    askConfirm(`Delete ${orderNumbers.length} selected order(s)? This can't be undone.`, async () => {
      const res = await fetch(`/api/admin/${restaurant.slug}/orders`, {
        method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderNumbers }),
      });
      if (res.ok) {
        setOrders((prev) => prev.filter((o) => !selected.has(o.order_number)));
        setSelectMode(false);
        setSelected(new Set());
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Could not delete the selected orders. Please try again.");
      }
    });
  }

  async function updateStatus(orderNumber, status) {
    const res = await fetch(`/api/admin/${restaurant.slug}/orders/${orderNumber}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const data = await res.json();
      setOrders((prev) => prev.map((o) => (o.order_number === orderNumber ? { ...o, ...data.order } : o)));
    }
  }
  async function confirmPayment(orderNumber) {
    const res = await fetch(`/api/admin/${restaurant.slug}/orders/${orderNumber}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ payment_status: "paid" }),
    });
    if (res.ok) {
      const data = await res.json();
      setOrders((prev) => prev.map((o) => (o.order_number === orderNumber ? { ...o, ...data.order } : o)));
    }
  }
  async function deleteOrder(orderNumber) {
    askConfirm(`Delete order #${orderNumber} from your history? This can't be undone.`, async () => {
      const res = await fetch(`/api/admin/${restaurant.slug}/orders/${orderNumber}`, { method: "DELETE" });
      if (res.ok) {
        setOrders((prev) => prev.filter((o) => o.order_number !== orderNumber));
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Could not delete this order. Please try again.");
      }
    });
  }
  // Alternative to email notifications: print (or just view, on a phone) a
  // clean receipt for an order and hand it straight to the kitchen. Useful
  // any time email delivery isn't set up or isn't working.
  function printReceipt(order) {
    const itemsHtml = order.items
      .map(
        (it) =>
          `<tr><td style="padding:4px 0">${it.name} × ${it.quantity}</td><td style="padding:4px 0;text-align:right">${money(
            it.unit_price * it.quantity,
            restaurant.currency
          )}</td></tr>`
      )
      .join("");

    // Full breakdown — subtotal, discount, every tax line, and the
    // platform fee — not just the final total. A receipt that only shows
    // items + total looks like a math error the moment tax or a discount
    // is involved; showing every line is what makes the total make sense.
    const taxBreakdown = Array.isArray(order.tax_breakdown) ? order.tax_breakdown : [];
    const breakdownRows = [
      `<tr><td style="padding:2px 0">Subtotal</td><td style="padding:2px 0;text-align:right">${money(order.subtotal, restaurant.currency)}</td></tr>`,
      order.discount_amount > 0
        ? `<tr><td style="padding:2px 0">Discount</td><td style="padding:2px 0;text-align:right">− ${money(order.discount_amount, restaurant.currency)}</td></tr>`
        : "",
      ...taxBreakdown.map(
        (t) =>
          `<tr><td style="padding:2px 0">${t.name} (${t.type === "fixed" ? "flat" : t.percent + "%"})</td><td style="padding:2px 0;text-align:right">${money(t.amount, restaurant.currency)}</td></tr>`
      ),
      order.platform_fee > 0
        ? `<tr><td style="padding:2px 0">Platform fee</td><td style="padding:2px 0;text-align:right">${money(order.platform_fee, restaurant.currency)}</td></tr>`
        : "",
    ].join("");

    const html = `
      <html>
        <head>
          <title>Order #${order.order_number}</title>
          <style>
            body { font-family: monospace; padding: 16px; color: #111; }
            h1 { font-size: 16px; margin: 0 0 4px; }
            p { margin: 2px 0; font-size: 13px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
            tr.total td { border-top: 1px dashed #111; padding-top: 6px; font-weight: bold; }
            hr { border: none; border-top: 1px dashed #111; margin: 10px 0; }
          </style>
        </head>
        <body>
          <h1>${restaurant.name}</h1>
          <p>Order #${order.order_number} · Table ${order.table_number || ""}</p>
          ${order.customer_name ? `<p>${order.customer_name}${order.customer_phone ? " · " + order.customer_phone : ""}</p>` : ""}
          <p>${parseDbDate(order.created_at).toLocaleString()}</p>
          <hr />
          <table>
            ${itemsHtml}
          </table>
          <hr />
          <table>
            ${breakdownRows}
            <tr class="total"><td>Total</td><td style="text-align:right">${money(order.total, restaurant.currency)}</td></tr>
          </table>
          <hr />
          <p>Payment: ${order.payment_method ? order.payment_method.replace("_", " ") + " (" + order.payment_status.replace("_", " ") + ")" : "not yet billed"}</p>
          ${order.customer_note ? `<p>Note: ${order.customer_note}</p>` : ""}
        </body>
      </html>
    `;

    // Opening a blank popup and then navigating it to a blob: URL (the old
    // approach) is blocked by current Chrome/Edge as a cross-context blob
    // navigation -- the popup opens but is left stuck on "about:blank" with
    // no error shown, which is exactly the "Receipt isn't showing" bug.
    // A hidden same-page <iframe> with its content set via srcdoc sidesteps
    // that entirely: no popup, no popup blocker, no blob navigation, so it
    // renders and prints reliably everywhere, phones included.
    let frame = document.getElementById("receipt-print-frame");
    if (!frame) {
      frame = document.createElement("iframe");
      frame.id = "receipt-print-frame";
      frame.style.position = "fixed";
      frame.style.right = "0";
      frame.style.bottom = "0";
      frame.style.width = "0";
      frame.style.height = "0";
      frame.style.border = "0";
      document.body.appendChild(frame);
    }
    frame.onload = () => {
      try {
        frame.contentWindow.focus();
        frame.contentWindow.print();
      } catch (e) {
        // If printing is blocked for some reason, at least show the receipt
        // in a normal tab instead of failing silently.
        const blob = new Blob([html], { type: "text/html" });
        window.open(URL.createObjectURL(blob), "_blank");
      }
    };
    frame.srcdoc = html;
  }

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total orders" value={totals.totalOrders} />
        <StatCard label="Total sales" value={money(totals.totalSales, restaurant.currency)} />
        <StatCard label="Cash orders" value={totals.cashOrders} />
        <StatCard label="Online orders" value={totals.onlineOrders} />
      </div>

      {orders.length > 0 && (
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          {!selectMode ? (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={toggleSelectMode}
                className="text-xs font-semibold text-ink/70 border border-ink/15 px-3 py-1.5 rounded-full"
              >
                Select orders
              </button>
              <button
                onClick={deleteAllOrders}
                className="text-xs font-semibold text-chili-dark border border-chili/30 bg-chili/5 px-3 py-1.5 rounded-full"
              >
                Delete all
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-clay">{selected.size} selected</span>
              <button onClick={selectAll} className="text-xs font-semibold text-ink/70 border border-ink/15 px-3 py-1.5 rounded-full">
                Select all
              </button>
              <button onClick={clearSelection} className="text-xs font-semibold text-ink/70 border border-ink/15 px-3 py-1.5 rounded-full">
                Clear
              </button>
              <button
                onClick={deleteSelectedOrders}
                disabled={selected.size === 0}
                className="text-xs font-semibold text-white bg-chili disabled:opacity-40 px-3 py-1.5 rounded-full"
              >
                Delete selected
              </button>
              <button onClick={toggleSelectMode} className="text-xs font-semibold text-clay px-3 py-1.5 rounded-full">
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      <div className="grid gap-3">
        {orders.length === 0 && <p className="text-clay text-sm">No orders yet.</p>}
        {orders.map((o) => (
          <Card key={o.id} className="p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-start gap-3">
                {selectMode && (
                  <input
                    type="checkbox"
                    checked={selected.has(o.order_number)}
                    onChange={() => toggleSelected(o.order_number)}
                    className="mt-1 w-4 h-4 accent-chili flex-shrink-0"
                  />
                )}
                <div>
                  <p className="font-semibold text-ink">#{o.order_number} · Table {o.table_number}</p>
                  {o.customer_name && (
                    <p className="text-xs font-semibold text-sprout-dark mt-0.5">
                      {o.customer_name}{o.customer_phone ? ` · ${o.customer_phone}` : ""}
                    </p>
                  )}
                  <p className="text-xs text-clay mt-0.5">{o.items.map((it) => `${it.name} ×${it.quantity}`).join(", ")}</p>
                  <p className="text-xs text-clay mt-0.5">
                    {money(o.total, restaurant.currency)}
                    {o.payment_method ? (
                      <>
                        {" · "}{o.payment_method.replace("_", " ")}{" · "}
                        <span className={o.payment_status === "paid" ? "text-herb font-medium" : "text-chili-dark font-medium"}>
                          {o.payment_status.replace("_", " ")}
                        </span>
                      </>
                    ) : (
                      <span className="text-clay font-medium"> · awaiting bill</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {o.payment_method && o.payment_status !== "paid" && (
                  <button onClick={() => confirmPayment(o.order_number)} className="text-xs font-semibold bg-herb/15 text-herb px-3 py-1.5 rounded-full">
                    {o.payment_status === "pending_confirmation" ? "Confirm payment received" : "Mark as paid"}
                  </button>
                )}
                <select
                  value={o.status}
                  onChange={(e) => updateStatus(o.order_number, e.target.value)}
                  className="text-sm border border-ink/15 rounded-card px-2.5 py-1.5 bg-paper"
                >
                  {STATUS_FLOW.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <button
                  onClick={() => printReceipt(o)}
                  className="text-xs font-semibold text-ink/70 inline-flex items-center gap-1 border border-ink/15 px-2.5 py-1.5 rounded-full"
                  title="Print or view a receipt for the kitchen"
                >
                  <Printer size={13} /> Receipt
                </button>
                <button onClick={() => deleteOrder(o.order_number)} className="text-xs font-semibold text-chili-dark">
                  Delete
                </button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-clay">{label}</p>
      <p className="font-display text-xl font-bold text-ink mt-1">{value}</p>
    </Card>
  );
}

// ---------- Menu ----------

function MenuTab({ restaurant, categories, setCategories, items, setItems, askConfirm }) {
  const [newCategoryName, setNewCategoryName] = useState("");
  const [editingItem, setEditingItem] = useState(null); // null | 'new' | item object
  const [modalCategoryId, setModalCategoryId] = useState(null);

  async function addCategory() {
    if (!newCategoryName.trim()) return;
    const res = await fetch(`/api/admin/${restaurant.slug}/categories`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newCategoryName.trim() }),
    });
    if (res.ok) {
      const data = await res.json();
      setCategories((prev) => [...prev, data.category]);
      setNewCategoryName("");
    }
  }

  async function deleteCategory(cat) {
    askConfirm(`Delete category "${cat.name}"?`, async () => {
      const res = await fetch(`/api/admin/${restaurant.slug}/categories/${cat.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) return alert(data.error);
      setCategories((prev) => prev.filter((c) => c.id !== cat.id));
    });
  }

  async function deleteItem(item) {
    askConfirm(`Delete "${item.name}"?`, async () => {
      const res = await fetch(`/api/admin/${restaurant.slug}/menu-items/${item.id}`, { method: "DELETE" });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i.id !== item.id));
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Could not delete this item.");
      }
    });
  }

  async function toggleAvailable(item) {
    const res = await fetch(`/api/admin/${restaurant.slug}/menu-items/${item.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ available: item.available ? 0 : 1 }),
    });
    if (res.ok) setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, available: item.available ? 0 : 1 } : i)));
  }

  // Quick reorder within a category -- swaps this item's sort_order with
  // its neighbor's, so the client can decide what shows first without
  // typing numbers for every dish.
  async function moveItem(item, direction) {
    const catItems = items
      .filter((i) => i.category_id === item.category_id)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const idx = catItems.findIndex((i) => i.id === item.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= catItems.length) return;
    const other = catItems[swapIdx];
    const aOrder = item.sort_order ?? 0;
    const bOrder = other.sort_order ?? 0;
    const newAOrder = bOrder;
    const newBOrder = aOrder === bOrder ? aOrder + (direction === "up" ? -1 : 1) : aOrder;

    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, sort_order: newAOrder } : i.id === other.id ? { ...i, sort_order: newBOrder } : i)));

    await Promise.all([
      fetch(`/api/admin/${restaurant.slug}/menu-items/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sort_order: newAOrder }) }),
      fetch(`/api/admin/${restaurant.slug}/menu-items/${other.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sort_order: newBOrder }) }),
    ]);
  }

  function saveItemLocally(item) {
    setItems((prev) => (prev.some((i) => i.id === item.id) ? prev.map((i) => (i.id === item.id ? item : i)) : [...prev, item]));
    setEditingItem(null);
  }

  return (
    <div>
      <div className="flex gap-2 mb-6">
        <input
          value={newCategoryName}
          onChange={(e) => setNewCategoryName(e.target.value)}
          placeholder="New category, e.g. Starters"
          className="border border-ink/15 rounded-card px-3.5 py-2 text-sm bg-white"
        />
        <button onClick={addCategory} className="bg-ink text-paper px-4 rounded-card text-sm font-semibold">Add category</button>
      </div>

      <div className="grid gap-7">
        {categories.map((cat) => {
          const catItems = items.filter((i) => i.category_id === cat.id).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
          return (
            <div key={cat.id}>
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="font-display font-bold text-ink">{cat.name}</h3>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { setModalCategoryId(cat.id); setEditingItem("new"); }}
                    className="text-xs font-semibold text-chili"
                  >
                    + Add item
                  </button>
                  {catItems.length === 0 && (
                    <button onClick={() => deleteCategory(cat)} className="text-xs text-clay">Delete category</button>
                  )}
                </div>
              </div>
              {catItems.length === 0 ? (
                <p className="text-xs text-clay">No items yet.</p>
              ) : (
                <div className="grid gap-2">
                  {catItems.map((item, idx) => (
                    <Card key={item.id} className="p-3.5 flex items-center gap-3">
                      <div className="flex flex-col flex-shrink-0">
                        <button onClick={() => moveItem(item, "up")} disabled={idx === 0} className="text-ink/40 hover:text-ink disabled:opacity-20 disabled:hover:text-ink/40 -mb-1">
                          <ChevronUp size={15} />
                        </button>
                        <button onClick={() => moveItem(item, "down")} disabled={idx === catItems.length - 1} className="text-ink/40 hover:text-ink disabled:opacity-20 disabled:hover:text-ink/40">
                          <ChevronDown size={15} />
                        </button>
                      </div>
                      {item.image_url ? (
                        <img src={item.image_url} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" alt="" />
                      ) : (
                        <Monogram name={item.name} size="sm" className="w-12 h-12" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-ink text-sm">{item.name}</p>
                        <p className="text-xs text-clay">
                          {money(item.discounted_price || item.price, restaurant.currency)}
                          {item.discounted_price ? <span className="line-through ml-1.5">{money(item.price, restaurant.currency)}</span> : null}
                        </p>
                        {(!!item.is_recommended || !!item.is_new_pick) && (
                          <div className="flex gap-1.5 mt-1">
                            {!!item.is_recommended && <span className="text-[10px] font-semibold text-herb bg-herb/10 px-1.5 py-0.5 rounded-full">Chef's Pick</span>}
                            {!!item.is_new_pick && <span className="text-[10px] font-semibold text-chili-dark bg-chili/10 px-1.5 py-0.5 rounded-full">New</span>}
                          </div>
                        )}
                      </div>
                      <label className="flex items-center gap-1.5 text-xs text-clay">
                        <input type="checkbox" checked={!!item.available} onChange={() => toggleAvailable(item)} /> Available
                      </label>
                      <button onClick={() => { setModalCategoryId(cat.id); setEditingItem(item); }} className="text-xs font-semibold text-ink/60">Edit</button>
                      <button onClick={() => deleteItem(item)} className="text-xs font-semibold text-chili-dark">Delete</button>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {categories.length === 0 && <p className="text-clay text-sm">Add a category to start building your menu.</p>}
      </div>

      {editingItem && (
        <ItemFormModal
          restaurant={restaurant}
          categoryId={modalCategoryId}
          categories={categories}
          item={editingItem === "new" ? null : editingItem}
          onClose={() => setEditingItem(null)}
          onSaved={saveItemLocally}
        />
      )}
    </div>
  );
}

function ItemFormModal({ restaurant, categoryId, categories, item, onClose, onSaved }) {
  const isEdit = !!item;
  const [form, setForm] = useState({
    category_id: item?.category_id || categoryId,
    name: item?.name || "",
    description: item?.description || "",
    price: item?.price ?? "",
    discounted_price: item?.discounted_price ?? "",
    is_veg: item?.is_veg ?? 1,
    spice_level: item?.spice_level || "none",
    prep_time_minutes: item?.prep_time_minutes ?? 15,
    is_popular: item?.is_popular ?? 0,
    is_recommended: item?.is_recommended ?? 0,
    is_new_pick: item?.is_new_pick ?? 0,
    sort_order: item?.sort_order ?? "",
    tags: (item?.tags || []).join(", "),
    allergens: (JSON.parse(item?.allergens || "[]") || []).join(", "),
    image_url: item?.image_url || "",
  });
  const [imagePreview, setImagePreview] = useState(item?.image_url || null);
  const [imageDataUrl, setImageDataUrl] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setImageDataUrl(dataUrl);
    setImagePreview(dataUrl);
  }

  async function save() {
    setError("");
    if (!form.name.trim() || !form.price) {
      setError("Name and price are required.");
      return;
    }
    setSaving(true);
    try {
      let imageUrl = form.image_url;
      if (imageDataUrl) {
        const upRes = await fetch("/api/uploads", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataUrl: imageDataUrl }),
        });
        const upData = await upRes.json();
        if (!upRes.ok) throw new Error(upData.error);
        imageUrl = upData.url;
      }

      const payload = {
        category_id: form.category_id,
        name: form.name.trim(),
        description: form.description,
        price: Number(form.price),
        discounted_price: form.discounted_price ? Number(form.discounted_price) : null,
        is_veg: !!form.is_veg,
        spice_level: form.spice_level,
        prep_time_minutes: Number(form.prep_time_minutes) || 15,
        is_popular: !!form.is_popular,
        is_recommended: !!form.is_recommended,
        is_new_pick: !!form.is_new_pick,
        sort_order: form.sort_order === "" ? null : Number(form.sort_order),
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        allergens: form.allergens.split(",").map((t) => t.trim()).filter(Boolean),
        image_url: imageUrl,
      };

      const url = isEdit ? `/api/admin/${restaurant.slug}/menu-items/${item.id}` : `/api/admin/${restaurant.slug}/menu-items`;
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSaved(data.item);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-paper rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-lg font-bold text-ink mb-4">{isEdit ? "Edit item" : "Add menu item"}</h3>

        <div className="grid gap-3">
          <label className="flex items-center gap-3 border border-dashed border-ink/25 rounded-card p-3 cursor-pointer">
            {imagePreview ? (
              <img src={imagePreview} className="w-14 h-14 rounded-lg object-cover" alt="" />
            ) : (
              <span className="w-14 h-14 rounded-lg bg-clay-light flex items-center justify-center"><Camera size={22} className="text-clay" /></span>
            )}
            <span className="text-xs text-clay">Upload a photo (optional — falls back to a monogram tile)</span>
            <input type="file" accept="image/*" onChange={handleImage} className="hidden" />
          </label>

          <Field label="Category">
            <select
              value={form.category_id}
              onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              className="w-full border border-ink/15 rounded-card px-3 py-2 text-sm bg-white"
            >
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>

          <Field label="Name"><Input value={form.name} onChange={(v) => setForm({ ...form, name: v })} /></Field>
          <Field label="Description">
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className="w-full border border-ink/15 rounded-card px-3 py-2 text-sm bg-white"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Price (₹)"><Input type="number" value={form.price} onChange={(v) => setForm({ ...form, price: v })} /></Field>
            <Field label="Discounted price (optional)"><Input type="number" value={form.discounted_price} onChange={(v) => setForm({ ...form, discounted_price: v })} /></Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Veg / Non-veg">
              <select value={form.is_veg ? "1" : "0"} onChange={(e) => setForm({ ...form, is_veg: e.target.value === "1" })} className="w-full border border-ink/15 rounded-card px-3 py-2 text-sm bg-white">
                <option value="1">Vegetarian</option>
                <option value="0">Non-vegetarian</option>
              </select>
            </Field>
            <Field label="Spice level">
              <select value={form.spice_level} onChange={(e) => setForm({ ...form, spice_level: e.target.value })} className="w-full border border-ink/15 rounded-card px-3 py-2 text-sm bg-white">
                {SPICE_LEVELS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Prep time (minutes)"><Input type="number" value={form.prep_time_minutes} onChange={(v) => setForm({ ...form, prep_time_minutes: v })} /></Field>
            <Field label="Tags (comma-separated)"><Input value={form.tags} onChange={(v) => setForm({ ...form, tags: v })} placeholder="popular, budget" /></Field>
          </div>

          <Field label="Allergens (comma-separated)"><Input value={form.allergens} onChange={(v) => setForm({ ...form, allergens: v })} placeholder="nuts, dairy" /></Field>

          <Field label="Display order">
            <Input type="number" value={form.sort_order} onChange={(v) => setForm({ ...form, sort_order: v })} placeholder="Leave blank to add at the end" />
          </Field>
          <p className="text-xs text-clay -mt-2">
            Controls where this dish appears in its category, and its position in the Chef's Pick and New
            rows below. Lower numbers show first.
          </p>

          <div className="flex flex-col gap-2.5 border border-ink/10 rounded-card p-3.5 bg-white">
            <p className="text-xs font-semibold text-ink -mb-0.5">Where this dish shows up on the customer menu</p>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={!!form.is_popular} onChange={(e) => setForm({ ...form, is_popular: e.target.checked })} /> Popular badge (on the item card)
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={!!form.is_recommended} onChange={(e) => setForm({ ...form, is_recommended: e.target.checked })} /> Feature in the "Chef's Pick" carousel at the top
            </label>
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={!!form.is_new_pick} onChange={(e) => setForm({ ...form, is_new_pick: e.target.checked })} /> Show in the "New on the menu" row
            </label>
          </div>
        </div>

        {error && <p className="text-xs text-chili-dark font-medium mt-3">{error}</p>}

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 border border-ink/15 text-ink font-semibold py-2.5 rounded-card">Cancel</button>
          <button disabled={saving} onClick={save} className="flex-1 bg-sprout text-white font-semibold py-2.5 rounded-card disabled:opacity-60">
            {saving ? "Saving..." : isEdit ? "Save changes" : "Add item"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-ink mb-1">{label}</label>
      {children}
    </div>
  );
}
function Input({ value, onChange, type = "text", placeholder }) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border border-ink/15 rounded-card px-3 py-2 text-sm bg-white"
    />
  );
}

// ---------- Offers ----------

function OffersTab({ restaurant, offers, setOffers, askConfirm }) {
  const [showForm, setShowForm] = useState(false);

  async function toggleActive(offer) {
    const res = await fetch(`/api/admin/${restaurant.slug}/offers/${offer.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: offer.active ? 0 : 1 }),
    });
    if (res.ok) setOffers((prev) => prev.map((o) => (o.id === offer.id ? { ...o, active: offer.active ? 0 : 1 } : o)));
  }

  async function deleteOffer(offer) {
    askConfirm(`Delete offer "${offer.title}"?`, async () => {
      const res = await fetch(`/api/admin/${restaurant.slug}/offers/${offer.id}`, { method: "DELETE" });
      if (res.ok) {
        setOffers((prev) => prev.filter((o) => o.id !== offer.id));
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Could not delete this offer.");
      }
    });
  }

  return (
    <div>
      <button onClick={() => setShowForm(true)} className="mb-5 bg-ink text-paper px-4 py-2 rounded-card text-sm font-semibold">
        + Create offer
      </button>

      <div className="grid gap-3">
        {offers.length === 0 && <p className="text-clay text-sm">No offers yet.</p>}
        {offers.map((o) => (
          <Card key={o.id} className="p-4 flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-ink">{o.title}</p>
              <p className="text-xs text-clay mt-1">
                {o.discount_type === "percent" ? `${o.discount_value}% off` : `${money(o.discount_value, restaurant.currency)} off`}
                {" "}on orders above {money(o.min_order_value, restaurant.currency)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => toggleActive(o)} className={`text-xs font-semibold px-3 py-1 rounded-full ${o.active ? "bg-herb/15 text-herb" : "bg-clay-light text-clay"}`}>
                {o.active ? "Active" : "Paused"}
              </button>
              <button onClick={() => deleteOffer(o)} className="text-xs font-semibold text-chili-dark">Delete</button>
            </div>
          </Card>
        ))}
      </div>

      {showForm && (
        <OfferFormModal
          restaurant={restaurant}
          onClose={() => setShowForm(false)}
          onSaved={(offer) => { setOffers((prev) => [...prev, offer]); setShowForm(false); }}
        />
      )}
    </div>
  );
}

function OfferFormModal({ restaurant, onClose, onSaved }) {
  const [form, setForm] = useState({ title: "", description: "", discount_type: "percent", discount_value: "", min_order_value: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!form.title.trim() || !form.discount_value) { setError("Title and discount value are required."); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/${restaurant.slug}/offers`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onSaved(data.offer);
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-paper rounded-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-lg font-bold text-ink mb-4">Create offer</h3>
        <div className="grid gap-3">
          <Field label="Title"><Input value={form.title} onChange={(v) => setForm({ ...form, title: v })} placeholder="10% OFF on orders above ₹500" /></Field>
          <Field label="Description (optional)"><Input value={form.description} onChange={(v) => setForm({ ...form, description: v })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Discount type">
              <select value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value })} className="w-full border border-ink/15 rounded-card px-3 py-2 text-sm bg-white">
                <option value="percent">Percent (%)</option>
                <option value="flat">Flat amount (₹)</option>
              </select>
            </Field>
            <Field label="Discount value"><Input type="number" value={form.discount_value} onChange={(v) => setForm({ ...form, discount_value: v })} /></Field>
          </div>
          <Field label="Minimum order value (₹)"><Input type="number" value={form.min_order_value} onChange={(v) => setForm({ ...form, min_order_value: v })} /></Field>
        </div>
        {error && <p className="text-xs text-chili-dark font-medium mt-3">{error}</p>}
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 border border-ink/15 text-ink font-semibold py-2.5 rounded-card">Cancel</button>
          <button disabled={saving} onClick={save} className="flex-1 bg-sprout text-white font-semibold py-2.5 rounded-card disabled:opacity-60">
            {saving ? "Saving..." : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Campaigns (Instagram / video feedback) ----------

function CampaignsTab({ restaurant, campaigns, setCampaigns, reviews, setReviews, askConfirm }) {
  const [showForm, setShowForm] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [viewingId, setViewingId] = useState(null);
  const viewing = reviews.find((r) => r.id === viewingId) || null;

  async function toggleActive(c) {
    const newActive = c.active ? 0 : 1;
    const res = await fetch(`/api/admin/${restaurant.slug}/campaigns/${c.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: newActive }),
    });
    if (res.ok) {
      setCampaigns((prev) =>
        prev.map((x) => {
          if (x.id === c.id) return { ...x, active: newActive };
          // Turning this one on only pauses other campaigns of the SAME
          // media type -- one video campaign and one audio campaign can
          // both stay active together.
          return newActive && x.media_type === c.media_type ? { ...x, active: 0 } : x;
        })
      );
    }
  }
  async function deleteCampaign(c) {
    askConfirm(`Delete campaign "${c.title}"?`, async () => {
      const res = await fetch(`/api/admin/${restaurant.slug}/campaigns/${c.id}`, { method: "DELETE" });
      if (res.ok) {
        setCampaigns((prev) => prev.filter((x) => x.id !== c.id));
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Could not delete this campaign.");
      }
    });
  }
  async function deleteReview(r) {
    askConfirm("Delete this submission? This removes the video/feedback record permanently.", async () => {
      const res = await fetch(`/api/admin/${restaurant.slug}/reviews/${r.id}`, { method: "DELETE" });
      if (res.ok) {
        setReviews((prev) => prev.filter((x) => x.id !== r.id));
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Could not delete this submission.");
      }
    });
  }

  return (
    <div>
      <p className="text-sm text-clay mb-4 max-w-lg">
        At checkout, customers can complete a quick video or voice-note feedback campaign for a
        discount that applies immediately to their current order. You can run one active video
        campaign and one active audio campaign at the same time -- a customer who completes both
        gets both discounts added together on their bill.
      </p>
      <button onClick={() => setShowForm(true)} className="mb-5 bg-ink text-paper px-4 py-2 rounded-card text-sm font-semibold hover:bg-ink/90 transition-colors">
        + Create campaign
      </button>

      <div className="grid gap-3 mb-8">
        {campaigns.length === 0 && <p className="text-clay text-sm">No campaigns yet.</p>}
        {campaigns.map((c) => (
          <Card key={c.id} className="p-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-start gap-2.5">
                {c.media_type === "audio" ? (
                  <Mic size={17} className="text-chili-dark mt-0.5 flex-shrink-0" />
                ) : (
                  <Video size={17} className="text-chili-dark mt-0.5 flex-shrink-0" />
                )}
                <div>
                  <p className="font-semibold text-ink">{c.title}</p>
                  <p className="text-xs text-clay mt-1">{c.description}</p>
                  <p className="text-xs text-clay mt-1">
                    {c.discount_type === "percent" ? `${c.discount_value}% off` : `${money(c.discount_value, restaurant.currency)} off`} this order
                    {" · "}{c.media_type === "audio" ? "voice note" : "video"} {c.requires_video ? "required" : "optional"}
                    {c.allow_instagram_repost ? " · Instagram reuse allowed (with separate consent)" : ""}
                    {c.media_type === "video" ? ` · ${(c.templates || []).filter((t) => t.active !== false).length}/${(c.templates || []).length} templates shown` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <button onClick={() => toggleActive(c)} className={`text-xs font-semibold px-3 py-1 rounded-full ${c.active ? "bg-herb/15 text-herb" : "bg-clay-light text-clay"}`}>
                  {c.active ? "Active" : "Paused"}
                </button>
                <button onClick={() => setEditingCampaign(c)} className="text-xs font-semibold text-ink/60">Edit</button>
                <button onClick={() => deleteCampaign(c)} className="text-xs font-semibold text-chili-dark">Delete</button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <h3 className="font-display font-bold text-ink mb-1">Submissions</h3>
      <p className="text-xs text-clay mb-2.5">Everything customers made from your templates or sent in, with their name, phone number, and when they sent it. Tap one to watch it, edit the details, or delete it.</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {reviews.length === 0 && <p className="text-clay text-sm col-span-full">No submissions yet.</p>}
        {reviews.map((r) => {
          const scenes = r.scenes || [];
          const firstShot = scenes.find((sc) => sc.media);
          const thumbUrl = firstShot?.media || r.video_url || "";
          const thumbIsVideo = firstShot ? firstShot.mediaType === "video" : !!r.video_url && !/\.(mp3|m4a|wav|ogg|jpe?g|png|webp|gif)(\?|$)/i.test(r.video_url);
          const thumbIsAudio = !firstShot && !!r.video_url && /\.(mp3|m4a|wav|ogg)(\?|$)/i.test(r.video_url);
          return (
            <div
              key={r.id}
              onClick={() => setViewingId(r.id)}
              className="bg-white border border-ink/10 rounded-2xl overflow-hidden shadow-sm flex flex-col cursor-pointer hover:shadow-md transition-shadow"
            >
              <div className="relative">
                {thumbUrl && thumbIsVideo ? (
                  <video src={thumbUrl} preload="metadata" className="w-full h-28 object-cover bg-ink/5" muted />
                ) : thumbUrl && !thumbIsAudio ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumbUrl} alt="" className="w-full h-28 object-cover bg-ink/5" />
                ) : thumbIsAudio ? (
                  <div className="w-full h-28 bg-sprout/10 flex items-center justify-center"><Mic size={26} className="text-sprout-dark" /></div>
                ) : (
                  <div className="w-full h-28 bg-paper flex items-center justify-center"><Star size={22} className="text-clay-light" /></div>
                )}
                {scenes.length > 0 && (
                  <span className="absolute top-1.5 left-1.5 text-[10px] font-bold text-white bg-ink/70 px-1.5 py-0.5 rounded-full">
                    {scenes.length} scene{scenes.length === 1 ? "" : "s"}
                  </span>
                )}
              </div>
              <div className="p-2.5 flex-1 flex flex-col">
                <p className="font-semibold text-ink text-xs truncate">{r.customer_name || "Anonymous"}</p>
                {r.customer_phone && <p className="text-[11px] text-clay truncate">{r.customer_phone}</p>}
                <p className="text-[11px] text-clay mt-0.5">{parseDbDate(r.submitted_at).toLocaleString()}</p>
                {r.template_name && <p className="text-[11px] text-sprout-dark font-semibold truncate mt-0.5">{r.template_name}</p>}
                <div className="flex items-center gap-0.5 mt-1.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} size={11} className={n <= (r.rating || 0) ? "fill-turmeric text-turmeric" : "text-clay-light"} />
                  ))}
                </div>
                <div className="mt-auto pt-2 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-sprout-dark font-semibold">Open</span>
                  <button onClick={(e) => { e.stopPropagation(); deleteReview(r); }} className="text-[11px] font-semibold text-chili-dark">Delete</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showForm && (
        <CampaignFormModal
          restaurant={restaurant}
          onClose={() => setShowForm(false)}
          onSaved={(c) => {
            // The new campaign comes back active=1, and the server just
            // paused every other campaign of the same media_type to match --
            // mirror that here too so the list doesn't show two "Active"
            // pills for the same type.
            setCampaigns((prev) => [...prev.map((x) => (x.media_type === c.media_type ? { ...x, active: 0 } : x)), c]);
            setShowForm(false);
          }}
        />
      )}

      {editingCampaign && (
        <CampaignFormModal
          restaurant={restaurant}
          campaign={editingCampaign}
          onClose={() => setEditingCampaign(null)}
          onSaved={(c) => {
            setCampaigns((prev) => prev.map((x) => (x.id === c.id ? c : (c.active && x.media_type === c.media_type ? { ...x, active: 0 } : x))));
            setEditingCampaign(null);
          }}
        />
      )}

      {viewing && (
        <SubmissionViewer
          key={viewing.id}
          review={viewing}
          restaurant={restaurant}
          onClose={() => setViewingId(null)}
          onUpdated={(patch) => setReviews((prev) => prev.map((x) => (x.id === viewing.id ? { ...x, ...patch } : x)))}
          onDelete={() => { const r = viewing; setViewingId(null); deleteReview(r); }}
        />
      )}
    </div>
  );
}

// ---------- Template editor ----------
//
// Same idea as the restaurant's "Influencer Video Template" file: a
// template is a list of scenes, each with its own transition, duration,
// caption and (optionally) a shot of the restaurant's own. Customers open
// a template in the in-app edit place and drop their own clips into it.
// Everything below -- the name, the instructions, every caption, every
// scene -- is the restaurant's to edit or delete; nothing is pre-written.

function newSceneId() {
  return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
function blankScene() {
  return { id: newSceneId(), caption: "", duration: 4, transition: "fade", media: "", mediaType: "" };
}

function TemplateEditorModal({ template, onClose, onSave }) {
  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [scenes, setScenes] = useState(
    template?.scenes?.length ? template.scenes : [blankScene(), blankScene(), blankScene()]
  );
  const [uploadingId, setUploadingId] = useState(null);
  const [error, setError] = useState("");
  const MAX_SHOT_BYTES = 100 * 1024 * 1024;

  function updateScene(id, patch) {
    setScenes((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }
  function removeScene(id) {
    setScenes((prev) => prev.filter((s) => s.id !== id));
  }

  async function uploadShot(id, e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_SHOT_BYTES) {
      setError("That file is too large (max 100MB). Please use a shorter clip.");
      return;
    }
    setError("");
    setUploadingId(id);
    try {
      const dataUrl = await fileToDataUrl(file);
      const res = await fetch("/api/uploads", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl, maxBytes: MAX_SHOT_BYTES }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      updateScene(id, { media: data.url, mediaType: file.type.startsWith("video/") ? "video" : "image" });
    } catch (err) {
      setError(err.message || "Could not upload that file.");
    } finally {
      setUploadingId(null);
    }
  }

  function save() {
    if (scenes.length === 0) { setError("Add at least one scene."); return; }
    onSave({
      id: template?.id || newSceneId(),
      name: name.trim(),
      description: description.trim(),
      active: template ? template.active !== false : true,
      scenes,
    });
  }

  return (
    <div className="fixed inset-0 z-[60] bg-ink/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-paper rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-display text-lg font-bold text-ink">{template ? "Edit template" : "New template"}</h3>
          <button onClick={onClose} className="text-ink/50 hover:text-ink p-1 text-xl leading-none">×</button>
        </div>
        <p className="text-xs text-clay mb-4">
          Build the scenes customers will fill in. Set each scene's transition, how long it shows and its
          caption. Add a shot of your own to a scene if you want, or leave it empty for the customer's clip.
        </p>

        <div className="grid md:grid-cols-[230px_1fr] gap-6">
          <div className="md:sticky md:top-0 self-start">
            <TemplatePlayer scenes={scenes} width={200} />
          </div>

          <div>
            <div className="grid gap-2.5 mb-4">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={80}
                placeholder="Template name (shown to customers)"
                className="w-full border border-ink/15 rounded-card px-3 py-2 text-sm bg-white"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                maxLength={400}
                placeholder="Instructions for the customer (optional) -- what to film, how many shots, etc."
                className="w-full border border-ink/15 rounded-card px-3 py-2 text-sm bg-white"
              />
            </div>

            {scenes.map((s, i) => (
              <div key={s.id} className="bg-white border border-ink/10 rounded-2xl p-4 mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="w-3 h-3 rounded-[3px] flex-shrink-0" style={{ background: SCENE_COLORS[i % SCENE_COLORS.length] }} />
                  <p className="font-semibold text-ink text-sm">Scene {i + 1}</p>
                  <label className="ml-auto flex items-center gap-1.5 text-xs text-clay">
                    sec
                    <input
                      type="number" min={1} max={60} value={s.duration}
                      onChange={(e) => updateScene(s.id, { duration: Math.min(60, Math.max(1, parseInt(e.target.value) || 1)) })}
                      className="w-14 border border-ink/15 rounded-md px-1.5 py-0.5 text-center text-xs"
                    />
                  </label>
                  <button onClick={() => removeScene(s.id)} className="text-ink/40 hover:text-chili-dark text-lg leading-none px-1" title="Remove scene">×</button>
                </div>

                <label className="block text-[11px] text-clay mt-3 mb-1">Transition in</label>
                <select
                  value={s.transition}
                  onChange={(e) => updateScene(s.id, { transition: e.target.value })}
                  className="w-full border border-ink/15 rounded-lg px-2.5 py-1.5 text-sm bg-paper"
                >
                  {TEMPLATE_EFFECTS.map((fx) => <option key={fx.id} value={fx.id}>{fx.label}</option>)}
                </select>

                <label className="block text-[11px] text-clay mt-3 mb-1">Your shot (optional -- photo or clip)</label>
                <div className="flex items-center gap-2.5">
                  {s.media && (
                    s.mediaType === "video"
                      ? <video src={s.media} className="w-10 h-10 rounded-md object-cover border border-ink/10" muted />
                      // eslint-disable-next-line @next/next/no-img-element
                      : <img src={s.media} alt="" className="w-10 h-10 rounded-md object-cover border border-ink/10" />
                  )}
                  <label className="text-xs font-semibold border border-ink/15 rounded-lg px-3 py-1.5 cursor-pointer text-ink/70">
                    {uploadingId === s.id ? "Uploading..." : s.media ? "Replace" : "Upload"}
                    <input type="file" accept="video/*,image/*" disabled={uploadingId === s.id} onChange={(e) => uploadShot(s.id, e)} className="hidden" />
                  </label>
                  {s.media && (
                    <button onClick={() => updateScene(s.id, { media: "", mediaType: "" })} className="text-xs font-semibold text-chili-dark">Remove</button>
                  )}
                </div>

                <label className="block text-[11px] text-clay mt-3 mb-1">Caption</label>
                <input
                  value={s.caption}
                  onChange={(e) => updateScene(s.id, { caption: e.target.value })}
                  maxLength={140}
                  placeholder="Type your own caption"
                  className="w-full border border-ink/15 rounded-lg px-2.5 py-1.5 text-sm bg-white"
                />
              </div>
            ))}

            <button
              onClick={() => setScenes((prev) => [...prev, blankScene()])}
              className="w-full border border-dashed border-ink/25 rounded-2xl py-3 text-sm font-semibold text-ink/70 hover:border-sprout hover:text-sprout-dark"
            >
              + Add scene
            </button>
          </div>
        </div>

        {error && <p className="text-xs text-chili-dark font-medium mt-4">{error}</p>}
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 border border-ink/15 text-ink font-semibold py-2.5 rounded-card">Cancel</button>
          <button disabled={uploadingId !== null} onClick={save} className="flex-1 bg-sprout text-white font-semibold py-2.5 rounded-card disabled:opacity-60">
            Save template
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Submission viewer ----------
//
// Replays exactly what a customer made from a template, with who they are
// and when they sent it. Every detail here can be corrected or removed by
// the restaurant.

function SubmissionViewer({ review, restaurant, onClose, onUpdated, onDelete }) {
  const scenes = review.scenes || [];
  const [name, setName] = useState(review.customer_name || "");
  const [phone, setPhone] = useState(review.customer_phone || "");
  const [feedback, setFeedback] = useState(review.text_feedback || "");
  const [captions, setCaptions] = useState(scenes.map((s) => s.caption || ""));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const isAudio = !scenes.length && review.video_url && /\.(mp3|m4a|wav|ogg)(\?|$)/i.test(review.video_url);

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/${restaurant.slug}/reviews/${review.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: name, customer_phone: phone, text_feedback: feedback,
          scenes: scenes.length ? captions.map((c) => ({ caption: c })) : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save.");
      onUpdated({
        customer_name: name.trim(), customer_phone: phone.trim(), text_feedback: feedback,
        scenes: scenes.map((s, i) => ({ ...s, caption: captions[i] })),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] bg-ink/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-paper rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-display text-lg font-bold text-ink">{review.customer_name || "Anonymous"}</h3>
            <p className="text-xs text-clay">
              {review.template_name ? `${review.template_name} · ` : ""}{parseDbDate(review.submitted_at).toLocaleString()}
              {review.discount_code ? ` · ${review.discount_code}` : ""}
            </p>
          </div>
          <button onClick={onClose} className="text-ink/50 hover:text-ink p-1 text-xl leading-none">×</button>
        </div>

        <div className="grid md:grid-cols-[230px_1fr] gap-6">
          <div className="self-start">
            {scenes.length > 0 ? (
              <TemplatePlayer scenes={scenes.map((s, i) => ({ ...s, caption: captions[i] }))} width={200} autoPlay />
            ) : review.video_url ? (
              isAudio
                ? <audio src={review.video_url} controls className="w-full" />
                : <video src={review.video_url} controls className="w-full rounded-xl bg-ink" />
            ) : (
              <p className="text-sm text-clay">No video or audio was attached.</p>
            )}
          </div>

          <div className="grid gap-3 content-start">
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] text-clay mb-1">Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="w-full border border-ink/15 rounded-lg px-2.5 py-1.5 text-sm bg-white" />
              </div>
              <div>
                <label className="block text-[11px] text-clay mb-1">Phone number</label>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} className="w-full border border-ink/15 rounded-lg px-2.5 py-1.5 text-sm bg-white" />
              </div>
            </div>
            <div>
              <label className="block text-[11px] text-clay mb-1">Feedback</label>
              <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={2} className="w-full border border-ink/15 rounded-lg px-2.5 py-1.5 text-sm bg-white" />
            </div>

            {scenes.map((s, i) => (
              <div key={i} className="bg-white border border-ink/10 rounded-xl p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-xs font-semibold text-ink">Scene {i + 1}</p>
                  {s.media && (
                    <a href={s.media} download className="text-[11px] font-semibold text-sprout-dark">
                      Download {s.mediaType === "video" ? "clip" : "photo"}
                    </a>
                  )}
                </div>
                <input
                  value={captions[i] ?? ""}
                  onChange={(e) => setCaptions((prev) => prev.map((c, j) => (j === i ? e.target.value : c)))}
                  maxLength={140}
                  placeholder="Caption"
                  className="w-full border border-ink/15 rounded-lg px-2.5 py-1.5 text-sm bg-white"
                />
              </div>
            ))}

            {review.video_url && !scenes.length && (
              <a href={review.video_url} download className="text-xs font-semibold text-sprout-dark">Download file</a>
            )}
          </div>
        </div>

        {error && <p className="text-xs text-chili-dark font-medium mt-4">{error}</p>}
        <div className="flex gap-3 mt-5">
          <button onClick={onDelete} className="border border-chili/30 text-chili-dark bg-chili/5 font-semibold px-4 py-2.5 rounded-card text-sm">Delete</button>
          <button onClick={onClose} className="flex-1 border border-ink/15 text-ink font-semibold py-2.5 rounded-card">Close</button>
          <button disabled={saving} onClick={save} className="flex-1 bg-sprout text-white font-semibold py-2.5 rounded-card disabled:opacity-60">
            {saving ? "Saving..." : saved ? "Saved" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CampaignFormModal({ restaurant, campaign, onClose, onSaved }) {
  const isEditing = !!campaign;
  const [form, setForm] = useState({
    title: campaign?.title ?? "",
    description: campaign?.description ?? "",
    discount_type: campaign?.discount_type ?? "percent",
    discount_value: campaign?.discount_value ?? "10",
    requires_video: campaign ? !!campaign.requires_video : true,
    allow_instagram_repost: campaign ? !!campaign.allow_instagram_repost : false,
    media_type: campaign?.media_type ?? "video",
    terms_text: campaign?.terms_text ?? "We're asking for honest feedback, not a positive review. Your video/photo may be used internally to improve our food and service.",
    template_videos: (campaign?.template_videos ?? []).map((t) => (typeof t === "string" ? { url: t, active: true } : t)),
    templates: campaign?.templates ?? [],
  });
  const [uploadingTemplate, setUploadingTemplate] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null); // { index, template } -- index null when adding
  const [copiedTemplateId, setCopiedTemplateId] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const MAX_TEMPLATE_BYTES = 200 * 1024 * 1024; // 200MB

  async function addTemplateVideo(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (form.template_videos.length >= 20) {
      setError("That's a lot of templates already -- try trimming the list before adding more.");
      return;
    }
    if (file.size > MAX_TEMPLATE_BYTES) {
      setError("That video is too large (max 200MB). Please choose a shorter or lower-quality clip.");
      return;
    }
    setError("");
    setUploadingTemplate(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const upRes = await fetch("/api/uploads", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataUrl, maxBytes: MAX_TEMPLATE_BYTES }),
      });
      const upData = await upRes.json();
      if (!upRes.ok) throw new Error(upData.error);
      setForm((f) => ({ ...f, template_videos: [...f.template_videos, { url: upData.url, active: true }] }));
    } catch (e2) {
      setError(e2.message || "Could not upload that video.");
    } finally {
      setUploadingTemplate(false);
    }
  }

  function saveTemplate(tpl) {
    setForm((f) => {
      const idx = editingTemplate?.index;
      const list = idx === null || idx === undefined ? [...f.templates, tpl] : f.templates.map((t, i) => (i === idx ? tpl : t));
      return { ...f, templates: list };
    });
    setEditingTemplate(null);
  }
  function removeTemplate(idx) {
    setForm((f) => ({ ...f, templates: f.templates.filter((_, i) => i !== idx) }));
  }
  function toggleTemplate(idx) {
    setForm((f) => ({ ...f, templates: f.templates.map((t, i) => (i === idx ? { ...t, active: t.active === false } : t)) }));
  }

  // One link per template: it opens the customer's edit place with this
  // template already loaded. Works once the campaign is saved and active.
  function copyTemplateLink(t) {
    const link = `${window.location.origin}/r/${restaurant.slug}/edit/${t.id}`;
    const done = () => { setCopiedTemplateId(t.id); setTimeout(() => setCopiedTemplateId(null), 2000); };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(link).then(done, () => window.prompt("Copy this link:", link));
    else window.prompt("Copy this link:", link);
  }
  function removeTemplateVideo(idx) {
    setForm((f) => ({ ...f, template_videos: f.template_videos.filter((_, i) => i !== idx) }));
  }

  function toggleTemplateVideo(idx) {
    setForm((f) => ({
      ...f,
      template_videos: f.template_videos.map((t, i) => (i === idx ? { ...t, active: !t.active } : t)),
    }));
  }

  async function save() {
    if (!form.title.trim() || !form.discount_value) { setError("Title and discount value are required."); return; }
    setSaving(true);
    try {
      const url = isEditing
        ? `/api/admin/${restaurant.slug}/campaigns/${campaign.id}`
        : `/api/admin/${restaurant.slug}/campaigns`;
      const res = await fetch(url, {
        method: isEditing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      // PATCH only returns { ok: true }, not the updated row -- build the
      // updated campaign locally so the list reflects the edit immediately.
      onSaved(isEditing ? { ...campaign, ...form } : data.campaign);
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-paper rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-lg font-bold text-ink mb-4">{isEditing ? "Edit campaign" : "Create video feedback campaign"}</h3>
        <div className="grid gap-3">
          <Field label="Title"><Input value={form.title} onChange={(v) => setForm({ ...form, title: v })} placeholder="Your campaign title" /></Field>
          <Field label="Description shown to customers">
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="What customers see before they take part" className="w-full border border-ink/15 rounded-card px-3 py-2 text-sm bg-white" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Discount type">
              <select value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value })} className="w-full border border-ink/15 rounded-card px-3 py-2 text-sm bg-white">
                <option value="percent">Percent (%)</option>
                <option value="flat">Flat amount (₹)</option>
              </select>
            </Field>
            <Field label="Discount value"><Input type="number" value={form.discount_value} onChange={(v) => setForm({ ...form, discount_value: v })} /></Field>
          </div>
          <Field label="What should customers submit?">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, media_type: "video" })}
                className={`flex-1 text-xs font-semibold py-2 rounded-card border inline-flex items-center justify-center gap-1.5 ${form.media_type === "video" ? "bg-sprout text-white border-sprout" : "border-ink/15 text-ink/70"}`}
              >
                <Video size={14} /> Video
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, media_type: "audio" })}
                className={`flex-1 text-xs font-semibold py-2 rounded-card border inline-flex items-center justify-center gap-1.5 ${form.media_type === "audio" ? "bg-sprout text-white border-sprout" : "border-ink/15 text-ink/70"}`}
              >
                <Mic size={14} /> Voice note
              </button>
            </div>
          </Field>

          {form.media_type === "video" && (
            <div className="border border-ink/10 rounded-card p-3.5 bg-white">
              <p className="text-xs font-semibold text-ink mb-1">Templates ({form.templates.length})</p>
              <p className="text-xs text-clay mb-2.5">
                A template is a set of scenes -- each with its own transition, timing and caption. Customers
                open one in the edit place, drop their own clips into the scenes, and send it to you. Edit
                or delete any template whenever you like; untick "Shown" to hide one without deleting it.
              </p>
              <div className="grid gap-2 mb-2.5">
                {form.templates.map((t, idx) => (
                  <div key={t.id || idx} className={`flex items-center gap-2.5 border border-ink/10 rounded-lg px-3 py-2 ${t.active === false ? "opacity-50" : ""}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-ink truncate">{t.name || `Template ${idx + 1}`}</p>
                      <p className="text-[11px] text-clay">{t.scenes?.length || 0} scene{(t.scenes?.length || 0) === 1 ? "" : "s"}</p>
                    </div>
                    <label className="flex items-center gap-1 text-[11px] font-semibold text-ink/70 cursor-pointer">
                      <input type="checkbox" checked={t.active !== false} onChange={() => toggleTemplate(idx)} className="w-3.5 h-3.5" /> Shown
                    </label>
                    <button type="button" onClick={() => copyTemplateLink(t)} className="text-xs font-semibold text-sprout-dark">
                      {copiedTemplateId === t.id ? "Link copied" : "Copy link"}
                    </button>
                    <button type="button" onClick={() => setEditingTemplate({ index: idx, template: t })} className="text-xs font-semibold text-ink/60">Edit</button>
                    <button type="button" onClick={() => removeTemplate(idx)} className="text-xs font-semibold text-chili-dark">Delete</button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setEditingTemplate({ index: null, template: null })}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-sprout-dark border border-dashed border-sprout/40 bg-sprout/5 rounded-card px-3 py-2"
              >
                <Plus size={13} /> Add a template
              </button>

                <p className="text-[11px] text-clay mt-2.5">
                  Save the campaign, then tap "Copy link" on a template. That one link opens the edit place with
                  the template ready -- customers drop in their own clips and send it to you.
                </p>

                {form.template_videos.length > 0 && (
                  <div className="mt-4 pt-3.5 border-t border-ink/10">
                    <p className="text-xs font-semibold text-ink mb-1">Older ready-made videos ({form.template_videos.length})</p>
                    <p className="text-xs text-clay mb-2.5">Uploaded before templates. Hide or remove them any time.</p>
                    <div className="grid grid-cols-3 gap-2">
                      {form.template_videos.map((t, idx) => (
                        <div key={idx} className={`relative border rounded-lg overflow-hidden bg-ink/5 ${t.active ? "border-ink/10" : "border-ink/10 opacity-40"}`}>
                          <video src={t.url} className="w-full h-16 object-cover" muted />
                          <button type="button" onClick={() => removeTemplateVideo(idx)} className="absolute top-1 right-1 w-5 h-5 rounded-full bg-ink/70 text-white text-xs flex items-center justify-center">×</button>
                          <label className="absolute bottom-1 left-1 right-1 bg-white/90 rounded px-1.5 py-0.5 flex items-center gap-1 text-[10px] font-semibold text-ink cursor-pointer">
                            <input type="checkbox" checked={t.active} onChange={() => toggleTemplateVideo(idx)} className="w-3 h-3" /> Shown
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          )}

          {editingTemplate && (
            <TemplateEditorModal
              template={editingTemplate.template}
              onClose={() => setEditingTemplate(null)}
              onSave={saveTemplate}
            />
          )}

          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={form.requires_video} onChange={(e) => setForm({ ...form, requires_video: e.target.checked })} />
            {form.media_type === "audio" ? "Require a voice note (uncheck to also allow text-only feedback)" : "Require a video (uncheck to also allow text-only feedback)"}
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={form.allow_instagram_repost} onChange={(e) => setForm({ ...form, allow_instagram_repost: e.target.checked })} /> Ask for separate permission to repost on Instagram
          </label>
          <Field label="Terms shown to customers before they participate">
            <textarea value={form.terms_text} onChange={(e) => setForm({ ...form, terms_text: e.target.value })} rows={3} className="w-full border border-ink/15 rounded-card px-3 py-2 text-sm bg-white" />
          </Field>
        </div>
        {error && <p className="text-xs text-chili-dark font-medium mt-3">{error}</p>}
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 border border-ink/15 text-ink font-semibold py-2.5 rounded-card">Cancel</button>
          <button disabled={saving || uploadingTemplate} onClick={save} className="flex-1 bg-sprout text-white font-semibold py-2.5 rounded-card disabled:opacity-60">
            {saving ? "Saving..." : isEditing ? "Save changes" : "Create campaign"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Taxes ----------

function TaxesTab({ restaurant, taxes, setTaxes, askConfirm }) {
  const [name, setName] = useState("");
  const [percent, setPercent] = useState("");
  const [type, setType] = useState("percent"); // "percent" | "fixed"
  const [error, setError] = useState("");

  const activePercentTotal = taxes.filter((t) => t.active && (t.type || "percent") === "percent").reduce((s, t) => s + t.percent, 0);
  const activeFixedTotal = taxes.filter((t) => t.active && t.type === "fixed").reduce((s, t) => s + t.percent, 0);

  async function addTax() {
    setError("");
    if (!name.trim() || percent === "") { setError("Enter a name and amount."); return; }
    const res = await fetch(`/api/admin/${restaurant.slug}/taxes`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), percent: Number(percent), type }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }
    setTaxes((prev) => [...prev, data.tax]);
    setName(""); setPercent(""); setType("percent");
  }

  async function toggleActive(tax) {
    const res = await fetch(`/api/admin/${restaurant.slug}/taxes/${tax.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: tax.active ? 0 : 1 }),
    });
    if (res.ok) setTaxes((prev) => prev.map((t) => (t.id === tax.id ? { ...t, active: tax.active ? 0 : 1 } : t)));
  }

  async function updatePercent(tax, newPercent) {
    setTaxes((prev) => prev.map((t) => (t.id === tax.id ? { ...t, percent: newPercent } : t)));
  }
  async function savePercent(tax) {
    await fetch(`/api/admin/${restaurant.slug}/taxes/${tax.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ percent: Number(tax.percent) }),
    });
  }

  async function deleteTax(tax) {
    askConfirm(`Delete tax "${tax.name}"?`, async () => {
      const res = await fetch(`/api/admin/${restaurant.slug}/taxes/${tax.id}`, { method: "DELETE" });
      if (res.ok) {
        setTaxes((prev) => prev.filter((t) => t.id !== tax.id));
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Could not delete this tax.");
      }
    });
  }

  return (
    <div className="max-w-lg">
      <p className="text-sm text-ink/70 mb-4">
        Add as many taxes or charges as you need (GST, service charge, packaging fee, etc). Every
        <strong> active</strong> tax below is added to the customer's bill at checkout — shown as a
        separate line each. A tax can be a <strong>percentage</strong> of the order (like GST) or a{" "}
        <strong>flat ₹ amount</strong> added once per order (like a packaging charge). Currently
        active taxes add{" "}
        {activePercentTotal > 0 && <strong>{activePercentTotal}%</strong>}
        {activePercentTotal > 0 && activeFixedTotal > 0 && " + "}
        {activeFixedTotal > 0 && <strong>₹{activeFixedTotal}</strong>}
        {activePercentTotal === 0 && activeFixedTotal === 0 && <strong>nothing</strong>} to every order.
      </p>

      <div className="grid gap-2 mb-6">
        {taxes.length === 0 && <p className="text-clay text-sm">No taxes configured yet — orders will show 0% tax until you add one.</p>}
        {taxes.map((t) => (
          <Card key={t.id} className="p-3.5 flex items-center gap-3">
            <div className="flex-1">
              <p className="font-semibold text-ink text-sm">{t.name}</p>
              <p className="text-xs text-clay">{t.type === "fixed" ? "Flat amount" : "Percentage"}</p>
            </div>
            {t.type === "fixed" && <span className="text-xs text-clay">₹</span>}
            <input
              type="number"
              value={t.percent}
              onChange={(e) => updatePercent(t, e.target.value)}
              onBlur={() => savePercent(t)}
              className="w-20 border border-ink/15 rounded-card px-2 py-1.5 text-sm text-right"
            />
            {t.type !== "fixed" && <span className="text-xs text-clay">%</span>}
            <button onClick={() => toggleActive(t)} className={`text-xs font-semibold px-3 py-1 rounded-full ${t.active ? "bg-herb/15 text-herb" : "bg-clay-light text-clay"}`}>
              {t.active ? "Active" : "Off"}
            </button>
            <button onClick={() => deleteTax(t)} className="text-xs font-semibold text-chili-dark">Delete</button>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        <p className="text-sm font-semibold text-ink mb-2.5">Add a tax or charge</p>
        <div className="flex gap-2 mb-2">
          <button
            type="button"
            onClick={() => setType("percent")}
            className={`flex-1 text-xs font-semibold py-2 rounded-card border ${type === "percent" ? "bg-sprout text-white border-sprout" : "border-ink/15 text-ink/70"}`}
          >
            Percentage (%)
          </button>
          <button
            type="button"
            onClick={() => setType("fixed")}
            className={`flex-1 text-xs font-semibold py-2 rounded-card border ${type === "fixed" ? "bg-sprout text-white border-sprout" : "border-ink/15 text-ink/70"}`}
          >
            Flat amount (₹)
          </button>
        </div>
        <div className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. GST, Packaging charge" className="flex-1 border border-ink/15 rounded-card px-3 py-2 text-sm bg-white" />
          <input
            type="number"
            value={percent}
            onChange={(e) => setPercent(e.target.value)}
            placeholder={type === "fixed" ? "₹15" : "%"}
            className="w-24 border border-ink/15 rounded-card px-3 py-2 text-sm bg-white"
          />
          <button onClick={addTax} className="bg-sprout text-white px-4 rounded-card text-sm font-semibold">Add</button>
        </div>
        {error && <p className="text-xs text-chili-dark font-medium mt-2">{error}</p>}
      </Card>
    </div>
  );
}

// ---------- Customer View ----------

function CustomerViewTab({ restaurant, tables, onRestaurantUpdate }) {
  const activeTables = tables.filter((t) => t.active);
  const [selectedTableNumber, setSelectedTableNumber] = useState(activeTables[0]?.table_number || tables[0]?.table_number || null);
  const [reloadKey, setReloadKey] = useState(0);

  const [logoPreview, setLogoPreview] = useState(restaurant.logo_image_url || null);
  const [coverPreview, setCoverPreview] = useState(restaurant.cover_image_url || null);
  const [tagline, setTagline] = useState(restaurant.tagline || "");
  const [instagramUrl, setInstagramUrl] = useState(restaurant.instagram_url || "");
  const [googleReviewUrl, setGoogleReviewUrl] = useState(restaurant.google_review_url || "");
  const [offerSuccessMessage, setOfferSuccessMessage] = useState(restaurant.offer_success_message || "");
  const [bannerMessages, setBannerMessages] = useState(() => {
    try { return JSON.parse(restaurant.banner_messages || "[]"); } catch { return []; }
  });
  const [newBannerText, setNewBannerText] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState("");

  async function uploadAndSet(file, kind) {
    const dataUrl = await fileToDataUrl(file);
    if (kind === "logo") setLogoPreview(dataUrl);
    else setCoverPreview(dataUrl);

    setProfileError("");
    try {
      const upRes = await fetch("/api/uploads", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataUrl }),
      });
      const upData = await upRes.json();
      if (!upRes.ok) throw new Error(upData.error);

      const patch = kind === "logo" ? { logo_image_url: upData.url } : { cover_image_url: upData.url };
      const res = await fetch(`/api/admin/${restaurant.slug}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save.");
      onRestaurantUpdate?.(data.restaurant);
      setProfileSaved(true);
      setReloadKey((k) => k + 1);
      setTimeout(() => setProfileSaved(false), 2000);
    } catch (e) {
      setProfileError(e.message);
    }
  }

  async function saveTagline() {
    setSavingProfile(true);
    setProfileError("");
    try {
      const res = await fetch(`/api/admin/${restaurant.slug}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tagline }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save.");
      onRestaurantUpdate?.(data.restaurant);
      setProfileSaved(true);
      setReloadKey((k) => k + 1);
      setTimeout(() => setProfileSaved(false), 2000);
    } catch (e) {
      setProfileError(e.message);
    } finally {
      setSavingProfile(false);
    }
  }
  async function saveInstagram() {
    setSavingProfile(true);
    setProfileError("");
    try {
      const res = await fetch(`/api/admin/${restaurant.slug}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ instagram_url: instagramUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save.");
      onRestaurantUpdate?.(data.restaurant);
      setProfileSaved(true);
      setReloadKey((k) => k + 1);
      setTimeout(() => setProfileSaved(false), 2000);
    } catch (e) {
      setProfileError(e.message);
    } finally {
      setSavingProfile(false);
    }
  }

  async function saveGoogleReview() {
    setSavingProfile(true);
    setProfileError("");
    try {
      const res = await fetch(`/api/admin/${restaurant.slug}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ google_review_url: googleReviewUrl }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save.");
      onRestaurantUpdate?.(data.restaurant);
      setProfileSaved(true);
      setReloadKey((k) => k + 1);
      setTimeout(() => setProfileSaved(false), 2000);
    } catch (e) {
      setProfileError(e.message);
    } finally {
      setSavingProfile(false);
    }
  }

  async function saveOfferSuccessMessage() {
    setSavingProfile(true);
    setProfileError("");
    try {
      const res = await fetch(`/api/admin/${restaurant.slug}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ offer_success_message: offerSuccessMessage }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save.");
      onRestaurantUpdate?.(data.restaurant);
      setProfileSaved(true);
      setReloadKey((k) => k + 1);
      setTimeout(() => setProfileSaved(false), 2000);
    } catch (e) {
      setProfileError(e.message);
    } finally {
      setSavingProfile(false);
    }
  }

  async function saveBannerMessages(next) {
    setBannerMessages(next);
    setSavingProfile(true);
    setProfileError("");
    try {
      const res = await fetch(`/api/admin/${restaurant.slug}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ banner_messages: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save.");
      onRestaurantUpdate?.(data.restaurant);
      setProfileSaved(true);
      setReloadKey((k) => k + 1);
      setTimeout(() => setProfileSaved(false), 2000);
    } catch (e) {
      setProfileError(e.message);
    } finally {
      setSavingProfile(false);
    }
  }

  function addBannerMessage() {
    if (!newBannerText.trim()) return;
    saveBannerMessages([...bannerMessages, newBannerText.trim()]);
    setNewBannerText("");
  }

  function removeBannerMessage(idx) {
    saveBannerMessages(bannerMessages.filter((_, i) => i !== idx));
  }

  const profileSection = (
    <div className="bg-white border border-ink/10 rounded-2xl p-5 mb-5 max-w-2xl">
      <p className="text-sm font-semibold text-ink mb-1">Welcome screen — logo & background</p>
      <p className="text-xs text-clay mb-4">
        This is exactly what customers see the moment they scan your table QR code, before the
        menu loads. The cover photo fills the entire screen as the background — upload one so it's
        not just a plain color.
      </p>
      <div className="grid sm:grid-cols-2 gap-4">
        <label className="flex flex-col items-center gap-2 border border-dashed border-ink/25 rounded-card p-4 cursor-pointer hover:border-chili/50 transition-colors">
          {logoPreview ? (
            <img src={logoPreview} className="w-16 h-16 rounded-xl object-cover" alt="" />
          ) : (
            <span className="w-16 h-16 rounded-xl bg-clay-light flex items-center justify-center"><Camera size={22} className="text-clay" /></span>
          )}
          <span className="text-xs text-clay text-center">Logo (small square, shown at the top)</span>
          <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadAndSet(e.target.files[0], "logo")} className="hidden" />
        </label>
        <label className="flex flex-col items-center gap-2 border border-dashed border-ink/25 rounded-card p-4 cursor-pointer hover:border-chili/50 transition-colors">
          {coverPreview ? (
            <img src={coverPreview} className="w-full h-16 rounded-xl object-cover" alt="" />
          ) : (
            <span className="w-full h-16 rounded-xl bg-clay-light flex items-center justify-center"><Camera size={22} className="text-clay" /></span>
          )}
          <span className="text-xs text-clay text-center">Full-screen background photo</span>
          <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && uploadAndSet(e.target.files[0], "cover")} className="hidden" />
        </label>
      </div>
      <div className="mt-4">
        <label className="block text-xs font-semibold text-ink mb-1.5">Tagline (shown under your name)</label>
        <div className="flex gap-2">
          <input
            value={tagline}
            onChange={(e) => setTagline(e.target.value)}
            placeholder="Discover today's delicious specials."
            className="flex-1 border border-ink/15 rounded-card px-3.5 py-2.5 text-sm bg-white"
          />
            <button
            onClick={saveTagline}
            disabled={savingProfile}
            className="bg-sprout hover:bg-sprout-dark disabled:opacity-60 transition-colors text-white font-semibold px-4 rounded-card text-sm"
          >
            {savingProfile ? "Saving..." : restaurant.tagline ? "Update" : "Save"}
          </button>
        </div>
      </div>
      <div className="mt-4">
        <label className="block text-xs font-semibold text-ink mb-1.5">Instagram page link (optional)</label>
        <p className="text-xs text-clay mb-1.5">
          Shows as a small Instagram icon (no text) near the bottom of the customer's menu page — tapping it opens your Instagram page.
        </p>
        <div className="flex gap-2">
          <input
            value={instagramUrl}
            onChange={(e) => setInstagramUrl(e.target.value)}
            placeholder="https://instagram.com/yourrestaurant"
            className="flex-1 border border-ink/15 rounded-card px-3.5 py-2.5 text-sm bg-white"
          />
          <button
            onClick={saveInstagram}
            disabled={savingProfile}
            className="bg-sprout hover:bg-sprout-dark disabled:opacity-60 transition-colors text-white font-semibold px-4 rounded-card text-sm"
          >
            {savingProfile ? "Saving..." : restaurant.instagram_url ? "Update" : "Save"}
          </button>
        </div>
      </div>
      <div className="mt-4">
        <label className="block text-xs font-semibold text-ink mb-1.5">Google review link (optional)</label>
        <p className="text-xs text-clay mb-1.5">
          Shows as a small Google icon next to Instagram — tapping it opens your restaurant's Google Maps
          listing so customers can leave you a review. Paste your Google Maps "write a review" link here.
        </p>
        <div className="flex gap-2">
          <input
            value={googleReviewUrl}
            onChange={(e) => setGoogleReviewUrl(e.target.value)}
            placeholder="https://g.page/r/your-restaurant/review"
            className="flex-1 border border-ink/15 rounded-card px-3.5 py-2.5 text-sm bg-white"
          />
          <button
            onClick={saveGoogleReview}
            disabled={savingProfile}
            className="bg-sprout hover:bg-sprout-dark disabled:opacity-60 transition-colors text-white font-semibold px-4 rounded-card text-sm"
          >
            {savingProfile ? "Saving..." : restaurant.google_review_url ? "Update" : "Save"}
          </button>
        </div>
      </div>
      <div className="mt-4">
        <label className="block text-xs font-semibold text-ink mb-1.5">Discount-applied message (optional)</label>
        <p className="text-xs text-clay mb-1.5">
          Shown to the customer right after they apply an offer or finish a feedback campaign at billing
          time. Leave blank to use the default message.
        </p>
        <div className="flex gap-2">
          <input
            value={offerSuccessMessage}
            onChange={(e) => setOfferSuccessMessage(e.target.value)}
            placeholder="Awesome! Your discount has been applied to this bill."
            className="flex-1 border border-ink/15 rounded-card px-3.5 py-2.5 text-sm bg-white"
          />
          <button
            onClick={saveOfferSuccessMessage}
            disabled={savingProfile}
            className="bg-sprout hover:bg-sprout-dark disabled:opacity-60 transition-colors text-white font-semibold px-4 rounded-card text-sm"
          >
            {savingProfile ? "Saving..." : restaurant.offer_success_message ? "Update" : "Save"}
          </button>
        </div>
      </div>
      <div className="mt-4">
        <label className="block text-xs font-semibold text-ink mb-1.5">Tagline messages (optional)</label>
        <p className="text-xs text-clay mb-1.5">
          Add one or more short lines shown above the Google/Instagram icons at the bottom of the
          customer's menu page -- e.g. "Exclusive discount today only!" Add as many as you like; they
          rotate one at a time.
        </p>
        <div className="flex gap-2 mb-2">
          <input
            value={newBannerText}
            onChange={(e) => setNewBannerText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addBannerMessage(); }}
            placeholder="e.g. Exclusive discount today only!"
            className="flex-1 border border-ink/15 rounded-card px-3.5 py-2.5 text-sm bg-white"
          />
          <button
            onClick={addBannerMessage}
            disabled={savingProfile || !newBannerText.trim()}
            className="bg-ink hover:bg-ink/90 disabled:opacity-40 transition-colors text-paper font-semibold px-4 rounded-card text-sm inline-flex items-center gap-1.5"
          >
            <Plus size={15} /> Add
          </button>
        </div>
        {bannerMessages.length > 0 && (
          <div className="grid gap-1.5">
            {bannerMessages.map((msg, idx) => (
              <div key={idx} className="flex items-center justify-between gap-2 bg-paper border border-ink/10 rounded-card px-3 py-2">
                <span className="text-sm text-ink flex items-center gap-1.5"><Sparkles size={13} className="text-turmeric flex-shrink-0" /> {msg}</span>
                <button onClick={() => removeBannerMessage(idx)} className="text-clay hover:text-chili-dark transition-colors flex-shrink-0">
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      {profileError && <p className="text-xs text-chili-dark font-medium mt-2">{profileError}</p>}
      {profileSaved && <p className="text-xs text-herb font-medium mt-2">Saved — reflected in the preview below.</p>}
    </div>
  );

  if (tables.length === 0) {
    return (
      <div className="max-w-md">
        {profileSection}
        <p className="text-sm text-ink/70">
          This is exactly what your customers see when they scan a table's QR code. You haven't
          added any tables yet — go to the <strong>Tables & QR</strong> tab to add your first one,
          then come back here to see it live.
        </p>
      </div>
    );
  }

  const previewUrl = `/r/${restaurant.slug}/table/${selectedTableNumber}`;

  return (
    <div>
      {profileSection}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <p className="text-sm font-semibold text-ink">Live customer view</p>
          <p className="text-xs text-clay">This is a real, working preview — not a mockup.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedTableNumber || ""}
            onChange={(e) => { setSelectedTableNumber(e.target.value); setReloadKey((k) => k + 1); }}
            className="text-sm border border-ink/15 rounded-card px-2.5 py-1.5 bg-white"
          >
            {tables.map((t) => (
              <option key={t.id} value={t.table_number}>Table {t.table_number}{t.active ? "" : " (inactive)"}</option>
            ))}
          </select>
          <button onClick={() => setReloadKey((k) => k + 1)} className="text-xs font-semibold text-chili px-2">
            Reload
          </button>
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-semibold bg-ink text-paper px-3.5 py-2 rounded-full"
          >
            Open in new tab ↗
          </a>
        </div>
      </div>

      <div className="bg-ink rounded-[2rem] p-3 max-w-sm mx-auto shadow-xl">
        <div className="bg-paper rounded-[1.5rem] overflow-hidden" style={{ height: "70vh" }}>
          <iframe key={reloadKey} src={previewUrl} title="Customer view" className="w-full h-full border-0" />
        </div>
      </div>
    </div>
  );
}

// ---------- Tables & QR ----------

function TablesTab({ restaurant, tables, setTables }) {
  const [newTableNumber, setNewTableNumber] = useState("");

  async function addTable() {
    if (!newTableNumber.trim()) return;
    const res = await fetch(`/api/admin/${restaurant.slug}/tables`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ table_number: newTableNumber.trim() }),
    });
    if (res.ok) {
      const data = await res.json();
      setTables((prev) => [...prev, data.table]);
      setNewTableNumber("");
    }
  }
  async function toggleActive(table) {
    const res = await fetch(`/api/admin/${restaurant.slug}/tables/${table.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: table.active ? 0 : 1 }),
    });
    if (res.ok) setTables((prev) => prev.map((t) => (t.id === table.id ? { ...t, active: table.active ? 0 : 1 } : t)));
  }

  return (
    <div>
      <div className="flex gap-2 mb-5">
        <input value={newTableNumber} onChange={(e) => setNewTableNumber(e.target.value)} placeholder="Table number, e.g. 7" className="border border-ink/15 rounded-card px-3.5 py-2 text-sm bg-white" />
        <button onClick={addTable} className="bg-ink text-paper px-4 rounded-card text-sm font-semibold">Add table</button>
      </div>
      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
        {tables.map((t) => (
          <Card key={t.id} className="p-4 text-center">
            <img src={`/api/admin/${restaurant.slug}/tables/${t.id}/qr`} alt={`QR for table ${t.table_number}`} className="w-32 h-32 mx-auto" />
            <p className="font-semibold text-ink mt-2">Table {t.table_number}</p>
            <p className="text-xs text-clay">/r/{restaurant.slug}/table/{t.table_number}</p>
            <div className="flex items-center justify-center gap-3 mt-2">
              <a href={`/r/${restaurant.slug}/table/${t.table_number}`} target="_blank" rel="noreferrer" className="text-xs text-ink/60 font-semibold">Preview</a>
              <a href={`/api/admin/${restaurant.slug}/tables/${t.id}/qr?download=1`} className="text-xs text-chili font-semibold">Download</a>
              <button onClick={() => toggleActive(t)} className="text-xs text-clay font-medium">{t.active ? "Deactivate" : "Activate"}</button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---------- Payment settings ----------

function PaymentSettingsTab({ restaurant, paymentSettings, setPaymentSettings }) {
  const [upiId, setUpiId] = useState(paymentSettings?.upi_id || "");
  const [qrPreview, setQrPreview] = useState(paymentSettings?.phonepe_qr_image_url || null);
  const [qrDataUrl, setQrDataUrl] = useState(null);
  const [onlineEnabled, setOnlineEnabled] = useState(paymentSettings?.online_enabled !== 0);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleQrImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setQrDataUrl(dataUrl);
    setQrPreview(dataUrl);
  }

  async function save() {
    setSaving(true);
    try {
      let qrUrl = paymentSettings?.phonepe_qr_image_url || "";
      if (qrDataUrl) {
        const upRes = await fetch("/api/uploads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataUrl: qrDataUrl }) });
        const upData = await upRes.json();
        if (upRes.ok) qrUrl = upData.url;
      }
      const res = await fetch(`/api/admin/${restaurant.slug}/payment-settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upi_id: upiId, phonepe_qr_image_url: qrUrl, online_enabled: onlineEnabled }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setQrPreview(qrUrl);
        setQrDataUrl(null);
        // Keep the parent's copy in sync so the printed receipt (which
        // always shows this QR, regardless of the toggle below) reflects
        // whatever was just saved without needing a page refresh.
        if (data.paymentSettings) setPaymentSettings(data.paymentSettings);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally { setSaving(false); }
  }

  return (
    <div className="max-w-md">
      <p className="text-sm text-ink/70 mb-4">
        Upload your PhonePe / UPI QR code image so customers can scan it directly at checkout.
        Payments go straight to your account — TableServe doesn't process them, so remember to
        confirm each "pending" payment on the Orders tab once you've verified it in your UPI app.
      </p>
      <label className="block text-sm font-semibold text-ink mb-1">UPI ID (shown as backup text)</label>
      <input value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="yourrestaurant@upi" className="w-full border border-ink/15 rounded-card px-3.5 py-2 text-sm bg-white mb-4" />

      <label className="block text-sm font-semibold text-ink mb-1">QR code image</label>
      <label className="flex items-center gap-3 border border-dashed border-ink/25 rounded-card p-3 cursor-pointer mb-4">
        {qrPreview ? <img src={qrPreview} className="w-16 h-16 rounded-lg object-cover" alt="" /> : <span className="w-16 h-16 rounded-lg bg-clay-light flex items-center justify-center"><QrCode size={24} className="text-clay" /></span>}
        <span className="text-xs text-clay">Upload a screenshot of your PhonePe/UPI QR code</span>
        <input type="file" accept="image/*" onChange={handleQrImage} className="hidden" />
      </label>

      <label className="flex items-start gap-2.5 mb-5 cursor-pointer">
        <input type="checkbox" checked={onlineEnabled} onChange={(e) => setOnlineEnabled(e.target.checked)} className="mt-0.5" />
        <span className="text-sm text-ink">
          <span className="font-semibold">Show this QR to customers on their phone</span>
          <span className="block text-xs text-clay mt-0.5">
            Turn this off if you'd rather show the QR yourself at the table instead — it'll still
            always appear on the printed/on-screen receipt either way.
          </span>
        </span>
      </label>

      <button disabled={saving} onClick={save} className="bg-sprout text-white px-5 py-2.5 rounded-card text-sm font-semibold disabled:opacity-60 inline-flex items-center gap-1.5">
        {saving ? "Saving..." : saved ? (<><Check size={15} /> Saved</>) : (paymentSettings?.upi_id || paymentSettings?.phonepe_qr_image_url ? "Update" : "Save")}
      </button>
    </div>
  );
}

// ---------- Billing ----------

function BillingTab({ restaurant, subscription, platformContact, orders, paymentProofs, setPaymentProofs }) {
  const [amountClaimed, setAmountClaimed] = useState("");
  const [note, setNote] = useState("");
  const [proofType, setProofType] = useState("subscription"); // "subscription" | "platform_fee"
  const [proofPreview, setProofPreview] = useState(null);
  const [proofDataUrl, setProofDataUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadDone, setUploadDone] = useState(false);

  // "This month's amount due" = the flat monthly subscription fee, PLUS
  // every per-order platform fee that hasn't been settled/collected yet.
  // Computed straight from the live `orders` list (already polling every
  // 2s), using the settled flag joined into each order — so it updates
  // within seconds of an order being placed or deleted, no page refresh
  // needed, and never resets to 0 on its own.
  const platformFeeEnabled = subscription ? subscription.platform_fee_enabled !== 0 : true;
  const platformFeesOwed = useMemo(() => {
    return orders.reduce((sum, o) => {
      if (o.platform_fee_settled) return sum;
      return sum + (o.platform_fee || 0);
    }, 0);
  }, [orders]);

  if (!subscription) return <p className="text-clay text-sm">No subscription record yet.</p>;

  const subscriptionAmountDue = Math.round(subscription.onboarding_paid ? subscription.monthly_fee : subscription.onboarding_fee);

  // Shows a "you paid successfully" confirmation the moment we acknowledge
  // a subscription payment proof, for as long as it's within the current
  // billing cycle (it clears again once a new cycle starts without a new
  // confirmed payment).
  const paidThisCycle =
    subscription.last_payment_confirmed_at &&
    (!subscription.billing_cycle_start || parseDbDate(subscription.last_payment_confirmed_at) >= parseDbDate(subscription.billing_cycle_start));

  async function handleProofImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setProofDataUrl(dataUrl);
    setProofPreview(dataUrl);
  }

  async function submitProof() {
    if (!proofDataUrl) {
      setUploadError("Please attach a screenshot of your payment first.");
      return;
    }
    setUploading(true);
    setUploadError("");
    try {
      const res = await fetch(`/api/admin/${restaurant.slug}/payment-proof`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl: proofDataUrl, amountClaimed: amountClaimed || null, note, type: proofType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not submit payment proof.");
      setPaymentProofs((prev) => [data.proof, ...prev]);
      setProofPreview(null);
      setProofDataUrl(null);
      setAmountClaimed("");
      setNote("");
      setProofType("subscription");
      setUploadDone(true);
      setTimeout(() => setUploadDone(false), 3000);
    } catch (e) {
      setUploadError(e.message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="max-w-md grid gap-5">
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <p className="font-display font-bold text-ink">{subscription.plan_name} plan</p>
          <StatusPill status={restaurant.status} />
        </div>
        <div className="mt-4 grid gap-2 text-sm">
          <Row label="Onboarding fee" value={`₹${subscription.onboarding_fee} (${subscription.onboarding_paid ? "paid" : "pending"})`} />
          <Row label="Monthly fee" value={`₹${subscription.monthly_fee}/month`} />
          <Row label="Current cycle" value={`${subscription.billing_cycle_start} → ${subscription.billing_cycle_end}`} />
          <Row label="Grace period" value={`${subscription.grace_period_days} days after due date`} />
        </div>
        <div className="mt-4 pt-4 border-t border-ink/10 flex items-center justify-between">
          <span className="text-sm font-semibold text-ink">Subscription due now</span>
          <span className="font-display text-xl font-bold text-chili-dark">₹{subscriptionAmountDue}</span>
        </div>
        {paidThisCycle && (
          <p className="text-xs font-semibold text-herb mt-3 bg-herb/10 rounded-card px-3 py-2">
            ✓ You paid successfully this month — thank you!
          </p>
        )}
      </Card>

      <Card className="p-5 text-center">
        <p className="font-semibold text-ink text-sm mb-3">Pay your subscription anytime</p>
        {platformContact?.phonepe_qr_image_url ? (
          <img src={platformContact.phonepe_qr_image_url} alt="Pay via UPI" className="w-36 h-36 mx-auto rounded-lg" />
        ) : (
          <div className="w-36 h-36 mx-auto rounded-lg bg-paper border border-dashed border-ink/20 flex items-center justify-center text-xs text-clay px-4">
            QR not available yet
          </div>
        )}
        <p className="text-sm font-semibold text-ink mt-3">₹{subscriptionAmountDue} due</p>
        {platformContact?.phone && (
          <p className="text-xs text-clay mt-1">Or call/WhatsApp {platformContact.phone}</p>
        )}
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-ink text-sm">Platform fees</p>
          {!platformFeeEnabled && (
            <span className="text-xs font-semibold bg-herb/15 text-herb px-2.5 py-1 rounded-full">Waived for you</span>
          )}
        </div>

        {platformFeeEnabled ? (
          <>
            <p className="text-xs text-clay mt-1.5 mb-3">
              This is separate from your subscription above — it's the small per-order fee already
              built into what your customers pay you. It updates live as orders come in and is
              paid to us separately, whenever you're ready.
            </p>
            <div className="flex items-center justify-between pt-1">
              <span className="text-sm font-semibold text-ink">Platform fees owed</span>
              <span className="font-display text-xl font-bold text-chili-dark">₹{Math.round(platformFeesOwed)}</span>
            </div>
            {platformFeesOwed > 0 && (
              <div className="mt-4 pt-4 border-t border-ink/10 text-center">
                {platformContact?.phonepe_qr_image_url ? (
                  <img src={platformContact.phonepe_qr_image_url} alt="Pay via UPI" className="w-28 h-28 mx-auto rounded-lg" />
                ) : (
                  <div className="w-28 h-28 mx-auto rounded-lg bg-paper border border-dashed border-ink/20 flex items-center justify-center text-xs text-clay px-3">
                    QR not available yet
                  </div>
                )}
                {platformContact?.phone && (
                  <p className="text-xs text-clay mt-2">Or call/WhatsApp {platformContact.phone}</p>
                )}
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-clay mt-1.5">
            Platform fees have been switched off for your account — your customers won't be
            charged the extra per-order fee, and nothing accrues here.
          </p>
        )}
      </Card>

      <Card className="p-5">
        <p className="font-semibold text-ink text-sm mb-1">Submit proof of payment</p>
        <p className="text-xs text-clay mb-3">
          After paying, upload a screenshot here — it appears instantly on our side with the date and
          time, so we can confirm and activate your account without you needing to message us separately.
        </p>
        <label className="flex items-center gap-3 border border-dashed border-ink/25 rounded-card p-3 cursor-pointer hover:border-chili/50 transition-colors">
          {proofPreview ? (
            <img src={proofPreview} className="w-14 h-14 rounded-lg object-cover flex-shrink-0" alt="" />
          ) : (
            <span className="w-14 h-14 rounded-lg bg-clay-light flex items-center justify-center flex-shrink-0">
              <Upload size={20} className="text-clay" />
            </span>
          )}
          <span className="text-xs text-clay">Click to upload your payment screenshot</span>
          <input type="file" accept="image/*" onChange={handleProofImage} className="hidden" />
        </label>

        <div className="mt-3">
          <label className="block text-xs font-semibold text-ink mb-1.5">What is this payment for?</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setProofType("subscription")}
              className={`flex-1 text-xs font-semibold py-2 rounded-card border ${proofType === "subscription" ? "bg-sprout text-white border-sprout" : "border-ink/15 text-ink/70"}`}
            >
              Subscription
            </button>
            <button
              type="button"
              onClick={() => setProofType("platform_fee")}
              className={`flex-1 text-xs font-semibold py-2 rounded-card border ${proofType === "platform_fee" ? "bg-sprout text-white border-sprout" : "border-ink/15 text-ink/70"}`}
            >
              Platform fee
            </button>
          </div>
        </div>
        <input
          type="number"
          value={amountClaimed}
          onChange={(e) => setAmountClaimed(e.target.value)}
          placeholder="Amount paid (optional)"
          className="w-full border border-ink/15 rounded-card px-3.5 py-2.5 text-sm bg-white mt-3"
        />
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Reference / note (optional)"
          rows={2}
          className="w-full border border-ink/15 rounded-card px-3.5 py-2.5 text-sm bg-white mt-2"
        />
        {uploadError && <p className="text-xs text-chili-dark font-medium mt-2">{uploadError}</p>}
        <button
          onClick={submitProof}
          disabled={uploading}
          className="bg-sprout hover:bg-sprout-dark disabled:opacity-60 transition-colors text-white font-semibold px-5 py-2.5 rounded-card text-sm mt-3 w-full"
        >
          {uploading ? "Submitting..." : uploadDone ? "Submitted ✓" : "Submit payment proof"}
        </button>

        {paymentProofs.length > 0 && (
          <div className="mt-5 pt-4 border-t border-ink/10 grid gap-2">
            <p className="text-xs font-semibold text-ink">Your past submissions</p>
            {paymentProofs.map((p) => (
              <div key={p.id} className="flex items-center gap-3 text-xs">
                <img src={p.image_url} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" alt="" />
                <div className="flex-1">
                  <p className="text-ink font-medium">
                    {p.amount_claimed ? `₹${p.amount_claimed}` : "Payment proof"}
                    <span className="text-clay font-normal"> · {p.type === "platform_fee" ? "platform fee" : "subscription"}</span>
                  </p>
                  <p className="text-clay">{parseDbDate(p.created_at).toLocaleString()}</p>
                </div>
                <span className={`font-semibold px-2 py-1 rounded-full ${p.status === "acknowledged" ? "bg-herb/15 text-herb" : "bg-turmeric/25 text-chili-dark"}`}>
                  {p.status === "acknowledged" ? "Confirmed" : "Pending review"}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between text-ink/70">
      <span>{label}</span>
      <span className="font-medium text-ink">{value}</span>
    </div>
  );
}
