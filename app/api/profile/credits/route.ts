import { NextResponse } from "next/server";
import { sumBalances } from "@/lib/credits";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const session = await createClient();
  const user = session ? (await session.auth.getUser()).data.user : null;
  const admin = createAdminClient();
  if (!user || !admin) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const { data: profile } = await admin.from("profiles").select("id").eq("user_id", user.id).eq("kind", "human").maybeSingle();
  if (!profile) return NextResponse.json({ error: "Profil bulunamadı." }, { status: 404 });
  const { data, error } = await admin.from("credit_ledger").select("kind,delta").eq("profile_id", profile.id).limit(5000);
  // Without migration 077 the ledger does not exist yet: show empty balances instead of an error.
  return NextResponse.json({ balances: sumBalances(error ? [] : data ?? []) }, { headers: { "Cache-Control": "private, no-store" } });
}
