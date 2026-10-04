export async function readJson<T>(response: Response, fallback: T): Promise<T> {
  const raw = await response.text().catch(() => "");
  if (!raw.trim()) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
