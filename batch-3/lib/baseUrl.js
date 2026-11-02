// lib/baseUrl.js
//
// Works out the PUBLIC address of the site (e.g. https://qr-menu-production-7a07.up.railway.app).
//
// Why this exists: on Railway (and any host behind a proxy) `new URL(request.url).origin`
// returns the server's INTERNAL address (http://localhost:8080), not the public domain.
// Anything built from it -- like table QR codes -- ends up pointing at localhost.
//
// Order of preference:
//   1. BASE_URL env var (set this in Railway -> Variables; most reliable)
//   2. X-Forwarded-Host / X-Forwarded-Proto headers sent by Railway's proxy
//   3. The Host header
//   4. RAILWAY_PUBLIC_DOMAIN (Railway sets this automatically)
//   5. request.url origin (only correct for local `npm run dev`)

const os = require("os");

// This computer's CURRENT address on the shop Wi-Fi / hotspot. Worked out live (not frozen at start-up),
// so if the Wi-Fi or hotspot gives the PC a new address, new QR codes still point at the right place.
function lanIp() {
  const nets = os.networkInterfaces();
  const found = [];
  for (const [name, list] of Object.entries(nets)) {
    if (/vEthernet|VirtualBox|VMware|WSL|Loopback|Bluetooth|Hyper-V|TAP|VPN/i.test(name)) continue;
    for (const n of list || []) {
      if (n.family !== "IPv4" || n.internal) continue;
      if (/^(192\.168|10\.|172\.(1[6-9]|2\d|3[01]))\./.test(n.address)) found.push(n.address);
    }
  }
  return found.find((a) => a.startsWith("192.168.")) || found[0] || "";
}

const isPrivateHost = (h) => /^(localhost|127\.|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(String(h || ""));

function clean(url) {
  return String(url || "").trim().replace(/\/+$/, "");
}

function getBaseUrl(request) {
  const fromEnv = clean(process.env.BASE_URL || process.env.NEXT_PUBLIC_BASE_URL);
  if (fromEnv) {
    const full = /^https?:\/\//i.test(fromEnv) ? fromEnv : `https://${fromEnv}`;
    // Shop-computer install: BASE_URL holds the LAN address from start-up. If that address has changed
    // since, use the current one instead of printing a QR that no phone can reach.
    try {
      const u = new URL(full);
      if (isPrivateHost(u.hostname) && u.hostname !== "localhost") {
        const now = lanIp();
        if (now && now !== u.hostname) return `${u.protocol}//${now}${u.port ? ":" + u.port : ""}`;
      }
    } catch {}
    return full;
  }

  const headers = request?.headers;
  const first = (v) => (v ? String(v).split(",")[0].trim() : "");

  const host = first(headers?.get("x-forwarded-host")) || first(headers?.get("host"));
  if (host && !/^(localhost|127\.0\.0\.1)(:|$)/i.test(host)) {
    // A LAN address (192.168.x.x, 172.20.10.x, 10.x.x.x) is plain http: the shop PC has no HTTPS certificate.
    const proto = first(headers?.get("x-forwarded-proto")) || (isPrivateHost(host) ? "http" : "https");
    return `${proto}://${host}`;
  }

  if (process.env.RAILWAY_PUBLIC_DOMAIN) return `https://${clean(process.env.RAILWAY_PUBLIC_DOMAIN)}`;

  // Opened as http://localhost:PORT on the shop computer with no BASE_URL set: use the LAN address,
  // because a QR code that says "localhost" only works on this computer, never on a customer's phone.
  const lan = lanIp();
  if (lan) {
    const u = new URL(request.url);
    return `http://${lan}${u.port ? ":" + u.port : ""}`;
  }
  return new URL(request.url).origin;
}

module.exports = { getBaseUrl };
