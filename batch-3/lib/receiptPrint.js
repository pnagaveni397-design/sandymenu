// Receipt building + printing (runs in the browser).
//
// Two ways to reach a printer:
//  1. "system"    -- the printer installed in Windows/Android/macOS (how most
//                    hotels use a USB thermal printer). We print a hidden
//                    receipt page, so no on-screen preview is shown by us.
//                    To also skip the browser's own print dialog, start
//                    Chrome/Edge with the --kiosk-printing flag.
//  2. "bluetooth" -- talks ESC/POS straight to a Bluetooth thermal printer
//                    (Chrome/Edge on Android or desktop with Bluetooth).

const KEY = "ts_printer_v1";
export const DEFAULT_PRINTER = { mode: "system", width: 80, copies: 1, autoPrint: false, btName: "" };

export function loadPrinterSettings() {
  try { return { ...DEFAULT_PRINTER, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch { return { ...DEFAULT_PRINTER }; }
}
export function savePrinterSettings(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {}
}

// Closing message. The old built-in default is upgraded to the new wording;
// any custom footer the client typed is kept.
export function footerText(restaurant) {
  const f = (restaurant.receipt_footer || "").trim();
  return !f || f === "Thank you! Visit again." ? "Thank you for visiting!" : f;
}


const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmtMoney = (n) => `₹${Number(n || 0).toFixed(2).replace(/\.00$/, "")}`;

export function parseDb(s) {
  if (!s) return new Date();
  return new Date(String(s).replace(" ", "T") + (String(s).includes("Z") ? "" : "Z"));
}
export function fmtDateTime(s) {
  const d = parseDb(s);
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
}
export const payLabel = (m) => (m === "cash" ? "Cash" : m === "online_upi" ? "Online / UPI" : "Unpaid");

// Numbers only ever come from the order that was saved on the server.
function lines(order, restaurant) {
  return {
    title: restaurant.gst_number ? "TAX INVOICE" : "BILL",
    when: fmtDateTime(order.paid_at || order.created_at),
    label: order.customer_note || (order.table_number && order.table_number !== "Counter" ? `Table ${order.table_number}` : "Counter"),
  };
}

export function buildReceiptHtml(order, restaurant, width = 80) {
  const L = lines(order, restaurant);
  const w = width === 58 ? "48mm" : "72mm";
  const rows = (order.items || []).map((it) => `
    <tr><td class="n">${esc(it.name)}</td><td class="q">${it.quantity}</td><td class="r">${fmtMoney(it.unit_price)}</td><td class="r">${fmtMoney(it.quantity * it.unit_price)}</td></tr>`).join("");
  const taxRows = (order.tax_breakdown || []).map((t) =>
    `<div class="row"><span>${esc(t.name)}${t.type === "percent" ? ` (${t.percent}%)` : ""}</span><span>${fmtMoney(t.amount)}</span></div>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Receipt ${esc(order.order_number)}</title>
<style>
  @page { size: ${width}mm auto; margin: 0; }
  * { box-sizing: border-box; }
  body { width: ${w}; margin: 0 auto; padding: 3mm 0 6mm; font: 12px/1.35 "Courier New", monospace; color: #000; }
  h1 { font-size: 16px; text-align: center; margin: 0 0 2px; }
  .c { text-align: center; } .sm { font-size: 10.5px; }
  hr { border: 0; border-top: 1px dashed #000; margin: 5px 0; }
  table { width: 100%; border-collapse: collapse; } th { text-align: left; font-size: 10.5px; border-bottom: 1px dashed #000; }
  td { vertical-align: top; padding: 1px 0; } .q { width: 8%; text-align: center; } .r { text-align: right; white-space: nowrap; padding-left: 3px; }
  .row { display: flex; justify-content: space-between; } .tot { font-weight: bold; font-size: 14px; }
</style></head><body>
  <h1>${esc(restaurant.name)}</h1>
  <div class="c sm">${esc(restaurant.address)}${restaurant.phone ? `<br>Ph: ${esc(restaurant.phone)}` : ""}</div>
  ${restaurant.gst_number ? `<div class="c sm">GSTIN: ${esc(restaurant.gst_number)}</div>` : ""}
  ${restaurant.fssai_number ? `<div class="c sm">FSSAI: ${esc(restaurant.fssai_number)}</div>` : ""}
  <hr><div class="c"><b>${L.title}</b></div><hr>
  <div class="row sm"><span>Bill: ${esc(order.order_number)}</span><span>${esc(L.label)}</span></div>
  <div class="sm">${esc(L.when)}</div>
  ${order.customer_name ? `<div class="sm">Customer: ${esc(order.customer_name)}</div>` : ""}
  <hr>
  <table><thead><tr><th>Item</th><th class="q">Qty</th><th class="r">Rate</th><th class="r">Amt</th></tr></thead><tbody>${rows}</tbody></table>
  <hr>
  <div class="row"><span>Subtotal</span><span>${fmtMoney(order.subtotal)}</span></div>
  ${order.discount_amount > 0 ? `<div class="row"><span>Discount</span><span>-${fmtMoney(order.discount_amount)}</span></div>` : ""}
  ${taxRows}
  <hr><div class="row tot"><span>TOTAL</span><span>${fmtMoney(order.total)}</span></div><hr>
  <div class="row sm"><span>Paid by</span><span>${esc(payLabel(order.payment_method))}</span></div>
  <div class="c" style="margin-top:8px"><b>${esc(footerText(restaurant))}</b></div>
</body></html>`;
}

// ---- system printer: hidden iframe, no preview UI from us ----
export function printViaSystem(html, copies = 1) {
  return new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow.document;
    doc.open(); doc.write(html); doc.close();
    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        for (let i = 0; i < Math.max(1, copies); i++) iframe.contentWindow.print();
      } finally {
        setTimeout(() => { iframe.remove(); resolve(); }, 1500);
      }
    }, 250);
  });
}

// ---- Bluetooth ESC/POS ----
let btChar = null;
let btDevice = null;
const BT_SERVICES = [
  "000018f0-0000-1000-8000-00805f9b34fb",
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
];

export const bluetoothSupported = () => typeof navigator !== "undefined" && !!navigator.bluetooth;
export const bluetoothConnected = () => !!(btDevice && btDevice.gatt && btDevice.gatt.connected && btChar);

export async function connectBluetoothPrinter() {
  btDevice = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: BT_SERVICES });
  const server = await btDevice.gatt.connect();
  const services = await server.getPrimaryServices();
  btChar = null;
  for (const svc of services) {
    const chars = await svc.getCharacteristics();
    const c = chars.find((x) => x.properties.write || x.properties.writeWithoutResponse);
    if (c) { btChar = c; break; }
  }
  if (!btChar) throw new Error("This Bluetooth device has no printable channel. Is it a receipt printer?");
  return btDevice.name || "Bluetooth printer";
}

function ascii(s) { return String(s ?? "").replace(/₹/g, "Rs.").replace(/[^\x20-\x7e]/g, "?"); }

export function buildEscPos(order, restaurant, width = 80) {
  const cols = width === 58 ? 32 : 48;
  const out = [];
  const push = (...b) => out.push(...b);
  const text = (s) => { for (const ch of ascii(s)) out.push(ch.charCodeAt(0)); };
  const line = (s = "") => { text(s); push(10); };
  const center = (on) => push(0x1b, 0x61, on ? 1 : 0);
  const bold = (on) => push(0x1b, 0x45, on ? 1 : 0);
  const big = (on) => push(0x1d, 0x21, on ? 0x11 : 0);
  const rule = () => line("-".repeat(cols));
  const two = (a, b) => { const gap = Math.max(1, cols - ascii(a).length - ascii(b).length); line(ascii(a) + " ".repeat(gap) + ascii(b)); };
  const money = (n) => `Rs.${Number(n || 0).toFixed(2).replace(/\.00$/, "")}`;
  const L = lines(order, restaurant);

  push(0x1b, 0x40); // init
  center(true); big(true); bold(true); line(restaurant.name); big(false); bold(false);
  if (restaurant.address) line(restaurant.address);
  if (restaurant.phone) line(`Ph: ${restaurant.phone}`);
  if (restaurant.gst_number) line(`GSTIN: ${restaurant.gst_number}`);
  if (restaurant.fssai_number) line(`FSSAI: ${restaurant.fssai_number}`);
  rule(); bold(true); line(L.title); bold(false); center(false); rule();
  two(`Bill: ${order.order_number}`, L.label); line(L.when);
  if (order.customer_name) line(`Customer: ${order.customer_name}`);
  rule();
  for (const it of order.items || []) {
    line(it.name);
    two(`  ${it.quantity} x ${money(it.unit_price)}`, money(it.quantity * it.unit_price));
  }
  rule();
  two("Subtotal", money(order.subtotal));
  if (order.discount_amount > 0) two("Discount", `-${money(order.discount_amount)}`);
  for (const t of order.tax_breakdown || []) two(`${t.name}${t.type === "percent" ? ` (${t.percent}%)` : ""}`, money(t.amount));
  rule(); bold(true); two("TOTAL", money(order.total)); bold(false); rule();
  two("Paid by", payLabel(order.payment_method));
  center(true); line(""); bold(true); line(footerText(restaurant)); bold(false); center(false);
  push(10, 10, 10, 0x1d, 0x56, 0x00); // feed + cut (ignored if no cutter)
  return new Uint8Array(out);
}

async function writeBluetooth(bytes) {
  if (!bluetoothConnected()) {
    if (btDevice?.gatt) { await connectBluetoothPrinter().catch(() => { throw new Error("Bluetooth printer is not connected. Reconnect it in Printer Connection."); }); }
    else throw new Error("Bluetooth printer is not connected. Connect it in Printer Connection.");
  }
  const noResp = btChar.properties.writeWithoutResponse;
  for (let i = 0; i < bytes.length; i += 100) {
    const chunk = bytes.slice(i, i + 100);
    if (noResp) await btChar.writeValueWithoutResponse(chunk); else await btChar.writeValue(chunk);
    await new Promise((r) => setTimeout(r, 25));
  }
}

// The one function the "Print receipt" button calls.
export async function printReceipt(order, restaurant, settings = loadPrinterSettings()) {
  if (settings.mode === "bluetooth") {
    const bytes = buildEscPos(order, restaurant, settings.width);
    for (let i = 0; i < Math.max(1, settings.copies); i++) await writeBluetooth(bytes);
    return;
  }
  await printViaSystem(buildReceiptHtml(order, restaurant, settings.width), settings.copies);
}

export const SAMPLE_ORDER = {
  order_number: "TEST-0001", created_at: new Date().toISOString().slice(0, 19).replace("T", " "),
  customer_note: "Table 1", customer_name: "", subtotal: 250, discount_amount: 0, total: 262.5, payment_method: "cash",
  items: [{ name: "Filter Coffee", quantity: 2, unit_price: 40 }, { name: "Masala Dosa", quantity: 2, unit_price: 85 }],
  tax_breakdown: [{ name: "CGST", type: "percent", percent: 2.5, amount: 6.25 }, { name: "SGST", type: "percent", percent: 2.5, amount: 6.25 }],
};
