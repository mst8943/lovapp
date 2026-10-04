import { NextResponse } from "next/server";
import { readBrandSettings } from "@/lib/branding";

export async function GET() {
  return NextResponse.json(await readBrandSettings(), { headers: { "Cache-Control": "no-store" } });
}
