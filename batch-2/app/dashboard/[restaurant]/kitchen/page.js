import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getUserByToken, userHasAccessToRestaurant, SESSION_COOKIE } from "@/lib/auth";
import KitchenApp from "./KitchenApp";

export default function KitchenPage({ params }) {
  const restaurant = db.prepare("SELECT * FROM restaurants WHERE slug = ?").get(params.restaurant);

  if (!restaurant) {
    return (
      <main className="min-h-screen bg-ink flex items-center justify-center">
        <p className="text-paper/60">No restaurant found for "{params.restaurant}".</p>
      </main>
    );
  }

  const token = cookies().get(SESSION_COOKIE)?.value;
  const user = getUserByToken(token);
  if (!user) redirect(`/login?next=/dashboard/${params.restaurant}/kitchen`);
  if (!userHasAccessToRestaurant(user.id, restaurant.id)) {
    return (
      <main className="min-h-screen bg-ink flex items-center justify-center px-6 text-center">
        <p className="text-paper/60">Your account doesn't have access to this restaurant's kitchen screen.</p>
      </main>
    );
  }

  const orders = db
    .prepare(
      `SELECT o.*, t.table_number FROM orders o
       LEFT JOIN tables t ON t.id = o.table_id
       WHERE o.restaurant_id = ? AND o.status IN ('pending', 'preparing')
       ORDER BY o.created_at ASC`
    )
    .all(restaurant.id);

  const items = orders.map((o) => ({
    ...o,
    items: db.prepare("SELECT * FROM order_items WHERE order_id = ?").all(o.id),
  }));

  return <KitchenApp restaurant={restaurant} orders={items} />;
}
