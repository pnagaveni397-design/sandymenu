"use client";
import { useEffect, useMemo, useState } from "react";
import { Users, Plus, Search, Phone, Mail, Pencil, Trash2, Download, X } from "lucide-react";

const EMPTY = {
  business_name: "", owner_name: "", phone: "", email: "", city: "", address: "", gstin: "",
  install_type: "hosted", restaurant_id: "", machine_code: "", licence_key: "", licence_expires_on: "",
  amount_paid: 0, platform_fee: "", monthly_fee: "", onboarding_fee: "", fee_paid_total: 0, extra_amount: 0, extra_note: "", status: "active", notes: "",
};
const STATUS = { trial: "Trial", active: "Active", suspended: "Suspended", closed: "Closed" };
const STATUS_CLS = {
  trial: "bg-clay-light text-clay", active: "bg-herb/15 text-herb",
  suspended: "bg-chili/15 text-chili-dark", closed: "bg-ink/10 text-ink/60",
};

// Everything you need to know about each client in one place: contact details,
// fees and billing. Only visible to the Super Admin.
export default function ClientRegister({ restaurants = [] }) {
  const [clients, setClients] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState(null); // null | {id?, ...fields}
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const [note, setNote] = useState("");

  async function load() {
    const res = await fetch("/api/super-admin/clients");
    if (res.ok) { setClients((await res.json()).clients); setLoaded(true); }
  }
  useEffect(() => { load(); }, []);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return clients.filter((c) => {
      if (s && ![c.business_name, c.owner_name, c.phone, c.email, c.city, c.gstin].some((v) => (v || "").toLowerCase().includes(s))) return false;
      return true;
    });
  }, [clients, q]);

  async function save() {
    setSaving(true); setError("");
    try {
      const isNew = !editing.id;
      const res = await fetch(isNew ? "/api/super-admin/clients" : `/api/super-admin/clients/${editing.id}`, {
        method: isNew ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editing),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save.");
      setEditing(null);
      await load();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  async function remove(id) {
    await fetch(`/api/super-admin/clients/${id}`, { method: "DELETE" });
    setConfirmDel(null);
    load();
  }

  async function importHosted() {
    const res = await fetch("/api/super-admin/clients", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ import_hosted: true }) });
    const data = await res.json();
    if (res.ok) { setClients(data.clients); setNote(data.added ? `Added ${data.added} hosted restaurant(s).` : "All hosted restaurants are already in the register."); setTimeout(() => setNote(""), 4000); }
  }

  const set = (k, v) => setEditing((e) => ({ ...e, [k]: v }));
  const input = "w-full border border-ink/15 rounded-card px-3 py-2 text-sm bg-white";
  const lbl = "block text-xs font-semibold text-ink mb-1";

  return (
    <section>
      <div className="flex items-center gap-3 flex-wrap mb-1">
        <h2 className="font-display text-lg font-bold text-ink flex items-center gap-2"><Users size={18} /> Clients</h2>
        <span className="text-xs font-bold bg-ink/10 text-ink/70 px-2 py-0.5 rounded-full">{clients.length}</span>
      </div>
      <p className="text-sm text-clay mb-4 max-w-2xl">
        Every client's details in one place: contact, fees and billing. Only you can see this.
      </p>

      <div className="flex gap-2 flex-wrap items-center mb-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-clay" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, phone, city…" className="border border-ink/15 rounded-full pl-8 pr-3 py-2 text-sm bg-white w-72 max-w-full" />
        </div>
        <button onClick={() => { setError(""); setEditing({ ...EMPTY }); }} className="bg-sprout hover:bg-sprout-dark text-white text-xs font-semibold px-4 py-2.5 rounded-full inline-flex items-center gap-1.5"><Plus size={14} /> Add client</button>
        <button onClick={importHosted} className="bg-white border border-ink/15 text-ink text-xs font-semibold px-4 py-2.5 rounded-full inline-flex items-center gap-1.5"><Download size={13} /> Import hosted restaurants</button>
        {note && <span className="text-xs text-herb font-medium">{note}</span>}
      </div>

      {editing && (
        <div className="bg-white border border-ink/15 rounded-2xl p-5 mb-5 max-w-3xl">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-semibold text-ink">{editing.id ? "Edit client" : "Add a client"}</p>
            <button onClick={() => setEditing(null)} aria-label="Close" className="text-clay"><X size={16} /></button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2"><label className={lbl}>Business name *</label><input className={input} value={editing.business_name} onChange={(e) => set("business_name", e.target.value)} /></div>
            <div><label className={lbl}>Owner name</label><input className={input} value={editing.owner_name} onChange={(e) => set("owner_name", e.target.value)} /></div>
            <div><label className={lbl}>Phone</label><input className={input} value={editing.phone} onChange={(e) => set("phone", e.target.value)} /></div>
            <div><label className={lbl}>Email</label><input className={input} value={editing.email} onChange={(e) => set("email", e.target.value)} /></div>
            <div><label className={lbl}>City</label><input className={input} value={editing.city} onChange={(e) => set("city", e.target.value)} /></div>
            <div className="sm:col-span-2"><label className={lbl}>Address</label><input className={input} value={editing.address} onChange={(e) => set("address", e.target.value)} /></div>
            <div><label className={lbl}>GSTIN</label><input className={input} value={editing.gstin} onChange={(e) => set("gstin", e.target.value)} /></div>
            <div><label className={lbl}>Monthly fee (₹)</label><input type="number" min="0" className={input} value={editing.monthly_fee ?? ""} onChange={(e) => set("monthly_fee", e.target.value)} placeholder="Empty = your default fee" /></div>
            <div><label className={lbl}>Onboarding fee (₹, one-time)</label><input type="number" min="0" className={input} value={editing.onboarding_fee ?? ""} onChange={(e) => set("onboarding_fee", e.target.value)} placeholder="Empty = your default fee" /></div>
            <div><label className={lbl}>Platform fee per order (₹)</label><input type="number" min="0" step="0.5" className={input} value={editing.platform_fee ?? ""} onChange={(e) => set("platform_fee", e.target.value)} placeholder="Empty = your default fee" /></div>
            <div><label className={lbl}>Extra amount billed so far (₹)</label><input type="number" min="0" className={input} value={editing.extra_amount ?? 0} onChange={(e) => set("extra_amount", e.target.value)} /></div>
            <div><label className={lbl}>Platform fee received so far (₹)</label><input type="number" min="0" className={input} value={editing.fee_paid_total ?? 0} onChange={(e) => set("fee_paid_total", e.target.value)} /></div>
            <p className="sm:col-span-2 text-[11px] text-clay -mt-1">Both amounts are running totals. To bill something new, add it to the extra amount. When money arrives, add it to "received so far". The client sees what is still owed (fees + extra − received).</p>
            <div className="sm:col-span-2"><label className={lbl}>What is the extra amount for? <span className="font-normal text-clay">(client sees this in Billing and Platform fees)</span></label><input className={input} value={editing.extra_note || ""} onChange={(e) => set("extra_note", e.target.value)} placeholder="e.g. Installation charge" /></div>
            <div><label className={lbl}>Total paid (₹)</label><input type="number" min="0" className={input} value={editing.amount_paid} onChange={(e) => set("amount_paid", e.target.value)} /></div>
            <div>
              <label className={lbl}>Status</label>
              <select className={input} value={editing.status} onChange={(e) => set("status", e.target.value)}>
                {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2"><label className={lbl}>Notes (only you see this)</label><textarea rows={2} className={input} value={editing.notes} onChange={(e) => set("notes", e.target.value)} /></div>
          </div>
          {error && <p className="text-xs text-chili-dark font-medium mt-3">{error}</p>}
          <div className="flex gap-2 mt-4">
            <button onClick={save} disabled={saving} className="bg-sprout hover:bg-sprout-dark disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-card text-sm">{saving ? "Saving…" : "Save client"}</button>
            <button onClick={() => setEditing(null)} className="text-sm font-semibold text-ink/60 px-3">Cancel</button>
          </div>
        </div>
      )}

      {!loaded ? <p className="text-sm text-clay">Loading…</p> : shown.length === 0 ? (
        <p className="text-sm text-clay bg-white border border-ink/10 rounded-2xl p-6 text-center max-w-2xl">
          {clients.length === 0 ? "No clients yet. Tap “Add client”, or “Import hosted restaurants” to bring in the ones already on your platform." : "No clients match."}
        </p>
      ) : (
        <div className="grid gap-3 max-w-3xl">
          {shown.map((c) => {
            return (
              <div key={c.id} className="bg-white border border-ink/10 rounded-2xl p-4">
                <div className="flex items-start gap-2 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-bold text-ink">{c.business_name}</p>
                    <p className="text-xs text-clay">{[c.owner_name, c.city].filter(Boolean).join(" · ") || "—"}</p>
                  </div>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${STATUS_CLS[c.status] || ""}`}>{STATUS[c.status] || c.status}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-ink/80">
                  {c.phone && <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1.5"><Phone size={12} /> {c.phone}</a>}
                  {c.email && <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1.5"><Mail size={12} /> {c.email}</a>}
                  {c.gstin && <span>GSTIN {c.gstin}</span>}
                  {c.amount_paid > 0 && <span>Paid ₹{Number(c.amount_paid).toLocaleString("en-IN")}</span>}
                  {c.monthly_fee !== null && c.monthly_fee !== undefined && c.monthly_fee !== "" && <span>Monthly ₹{c.monthly_fee}</span>}
                  {c.onboarding_fee !== null && c.onboarding_fee !== undefined && c.onboarding_fee !== "" && <span>Onboarding ₹{c.onboarding_fee}</span>}
                  {c.platform_fee !== null && c.platform_fee !== undefined && c.platform_fee !== "" && <span>Fee ₹{c.platform_fee}/order</span>}
                  {c.fee_paid_total > 0 && <span>Received ₹{Number(c.fee_paid_total).toLocaleString("en-IN")}</span>}
                  {c.extra_amount > 0 && <span>Extra billed ₹{Number(c.extra_amount).toLocaleString("en-IN")}{c.extra_note ? ` (${c.extra_note})` : ""}</span>}
                </div>
                {c.address && <p className="text-xs text-clay mt-1.5">{c.address}</p>}
                {c.notes && <p className="text-xs text-ink/70 mt-2 whitespace-pre-wrap">📝 {c.notes}</p>}
                <div className="mt-3 flex gap-3 items-center">
                  <button onClick={() => { setError(""); setEditing({ ...EMPTY, ...c, restaurant_id: c.restaurant_id || "" }); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="text-xs font-semibold text-sprout-dark inline-flex items-center gap-1"><Pencil size={12} /> Edit</button>
                  {c.restaurant_id && <a href={`/api/super-admin/open-dashboard/${c.restaurant_id}`} target="_blank" rel="noreferrer" className="text-xs font-semibold text-ink underline inline-flex items-center gap-1">Open dashboard</a>}
                  {confirmDel === c.id ? (
                    <span className="text-xs inline-flex items-center gap-2">Delete this client?
                      <button onClick={() => remove(c.id)} className="font-bold text-chili-dark">Yes, delete</button>
                      <button onClick={() => setConfirmDel(null)} className="text-clay">No</button>
                    </span>
                  ) : (
                    <button onClick={() => setConfirmDel(c.id)} className="text-xs font-semibold text-clay hover:text-chili-dark inline-flex items-center gap-1"><Trash2 size={12} /> Delete</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
