import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

export type ProviderConfig = {
  resendApiKey: string;
  resendFromEmail: string;
  resendFromName: string;
  netgsmUsercode: string;
  netgsmPassword: string;
  netgsmMsgheader: string;
};
const empty: ProviderConfig = {
  resendApiKey: "",
  resendFromEmail: "",
  resendFromName: "Lovask",
  netgsmUsercode: "",
  netgsmPassword: "",
  netgsmMsgheader: "",
};

function key() {
  if (!process.env.VERIFICATION_SETTINGS_KEY)
    throw new Error("VERIFICATION_SETTINGS_KEY eksik");
  return createHash("sha256")
    .update(process.env.VERIFICATION_SETTINGS_KEY)
    .digest();
}

export async function readProviderConfig(
  admin: SupabaseClient,
): Promise<ProviderConfig> {
  const { data, error } = await admin
    .from("verification_provider_settings")
    .select("encrypted_config")
    .eq("id", true)
    .maybeSingle();
  if (error) throw error;
  const configured = data?.encrypted_config
    ? decryptSettings<ProviderConfig>(data.encrypted_config)
    : empty;
  return {
    resendApiKey: configured.resendApiKey || process.env.RESEND_API_KEY || "",
    resendFromEmail:
      configured.resendFromEmail || process.env.RESEND_FROM_EMAIL || "",
    resendFromName:
      configured.resendFromName || process.env.RESEND_FROM_NAME || "Lovask",
    netgsmUsercode:
      configured.netgsmUsercode || process.env.NETGSM_USERCODE || "",
    netgsmPassword:
      configured.netgsmPassword || process.env.NETGSM_PASSWORD || "",
    netgsmMsgheader:
      configured.netgsmMsgheader || process.env.NETGSM_MSGHEADER || "",
  };
}

export async function saveProviderConfig(
  admin: SupabaseClient,
  config: ProviderConfig,
) {
  return admin.from("verification_provider_settings").upsert({
    id: true,
    encrypted_config: encryptSettings(config),
    updated_at: new Date().toISOString(),
  });
}

export function encryptSettings(config: unknown) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(config), "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64");
}

export function decryptSettings<T>(value: string): T {
  const bytes = Buffer.from(value, "base64");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key(),
    bytes.subarray(0, 12),
  );
  decipher.setAuthTag(bytes.subarray(12, 28));
  return JSON.parse(
    Buffer.concat([
      decipher.update(bytes.subarray(28)),
      decipher.final(),
    ]).toString("utf8"),
  ) as T;
}
