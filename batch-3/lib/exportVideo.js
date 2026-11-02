"use client";

// Renders a scene list (the same shape TemplatePlayer plays: media,
// mediaType, caption, duration, transition) into one real video file, by
// drawing each frame to a canvas and recording it with MediaRecorder. Used
// to let the restaurant download a customer's whole submission as a single
// video instead of one file per clip.

const W = 540;
const H = 960;
const TRANSITION_MS = 450;
const SCENE_COLORS = ["#E8542B", "#E3A21A", "#6B7C4F", "#B23A48", "#8a5a2b", "#2E2420", "#4C6B8A", "#7A4E9E", "#3A7D63", "#C46A2E"];

export function exportSupported() {
  return typeof window !== "undefined" && !!(window.MediaRecorder && HTMLCanvasElement.prototype.captureStream);
}

function loadMedia(scene) {
  return new Promise((resolve, reject) => {
    if (!scene.media) { resolve(null); return; }
    if (scene.mediaType === "video") {
      const vid = document.createElement("video");
      vid.muted = true;
      vid.playsInline = true;
      vid.crossOrigin = "anonymous";
      vid.src = scene.media;
      vid.onloadeddata = () => resolve(vid);
      vid.onerror = () => resolve(null); // fall back to a plain colour scene rather than failing the whole export
    } else {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = scene.media;
    }
  });
}

function drawCover(ctx, media, w, h) {
  const mw = media.videoWidth || media.naturalWidth || w;
  const mh = media.videoHeight || media.naturalHeight || h;
  const scale = Math.max(w / mw, h / mh);
  const sw = w / scale, sh = h / scale;
  const sx = (mw - sw) / 2, sy = (mh - sh) / 2;
  ctx.drawImage(media, sx, sy, sw, sh, 0, 0, w, h);
}

function wrapLines(ctx, text, maxWidth) {
  const words = (text || "").split(" ").filter(Boolean);
  const lines = [];
  let line = "";
  words.forEach((w) => {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; }
    else line = test;
  });
  if (line) lines.push(line);
  return lines;
}

// Applies the transform for the transition at progress p (0..1 in) and
// returns any canvas filter string to set. Every one of the 8 transitions
// from the template format has a 2D approximation here.
function applyTransition(ctx, transition, p) {
  let alpha = 1, dx = 0, dy = 0, scaleX = 1, scaleY = 1, rotate = 0, filter = "none";
  switch (transition) {
    case "fade": alpha = p; break;
    case "slide": dx = (1 - p) * W; break;
    case "zoom": alpha = p; scaleX = scaleY = 0.4 + 0.6 * p; break;
    case "flip": alpha = p; scaleX = Math.max(0.05, p); break; // 2D stand-in for the 3D rotateY flip
    case "spin": alpha = p; rotate = (1 - p) * 14 * (Math.PI / 180); scaleX = scaleY = 0.7 + 0.3 * p; break;
    case "rise": dy = (1 - p) * H; break;
    case "blur": alpha = p; filter = `blur(${Math.round((1 - p) * 14)}px)`; break;
    case "wipe": break; // handled by a clip rect in draw(), not a transform
    default: alpha = p;
  }
  ctx.globalAlpha = alpha;
  ctx.filter = filter;
  ctx.translate(W / 2 + dx, H / 2 + dy);
  ctx.rotate(rotate);
  ctx.scale(scaleX, scaleY);
  ctx.translate(-W / 2, -H / 2);
}

export async function exportScenesToVideo(scenes, onProgress) {
  if (!exportSupported()) throw new Error("This browser can't build videos in-page. Try Chrome or Edge on a computer.");
  if (!scenes.length) throw new Error("Nothing to export.");

  const mediaEls = await Promise.all(scenes.map(loadMedia));

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const stream = canvas.captureStream(30);

  const candidates = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"];
  const mimeType = candidates.find((m) => window.MediaRecorder.isTypeSupported?.(m)) || "";
  const recorder = new window.MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks = [];
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
  const stopped = new Promise((resolve) => { recorder.onstop = resolve; });
  recorder.start();

  const durationsMs = scenes.map((s) => Math.max(1, Number(s.duration) || 4) * 1000);
  const totalMs = durationsMs.reduce((a, b) => a + b, 0);
  const startedAt = performance.now();
  let playingIdx = -1;

  await new Promise((resolveLoop) => {
    function frame(now) {
      const elapsed = now - startedAt;
      if (elapsed >= totalMs) { resolveLoop(); return; }
      onProgress?.(Math.min(99, Math.round((elapsed / totalMs) * 100)));

      let acc = 0, idx = 0, localMs = 0;
      for (let i = 0; i < scenes.length; i++) {
        if (elapsed < acc + durationsMs[i]) { idx = i; localMs = elapsed - acc; break; }
        acc += durationsMs[i];
      }
      const s = scenes[idx];
      const media = mediaEls[idx];

      if (media && s.mediaType === "video" && idx !== playingIdx) {
        if (playingIdx !== -1 && mediaEls[playingIdx]?.pause) mediaEls[playingIdx].pause();
        try { media.currentTime = 0; } catch {}
        media.loop = true;
        media.play().catch(() => {});
        playingIdx = idx;
      } else if (!(media && s.mediaType === "video")) {
        playingIdx = idx;
      }

      ctx.save();
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = SCENE_COLORS[idx % SCENE_COLORS.length];
      ctx.fillRect(0, 0, W, H);

      const p = Math.min(1, localMs / TRANSITION_MS);
      if (s.transition === "wipe") {
        ctx.beginPath();
        ctx.rect(0, 0, W * p, H);
        ctx.clip();
      } else {
        applyTransition(ctx, s.transition, p);
      }

      if (media) drawCover(ctx, media, W, H);
      ctx.restore();

      if (s.caption) {
        ctx.save();
        ctx.globalAlpha = 1;
        ctx.filter = "none";
        const grad = ctx.createLinearGradient(0, H - 170, 0, H);
        grad.addColorStop(0, "rgba(0,0,0,0)");
        grad.addColorStop(1, "rgba(0,0,0,0.65)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, H - 170, W, 170);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 32px Inter, Arial, sans-serif";
        ctx.textBaseline = "alphabetic";
        const lines = wrapLines(ctx, s.caption, W - 72);
        const lh = 40;
        const startY = H - 55 - (lines.length - 1) * lh;
        lines.forEach((l, i) => ctx.fillText(l, 36, startY + i * lh));
        ctx.restore();
      }

      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });

  mediaEls.forEach((m) => m?.pause && m.pause());
  recorder.stop();
  await stopped;
  onProgress?.(100);

  return new Blob(chunks, { type: mimeType || "video/webm" });
}
