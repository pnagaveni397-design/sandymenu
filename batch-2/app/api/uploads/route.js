import { NextResponse } from "next/server";
import { saveDataUrl } from "@/lib/uploads";

export async function POST(request) {
  const { dataUrl, maxBytes } = await request.json();
  if (!dataUrl) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  try {
    const url = saveDataUrl(dataUrl, maxBytes ? { maxBytes } : undefined);
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
