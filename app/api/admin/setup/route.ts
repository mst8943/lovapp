import { NextResponse } from "next/server";
import { existsSync } from "node:fs";
import { requireAdmin } from "@/lib/admin-auth";
import { SHOPIER_STATIC_PRODUCTS } from "@/lib/shopier";

export async function GET() {
  const auth = await requireAdmin(["owner"]);
  if (auth instanceof NextResponse) return auth;
  const checks = [
    [
      "Supabase bağlantısı",
      Boolean(
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
        process.env.SUPABASE_SERVICE_ROLE_KEY,
      ),
      "NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY ve SUPABASE_SERVICE_ROLE_KEY",
    ],
    [
      "Site adresi",
      Boolean(process.env.NEXT_PUBLIC_APP_URL),
      "NEXT_PUBLIC_APP_URL",
    ],
    ["Cron güvenliği", Boolean(process.env.CRON_SECRET), "CRON_SECRET"],
    [
      "AI sağlayıcısı",
      Boolean(
        process.env.OPENAI_API_KEY ||
        process.env.OPENROUTER_API_KEY ||
        process.env.DEEPSEEK_API_KEY ||
        process.env.GEMINI_API_KEY,
      ),
      "En az bir AI_API_KEY",
    ],
    [
      "Ödeme",
      Object.values(SHOPIER_STATIC_PRODUCTS).every((product) => product.checkoutUrl.startsWith("https://www.shopier.com/")),
      "Shopier ürün linkleri; ödeme sonrası sipariş panelden doğrulanır",
    ],
    [
      "E-posta",
      Boolean(process.env.RESEND_API_KEY || process.env.NETGSM_PASSWORD),
      "RESEND_API_KEY veya Netgsm bilgileri (opsiyonel)",
    ],
    [
      "Doğrulama ayarları",
      Boolean(process.env.VERIFICATION_SETTINGS_KEY),
      "VERIFICATION_SETTINGS_KEY (doğrulama sağlayıcılarını panelden kaydetmek için)",
    ],
    [
      "Android bildirimleri",
      Boolean(
        process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
        (process.env.FIREBASE_SERVICE_ACCOUNT_FILE &&
          existsSync(process.env.FIREBASE_SERVICE_ACCOUNT_FILE)),
      ),
      "FIREBASE_SERVICE_ACCOUNT_FILE veya FIREBASE_SERVICE_ACCOUNT_JSON",
    ],
  ].map(([label, ready, detail]) => ({ label, ready, detail }));
  return NextResponse.json({ checks });
}
