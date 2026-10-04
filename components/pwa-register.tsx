"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const register = () => navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => undefined);
    const browserWindow = window as Window & { requestIdleCallback?: (callback: () => void) => number; cancelIdleCallback?: (id: number) => void };
    if (browserWindow.requestIdleCallback) {
      const idleId = browserWindow.requestIdleCallback(register);
      return () => browserWindow.cancelIdleCallback?.(idleId);
    }
    const timer = globalThis.setTimeout(register, 1000);
    return () => globalThis.clearTimeout(timer);
  }, []);
  return null;
}
