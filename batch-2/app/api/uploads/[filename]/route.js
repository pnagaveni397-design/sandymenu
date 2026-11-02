import { readUpload } from "@/lib/uploads";

export async function GET(request, { params }) {
  const file = readUpload(params.filename);
  if (!file) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(file.buffer, {
    headers: {
      "Content-Type": file.mime,
      // Filenames are unique (timestamp + random hex) and never reused or
      // overwritten, so it's safe to cache them "forever" in the browser.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
