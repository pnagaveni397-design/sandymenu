const crypto = require("crypto");

const EFFECT_IDS = ["fade", "slide", "zoom", "flip", "wipe", "spin", "rise", "blur"];
const UPLOAD_URL = /^\/api\/uploads\/[\w-]+\.[a-z0-9]+$/i;

const clampNum = (n, min, max, fallback) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, Math.round(v)));
};
const str = (v, max) => String(v ?? "").slice(0, max);
const mediaUrl = (v) => (typeof v === "string" && UPLOAD_URL.test(v) ? v : "");
const mediaKind = (url, kind) => (url ? (kind === "video" ? "video" : "image") : "");

// A restaurant's scene templates -- everything in here is the restaurant's
// own text/media, so nothing is dropped except what's structurally invalid.
function cleanTemplates(input) {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 100).map((t) => ({
    id: str(t?.id, 60) || crypto.randomUUID(),
    name: str(t?.name, 80),
    description: str(t?.description, 400),
    active: t?.active !== false,
    scenes: (Array.isArray(t?.scenes) ? t.scenes : []).slice(0, 20).map((s) => {
      const media = mediaUrl(s?.media);
      return {
        id: str(s?.id, 60) || crypto.randomUUID(),
        caption: str(s?.caption, 140),
        duration: clampNum(s?.duration, 1, 60, 4),
        transition: EFFECT_IDS.includes(s?.transition) ? s.transition : "fade",
        media,
        mediaType: mediaKind(media, s?.mediaType),
      };
    }),
  }));
}

// The scenes a customer submits after filling in a template.
function cleanSubmissionScenes(input) {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 20).map((s) => {
    const media = mediaUrl(s?.media);
    return {
      caption: str(s?.caption, 140),
      duration: clampNum(s?.duration, 1, 60, 4),
      transition: EFFECT_IDS.includes(s?.transition) ? s.transition : "fade",
      media,
      mediaType: mediaKind(media, s?.mediaType),
    };
  });
}

function parseJsonArray(v) {
  try {
    const parsed = JSON.parse(v || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

module.exports = { cleanTemplates, cleanSubmissionScenes, parseJsonArray, EFFECT_IDS, mediaUrl };
