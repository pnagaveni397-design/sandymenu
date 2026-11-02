import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { newId } from "@/lib/ids";
import { authSuperAdmin } from "@/lib/posAuth";
import { cleanClient, syncToSubscription, withLiveFees } from "@/lib/clientRegister";

// Super Admin only: the register of every client.
export async function GET() {
  if (!(await authSuperAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const clients = db.prepare("SELECT * FROM client_register ORDER BY created_at DESC").all();
  return NextResponse.json({ clients: withLiveFees(db, clients) });
}

export async function POST(request) {
  if (!(await authSuperAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));

  // One click: add every hosted restaurant that is not in the register yet.
  if (body.import_hosted) {
    const rows = db.prepare(
      `SELECT r.id, r.name, r.phone, r.address, r.gst_number,
              (SELECT u.email FROM restaurant_users ru JOIN users u ON u.id = ru.user_id WHERE ru.restaurant_id = r.id LIMIT 1) AS email
       FROM restaurants r WHERE r.id NOT IN (SELECT restaurant_id FROM client_register WHERE restaurant_id IS NOT NULL)`
    ).all();
    const ins = db.prepare(
      `INSERT INTO client_register (id, business_name, phone, email, address, gstin, install_type, restaurant_id) VALUES (?, ?, ?, ?, ?, ?, 'hosted', ?)`
    );
    db.transaction(() => rows.forEach((r) => ins.run(newId(), r.name || "Restaurant", r.phone || "", r.email || "", r.address || "", r.gst_number || "", r.id)))();
    return NextResponse.json({ added: rows.length, clients: db.prepare("SELECT * FROM client_register ORDER BY created_at DESC").all() });
  }

  const c = cleanClient(body);
  if (c.error) return NextResponse.json({ error: c.error }, { status: 400 });
  const id = newId();
  db.prepare(
    `INSERT INTO client_register (id, business_name, owner_name, phone, email, city, address, gstin, install_type, restaurant_id,
       machine_code, licence_key, licence_expires_on, amount_paid, platform_fee, monthly_fee, onboarding_fee, fee_paid_total, extra_amount, extra_note, status, notes)
     VALUES (@id, @business_name, @owner_name, @phone, @email, @city, @address, @gstin, @install_type, @restaurant_id,
       @machine_code, @licence_key, @licence_expires_on, @amount_paid, @platform_fee, @monthly_fee, @onboarding_fee, @fee_paid_total, @extra_amount, @extra_note, @status, @notes)`
  ).run({ id, ...c.value });
  syncToSubscription(db, c.value);
  return NextResponse.json({ client: withLiveFees(db, [db.prepare("SELECT * FROM client_register WHERE id = ?").get(id)])[0] });
}
