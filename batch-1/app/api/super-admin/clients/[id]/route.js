import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authSuperAdmin } from "@/lib/posAuth";
import { cleanClient, syncToSubscription, withLiveFees } from "@/lib/clientRegister";

export async function PATCH(request, { params }) {
  if (!(await authSuperAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const old = db.prepare("SELECT * FROM client_register WHERE id = ?").get(id);
  if (!old) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const c = cleanClient({ ...withLiveFees(db, [old])[0], ...body });
  if (c.error) return NextResponse.json({ error: c.error }, { status: 400 });
  db.prepare(
    `UPDATE client_register SET business_name=@business_name, owner_name=@owner_name, phone=@phone, email=@email, city=@city,
       address=@address, gstin=@gstin, install_type=@install_type, restaurant_id=@restaurant_id, machine_code=@machine_code,
       licence_key=@licence_key, licence_expires_on=@licence_expires_on, amount_paid=@amount_paid, platform_fee=@platform_fee, monthly_fee=@monthly_fee, onboarding_fee=@onboarding_fee, fee_paid_total=@fee_paid_total, extra_amount=@extra_amount, extra_note=@extra_note, status=@status, notes=@notes,
       updated_at=datetime('now') WHERE id=@id`
  ).run({ id, ...c.value });
  syncToSubscription(db, c.value);
  return NextResponse.json({ client: withLiveFees(db, [db.prepare("SELECT * FROM client_register WHERE id = ?").get(id)])[0] });
}

export async function DELETE(_request, { params }) {
  if (!(await authSuperAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  db.prepare("DELETE FROM client_register WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}
