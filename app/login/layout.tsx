import { loadGoogleAuthEnabled } from "@/lib/auth-providers";
import { loadOpenRegistration } from "@/lib/registration-settings";
import { RegistrationModeProvider } from "./registration-mode-context";

export const dynamic = "force-dynamic";

export default async function LoginLayout({ children }: { children: React.ReactNode }) {
  const [enabled, googleEnabled] = await Promise.all([loadOpenRegistration(), loadGoogleAuthEnabled()]);
  return <RegistrationModeProvider enabled={enabled} googleEnabled={googleEnabled}>{children}</RegistrationModeProvider>;
}
