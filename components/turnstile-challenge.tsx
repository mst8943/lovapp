"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";

type TurnstileApi = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  remove: (widgetId: string) => void;
  reset: (widgetId: string) => void;
};

declare global {
  interface Window { turnstile?: TurnstileApi }
}

export function TurnstileChallenge({ action, resetKey, onToken }: { action: string; resetKey: number; onToken: (token: string) => void }) {
  const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<string | null>(null);
  const initialResetRef = useRef(true);
  const [scriptReady, setScriptReady] = useState(false);
  const [widgetState, setWidgetState] = useState<"checking" | "verified" | "error">("checking");

  useEffect(() => {
    if (!sitekey) {
      onToken("turnstile-not-configured");
      return;
    }
    if (!scriptReady || !containerRef.current || !window.turnstile) return;
    widgetRef.current = window.turnstile.render(containerRef.current, {
      sitekey,
      action,
      appearance: "always",
      theme: "dark",
      size: "flexible",
      retry: "auto",
      "retry-interval": 5_000,
      "refresh-expired": "auto",
      "refresh-timeout": "auto",
      "response-field": false,
      callback: (token: string) => { setWidgetState("verified"); onToken(token); },
      "expired-callback": () => { setWidgetState("checking"); onToken(""); },
      "timeout-callback": () => { setWidgetState("error"); onToken(""); },
      "error-callback": () => { setWidgetState("error"); onToken(""); return true; },
    });
    return () => {
      if (widgetRef.current && window.turnstile) window.turnstile.remove(widgetRef.current);
      widgetRef.current = null;
    };
  }, [action, onToken, scriptReady, sitekey]);

  useEffect(() => {
    if (initialResetRef.current) { initialResetRef.current = false; return; }
    if (!sitekey) { onToken("turnstile-not-configured"); return; }
    if (widgetRef.current && window.turnstile) window.turnstile.reset(widgetRef.current);
    onToken("");
  }, [onToken, resetKey, sitekey]);

  if (!sitekey) return null;
  return <>
    <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" strategy="afterInteractive" onReady={() => setScriptReady(true)} />
    <div className="turnstile-slot" ref={containerRef} aria-label="Güvenlik doğrulaması" />
    {widgetState === "checking" ? <small className="challenge-status">Güvenlik doğrulaması hazırlanıyor…</small> : null}
    {widgetState === "verified" ? <small className="challenge-status verified">Güvenlik doğrulaması tamamlandı.</small> : null}
    {widgetState === "error" ? <div className="challenge-unavailable">Doğrulama tamamlanamadı. Reklam engelleyiciyi kapatıp <button type="button" onClick={() => { setWidgetState("checking"); if (widgetRef.current) window.turnstile?.reset(widgetRef.current); }}>tekrar dene</button>.</div> : null}
  </>;
}
