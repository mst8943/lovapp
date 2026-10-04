import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ error: "shopier_api_not_used" }, { status: 410 });
}
