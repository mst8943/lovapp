import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function session() {
  const client = await createClient();
  const { data: { user } } = client ? await client.auth.getUser() : { data: { user: null } };
  return user ? client : null;
}

export async function GET() {
  const client = await session();
  if (!client) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const { data, error } = await client.rpc("profile_boost_status");
  return error ? NextResponse.json({ error: "Boost durumu yüklenemedi." }, { status: 503 }) : NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST() {
  const client = await session();
  if (!client) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const { data, error } = await client.rpc("activate_profile_boost");
  if (error) return NextResponse.json({ error: "Boost başlatılamadı." }, { status: 503 });
  if (!data?.activeUntil) {
    // Members without a weekly Noir boost can spend a purchased boost credit (needs migration 077; ignored when absent).
    const credit = await client.rpc("use_boost_credit");
    if (!credit.error && credit.data?.activeUntil) return NextResponse.json(credit.data, { headers: { "Cache-Control": "private, no-store" } });
  }
  return NextResponse.json(data, { status: data?.activeUntil ? 200 : 409, headers: { "Cache-Control": "private, no-store" } });
}
