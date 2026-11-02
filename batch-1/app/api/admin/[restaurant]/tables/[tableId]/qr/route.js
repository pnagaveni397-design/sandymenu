import { db } from "@/lib/db";
import QRCode from "qrcode";
import { getBaseUrl } from "@/lib/baseUrl";

export async function GET(request, { params }) {
  const table = db.prepare("SELECT * FROM tables WHERE id = ?").get(params.tableId);
  if (!table) return new Response("Not found", { status: 404 });

  const restaurant = db.prepare("SELECT * FROM restaurants WHERE id = ?").get(table.restaurant_id);
  const origin = getBaseUrl(request);
  const targetUrl = `${origin}/r/${restaurant.slug}/table/${table.table_number}`;

  const buffer = await QRCode.toBuffer(targetUrl, { width: 400, margin: 1, color: { dark: "#20261F", light: "#FBF6EA" } });

  const { searchParams } = new URL(request.url);
  const headers = { "Content-Type": "image/png" };
  if (searchParams.get("download")) {
    headers["Content-Disposition"] = `attachment; filename="table-${table.table_number}-qr.png"`;
  }

  return new Response(buffer, { headers });
}
