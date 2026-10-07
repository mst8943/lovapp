import { NextResponse } from "next/server";
import { buildIceServers, callContext, unauthorized } from "@/lib/calls-server";

export async function GET() {
  const ctx = await callContext();
  if (!ctx) return unauthorized();
  return NextResponse.json(buildIceServers(ctx.profileId), { headers: { "Cache-Control": "private, no-store" } });
}
