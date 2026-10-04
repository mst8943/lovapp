import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";

export async function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  const store = await cookies();
  const requestHeaders = await headers();
  const authorization = requestHeaders.get("authorization");
  return createServerClient(url, key, {
    global: authorization?.startsWith("Bearer ") ? { headers: { Authorization: authorization } } : undefined,
    cookies: {
      getAll: () => store.getAll(),
      setAll(values) {
        try { values.forEach(({ name, value, options }) => store.set(name, value, options)); }
        catch { /* Server Components cannot always mutate cookies. */ }
      },
    },
  });
}
