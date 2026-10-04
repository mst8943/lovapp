import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "shopier_api_not_used" }, { status: 410 });
}
