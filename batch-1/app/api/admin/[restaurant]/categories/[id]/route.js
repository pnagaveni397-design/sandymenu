import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(request, { params }) {
  const { name, active } = await request.json();
  const category = db.prepare("SELECT * FROM categories WHERE id = ?").get(params.id);
  if (!category) return NextResponse.json({ error: "Not found" }, { status: 404 });

  db.prepare("UPDATE categories SET name = ?, active = ? WHERE id = ?").run(
    name ?? category.name,
    active === undefined ? category.active : (active ? 1 : 0),
    category.id
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(request, { params }) {
  const category = db.prepare("SELECT * FROM categories WHERE id = ?").get(params.id);
  if (!category) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const itemCount = db.prepare("SELECT COUNT(*) c FROM menu_items WHERE category_id = ?").get(category.id).c;
  const force = new URL(request.url).searchParams.get("force") === "1";
  if (itemCount > 0 && force) {
    // Delete the category together with its items. Past bills keep the item
    // name and price; only their link to the (now deleted) menu item is cleared.
    db.transaction(() => {
      const ids = db.prepare("SELECT id FROM menu_items WHERE category_id = ?").all(category.id).map((r) => r.id);
      for (const id of ids) {
        db.prepare("UPDATE order_items SET menu_item_id = NULL WHERE menu_item_id = ?").run(id);
        db.prepare("DELETE FROM menu_item_addons WHERE menu_item_id = ?").run(id);
        db.prepare("DELETE FROM menu_items WHERE id = ?").run(id);
      }
      db.prepare("DELETE FROM categories WHERE id = ?").run(category.id);
    })();
    return NextResponse.json({ ok: true, deletedItems: itemCount });
  }
  if (itemCount > 0) {
    return NextResponse.json(
      { error: `Move or delete the ${itemCount} item(s) in this category first.` },
      { status: 409 }
    );
  }

  db.prepare("DELETE FROM categories WHERE id = ?").run(category.id);
  return NextResponse.json({ ok: true });
}
