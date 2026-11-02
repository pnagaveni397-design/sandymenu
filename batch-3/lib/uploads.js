const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// IMPORTANT: this directory is deliberately OUTSIDE /public. Next.js's
// production server (`next start`) serves /public through a static-file
// manifest that's fixed at server startup — any file written to /public
// AFTER the server has already booted is invisible to that handler until
// the process is restarted. Since restaurants upload dish photos and QR
// codes continuously while the server keeps running, that made every
// upload silently 404 until a manual restart (this was the exact bug
// behind uploaded dish photos not showing up).
//
// Storing uploads here and serving them through the dynamic route at
// app/api/uploads/[filename]/route.js (which reads the file from disk on
// every request) fixes that permanently — no caching/manifest involved.
const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
// Where uploads used to be written before this fix — kept as a read-only
// fallback so images uploaded before this update don't suddenly break.
const LEGACY_UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

const MIME_EXT = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

const EXT_MIME = Object.fromEntries(Object.entries(MIME_EXT).map(([m, e]) => [e, m]));

// data URL like "data:image/png;base64,AAAA..."
function saveDataUrl(dataUrl, { maxBytes = 8 * 1024 * 1024 } = {}) {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl || "");
  if (!match) throw new Error("Invalid file data");
  const mime = match[1];
  const ext = MIME_EXT[mime];
  if (!ext) throw new Error(`Unsupported file type: ${mime}`);

  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > maxBytes) {
    throw new Error(`File too large (max ${(maxBytes / (1024 * 1024)).toFixed(0)}MB)`);
  }

  const filename = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer);
  return `/api/uploads/${filename}`;
}

function readUpload(filename) {
  // No path traversal — filenames are always our own generated
  // "<timestamp>-<hex>.<ext>" pattern, reject anything else outright.
  if (!/^[\w-]+\.[a-z0-9]+$/i.test(filename)) return null;
  const ext = filename.split(".").pop().toLowerCase();
  const mime = EXT_MIME[ext];
  if (!mime) return null;
  const filePath = path.join(UPLOAD_DIR, filename);
  if (fs.existsSync(filePath)) return { buffer: fs.readFileSync(filePath), mime };
  const legacyPath = path.join(LEGACY_UPLOAD_DIR, filename);
  if (fs.existsSync(legacyPath)) return { buffer: fs.readFileSync(legacyPath), mime };
  return null;
}

module.exports = { saveDataUrl, readUpload };
