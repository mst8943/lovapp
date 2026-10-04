import "server-only";
import type { NextRequest } from "next/server";

export function hasValidAuthOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    const sourceOrigin = new URL(origin).origin;
    const expectedOrigin = process.env.NODE_ENV === "production"
      ? new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://lovask.com.tr").origin
      : new URL(request.url).origin;
    return sourceOrigin === expectedOrigin;
  } catch {
    return false;
  }
}
