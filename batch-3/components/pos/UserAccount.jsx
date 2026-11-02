"use client";
import { useState } from "react";
import { Mail, Phone, MapPin, FileText, Pencil, Camera, Check, Info, Building2 } from "lucide-react";
import Monogram from "@/components/Monogram";
import { Card, PageTitle, TextField, fileToDataUrl } from "./shared";

export default function UserAccount({ restaurant, userEmail, userName, onRestaurantUpdate, goToTaxes }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [logoData, setLogoData] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  function startEdit() {
    setForm({
      name: restaurant.name || "", phone: restaurant.phone || "", address: restaurant.address || "",
      gst_number: restaurant.gst_number || "", fssai_number: restaurant.fssai_number || "",
      receipt_footer: restaurant.receipt_footer && restaurant.receipt_footer !== "Thank you! Visit again." ? restaurant.receipt_footer : "Thank you for visiting!", tagline: restaurant.tagline || "",
    });
    setLogoData(null); setError(""); setEditing(true);
  }

  async function save() {
    setSaving(true); setError("");
    try {
      let logo = restaurant.logo_image_url;
      if (logoData) {
        const up = await fetch("/api/uploads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataUrl: logoData }) });
        const upd = await up.json();
        if (!up.ok) throw new Error(upd.error);
        logo = upd.url;
      }
      const res = await fetch(`/api/admin/${restaurant.slug}/account`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, logo_image_url: logo }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onRestaurantUpdate((r) => ({ ...r, ...data.restaurant }));
      setEditing(false); setSaved(true); setTimeout(() => setSaved(false), 2500);
    } catch (e) { setError(e.message || "Could not save."); }
    finally { setSaving(false); }
  }

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const logoSrc = logoData || restaurant.logo_image_url;

  const rows = [
    [Mail, "Email", userEmail || "—"],
    [Phone, "Phone", restaurant.phone || "Not added"],
    [MapPin, "Address", restaurant.address || "Not added"],
    [FileText, "GST number", restaurant.gst_number || "Not added"],
    [Building2, "FSSAI licence", restaurant.fssai_number || "Not added"],
  ];

  return (
    <div>
      <PageTitle title="User Account" subtitle="Your business details. They print on every receipt." />

      <div className="grid lg:grid-cols-[320px_1fr] gap-6 items-start">
        <Card className="p-6 text-center">
          <div className="relative w-28 h-28 mx-auto">
            {logoSrc ? <img src={logoSrc} alt="" className="w-28 h-28 rounded-2xl object-cover ring-2 ring-sprout/20" />
              : <Monogram name={restaurant.name} className="w-28 h-28 text-3xl" />}
            {editing && (
              <label className="absolute -bottom-2 -right-2 bg-ink text-paper rounded-full p-2 cursor-pointer shadow-lg" title="Change logo">
                <Camera size={15} />
                <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setLogoData(await fileToDataUrl(f)); }} />
              </label>
            )}
          </div>
          <h3 className="font-display text-xl font-bold text-ink mt-4">{restaurant.name}</h3>
          {userName && <p className="text-sm text-clay">{userName}</p>}
          <p className="text-xs text-clay mt-0.5">{userEmail}</p>
          {restaurant.gst_number
            ? <span className="inline-block mt-3 text-[11px] font-semibold bg-sprout/10 text-sprout-dark px-2.5 py-1 rounded-full">GST registered</span>
            : <span className="inline-block mt-3 text-[11px] font-semibold bg-turmeric/20 text-chili-dark px-2.5 py-1 rounded-full">GST number not added</span>}
        </Card>

        <div className="grid gap-5">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display font-bold text-ink">Business details</h3>
              {!editing && (
                <button onClick={startEdit} className="text-xs font-semibold text-sprout-dark inline-flex items-center gap-1">
                  {saved ? <><Check size={13} /> Saved</> : <><Pencil size={13} /> Edit</>}
                </button>
              )}
            </div>

            {!editing ? (
              <div className="divide-y divide-ink/10">
                {rows.map(([Icon, label, value]) => (
                  <div key={label} className="flex items-start gap-3 py-3">
                    <Icon size={16} className="text-clay mt-0.5 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[11px] text-clay uppercase tracking-wide">{label}</p>
                      <p className="text-sm text-ink break-words">{value}</p>
                    </div>
                  </div>
                ))}
                <div className="flex items-start gap-3 py-3">
                  <FileText size={16} className="text-clay mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-[11px] text-clay uppercase tracking-wide">Receipt footer message</p>
                    <p className="text-sm text-ink">{restaurant.receipt_footer && restaurant.receipt_footer !== "Thank you! Visit again." ? restaurant.receipt_footer : "Thank you for visiting!"}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-3">
                <TextField label="Restaurant / hotel name" value={form.name} onChange={set("name")} maxLength={80} />
                <TextField label="Login email" value={userEmail} disabled hint="This is your login. Contact support to change it." onChange={() => {}} />
                <TextField label="Phone" value={form.phone} onChange={set("phone")} placeholder="+91 98765 43210" maxLength={30} />
                <TextField label="Address" value={form.address} onChange={set("address")} maxLength={200} />
                <TextField label="GST number (GSTIN)" value={form.gst_number} onChange={(v) => set("gst_number")(v.toUpperCase())} placeholder="29ABCDE1234F1Z5" maxLength={15} hint="15 characters. Leave blank if you are not GST registered." />
                <TextField label="FSSAI licence number (optional)" value={form.fssai_number} onChange={set("fssai_number")} maxLength={20} />
                <TextField label="Receipt footer message" value={form.receipt_footer} onChange={set("receipt_footer")} maxLength={120} />
                {error && <p className="text-xs text-chili-dark">{error}</p>}
                <div className="flex gap-2 pt-1">
                  <button onClick={save} disabled={saving} className="bg-sprout text-white font-bold px-5 py-2 rounded-card text-sm disabled:opacity-50">{saving ? "Saving…" : "Save changes"}</button>
                  <button onClick={() => setEditing(false)} className="px-4 py-2 rounded-card border border-ink/15 text-sm text-ink/70">Cancel</button>
                </div>
              </div>
            )}
          </Card>

          <Card className="p-5 bg-turmeric/10 border-turmeric/40">
            <div className="flex gap-3">
              <Info size={18} className="text-chili-dark flex-shrink-0 mt-0.5" />
              <div className="text-sm text-ink/80 grid gap-2">
                <p className="font-semibold text-ink">Why does the GST number matter?</p>
                <p>A GST-registered business must show its GSTIN and the tax split on every bill for it to count as a valid tax invoice. Your GSTIN and tax lines are printed automatically on each receipt.</p>
                <p>The tax rate is not fixed. Set the rates that apply to you (for example CGST and SGST) in the <button onClick={goToTaxes} className="font-semibold underline">Taxes tab</button>. Ask your accountant which rate applies to your hotel.</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
