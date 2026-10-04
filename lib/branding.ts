import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type BrandSettings = {
  brand_name: string;
  tagline: string;
  support_email: string;
  logo_url: string;
};

export const defaultBrandSettings: BrandSettings = {
  brand_name: "Lovask",
  tagline: "Tesadüften fazlası",
  support_email: "destek@example.com",
  logo_url: "/logo_l_extra_thick.png",
};

export async function readBrandSettings() {
  const admin = createAdminClient();
  if (!admin) return defaultBrandSettings;
  const { data } = await admin.from("brand_settings").select("brand_name,tagline,support_email,logo_url").eq("id", true).maybeSingle();
  return data ?? defaultBrandSettings;
}
