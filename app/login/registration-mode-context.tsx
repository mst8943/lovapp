"use client";

import { createContext, useContext } from "react";

const RegistrationModeContext = createContext(false);

export function RegistrationModeProvider({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  return <RegistrationModeContext value={enabled}>{children}</RegistrationModeContext>;
}

export function useOpenRegistration() {
  return useContext(RegistrationModeContext);
}
