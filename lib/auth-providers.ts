import "server-only";

// The env flag alone let the button reach Supabase while its Google provider was
// disabled ("Unsupported provider"); ask Auth which external providers are live.
export async function loadGoogleAuthEnabled() {
  if (process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED !== "true") return false;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return false;
  try {
    const response = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: key },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return true;
    const settings = (await response.json()) as { external?: { google?: boolean } };
    return settings.external?.google === true;
  } catch {
    // An unreachable settings endpoint must not hide a working provider.
    return true;
  }
}
