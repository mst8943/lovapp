import { loadOpenRegistration } from "@/lib/registration-settings";
import { RegistrationModeProvider } from "./registration-mode-context";

export const dynamic = "force-dynamic";

export default async function LoginLayout({ children }: { children: React.ReactNode }) {
  const enabled = await loadOpenRegistration();
  return <RegistrationModeProvider enabled={enabled}>{children}</RegistrationModeProvider>;
}
