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
  support_email: "destek@lovask.com.tr",
  logo_url: "/logo_l_extra_thick.png",
};

export async function readBrandSettings() {
  const admin = createAdminClient();
  if (!admin) return defaultBrandSettings;
  const { data } = await admin.from("brand_settings").select("brand_name,tagline,support_email,logo_url").eq("id", true).maybeSingle();
  return {
    brand_name: data?.brand_name?.trim() || defaultBrandSettings.brand_name,
    tagline: data?.tagline?.trim() || defaultBrandSettings.tagline,
    support_email: data?.support_email?.trim() || defaultBrandSettings.support_email,
    logo_url: data?.logo_url?.trim() || defaultBrandSettings.logo_url,
  };
}
