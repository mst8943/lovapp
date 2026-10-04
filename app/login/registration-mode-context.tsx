"use client";

import { createContext, useContext } from "react";

const RegistrationModeContext = createContext({ openRegistration: false, googleEnabled: false });

export function RegistrationModeProvider({ enabled, googleEnabled, children }: { enabled: boolean; googleEnabled: boolean; children: React.ReactNode }) {
  return <RegistrationModeContext value={{ openRegistration: enabled, googleEnabled }}>{children}</RegistrationModeContext>;
}

export function useOpenRegistration() {
  return useContext(RegistrationModeContext).openRegistration;
}

export function useGoogleAuthEnabled() {
  return useContext(RegistrationModeContext).googleEnabled;
}
