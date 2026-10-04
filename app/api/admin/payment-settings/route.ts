import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";

const methodSchema = z.discriminatedUnion("method", [
  z.object({
    method: z.literal("bank_transfer"),
    enabled: z.boolean(),
    accountName: z.string().trim().max(120),
    bankName: z.string().trim().max(120),
    iban: z.string().trim().max(34),
    instructions: z.string().trim().max(500),
  }),
  z.object({
    method: z.literal("papara"),
    enabled: z.boolean(),
    accountName: z.string().trim().max(120),
    paparaNumber: z.string().trim().max(40),
    instructions: z.string().trim().max(500),
  }),
  z.object({
    method: z.literal("crypto"),
    enabled: z.boolean(),
    cryptoAsset: z.string().trim().max(20),
    cryptoNetwork: z.string().trim().max(80),
    walletAddress: z.string().trim().max(180),
    instructions: z.string().trim().max(500),
  }),
]);

export async function GET() {
  const auth = await requireAdmin(["owner", "support"]);
  if (auth instanceof NextResponse) return auth;
  const { data, error } = await auth.admin
    .from("payment_method_settings")
    .select(
      "method,enabled,account_name,bank_name,iban,papara_number,crypto_asset,crypto_network,wallet_address,instructions,updated_at",
    )
    .order("method");
  if (error)
    return NextResponse.json(
      {
        error:
          "Ödeme ayarları yüklenemedi. Veritabanı güncellemesini kontrol edin.",
      },
      { status: 500 },
    );
  return NextResponse.json(
    {
      settings: data ?? [],
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const parsed = methodSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Ödeme bilgilerini kontrol edin." },
      { status: 400 },
    );
  const auth = await requireAdmin(["owner"]);
  if (auth instanceof NextResponse) return auth;
  const value = parsed.data;
  const destinationComplete =
    value.method === "bank_transfer"
      ? Boolean(value.accountName && value.iban)
      : value.method === "papara"
        ? Boolean(value.accountName && value.paparaNumber)
        : Boolean(
            value.cryptoAsset && value.cryptoNetwork && value.walletAddress,
          );
  if (value.enabled && !destinationComplete)
    return NextResponse.json(
      { error: "Yöntemi açmak için zorunlu hesap bilgilerini tamamlayın." },
      { status: 400 },
    );
  const row = {
    method: value.method,
    enabled: value.enabled,
    account_name: "accountName" in value ? value.accountName || null : null,
    bank_name: "bankName" in value ? value.bankName || null : null,
    iban:
      "iban" in value
        ? value.iban.replace(/\s+/g, "").toUpperCase() || null
        : null,
    papara_number: "paparaNumber" in value ? value.paparaNumber || null : null,
    crypto_asset:
      "cryptoAsset" in value ? value.cryptoAsset.toUpperCase() || null : null,
    crypto_network:
      "cryptoNetwork" in value ? value.cryptoNetwork || null : null,
    wallet_address:
      "walletAddress" in value ? value.walletAddress || null : null,
    instructions: value.instructions || null,
    updated_by: auth.user.id,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await auth.admin
    .from("payment_method_settings")
    .upsert(row, { onConflict: "method" })
    .select()
    .single();
  if (error)
    return NextResponse.json(
      { error: "Ödeme ayarı kaydedilemedi." },
      { status: 500 },
    );
  const audit = await auth.session.rpc("write_admin_audit", {
    event_action: "payment.method.updated",
    event_target_type: "payment_method",
    event_target_id: value.method,
    event_metadata: { enabled: value.enabled },
  });
  if (audit.error)
    return NextResponse.json(
      { error: "Ödeme ayarı kaydedildi fakat denetim kaydı oluşturulamadı." },
      { status: 503 },
    );
  return NextResponse.json({ setting: data });
}
