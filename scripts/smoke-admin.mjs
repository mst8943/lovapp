// npm run smoke [baseUrl]: end-to-end check of the admin APIs against a running app and its real database.
// It creates a throwaway owner account, exercises read-only endpoints plus a short team add/remove
// cycle, never sends notifications, and removes (or bans) the throwaway accounts at the end.
import { existsSync, readFileSync } from "node:fs";

const envFile = [".env.production.local", ".env.local"].find(existsSync);
const fileEnv = envFile ? Object.fromEntries(readFileSync(envFile, "utf8").split(/\r?\n/).map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map((match) => [match[1], match[2].replace(/^["']|["']$/g, "")])) : {};
const env = (key) => process.env[key] ?? fileEnv[key] ?? "";
const U = env("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, ""), ANON = env("NEXT_PUBLIC_SUPABASE_ANON_KEY"), SVC = env("SUPABASE_SERVICE_ROLE_KEY");
if (!U || !ANON || !SVC) { console.error("Supabase ayarları eksik. Önce npm run setup ve npm run doctor çalıştırın."); process.exit(1); }
const app = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const sv = (path, init = {}) => fetch(`${U}${path}`, { ...init, headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, "Content-Type": "application/json", ...(init.headers ?? {}) } });
const email = `e2e-admin-${Date.now()}@example.invalid`, password = `Tt-${Math.random().toString(36).slice(2)}A1!`;
let uid, token;
const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  -> " + detail : ""}`); };

const created = await (await sv("/auth/v1/admin/users", { method: "POST", body: JSON.stringify({ email, password, email_confirm: true }) })).json();
uid = created.id; if (!uid) { console.log("kullanıcı oluşturulamadı", created); process.exit(1); }
await sv("/rest/v1/admin_users", { method: "POST", body: JSON.stringify({ user_id: uid, role: "owner" }), headers: { Prefer: "return=minimal" } });
const login = await (await fetch(`${U}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) })).json();
token = login.access_token; check("test owner girişi", Boolean(token));
const api = (path, init = {}) => fetch(`${app}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) } });

for (let i = 0; i < 60; i++) { try { if ((await fetch(`${app}/api/health`)).status < 500) break; } catch {} await new Promise((r) => setTimeout(r, 3000)); }
try {
  let r = await fetch(`${app}/api/health`); let b = await r.json().catch(() => ({})); check("sağlık ucu", r.ok && b.database === "ok", JSON.stringify(b));
  r = await fetch(`${app}/api/admin/audit`); check("audit: oturumsuz 401", r.status === 401, String(r.status));
  r = await api("/api/admin/audit"); b = await r.json(); check("audit listesi", r.ok && Array.isArray(b.entries), `${b.entries?.length} kayıt`);
  r = await api("/api/admin/audit?q=team"); b = await r.json(); check("audit arama", r.ok, `${b.entries?.length}`);
  r = await api("/api/admin/trends"); b = await r.json(); check("trends", r.ok && b.series?.length === 4, r.ok ? b.series.map((s) => `${s.label}=${s.values.reduce((a, c) => a + c, 0)}`).join(", ") : JSON.stringify(b));
  r = await api("/api/admin/deletions"); b = await r.json(); check("deletions", r.ok && Array.isArray(b.requests), `${b.requests?.length} talep`);
  r = await api("/api/admin/export?type=users"); let t = await r.text(); check("CSV kullanıcılar", r.ok && t.replace(/^\uFEFF/, "").startsWith("sep=;"), `${t.split("\n").length - 2} satır, ${r.headers.get("content-type")}`);
  r = await api("/api/admin/export?type=payments"); t = await r.text(); check("CSV ödemeler", r.ok && t.includes("Sipariş ID"), `${t.split("\n").length - 2} satır`);
  r = await api("/api/admin/export?type=zzz"); check("CSV geçersiz tür 400", r.status === 400);
  r = await api("/api/admin/team"); b = await r.json(); check("team listesi", r.ok && b.members?.some((m) => m.userId === uid && m.isSelf), `${b.members?.length} yönetici`);
  const peer = `e2e-peer-${Date.now()}@example.invalid`;
  const p = await (await sv("/auth/v1/admin/users", { method: "POST", body: JSON.stringify({ email: peer, password, email_confirm: true }) })).json();
  r = await api("/api/admin/team", { method: "POST", body: JSON.stringify({ email: peer, role: "support" }) }); check("team ekle", r.status === 201, String(r.status));
  r = await api("/api/admin/team", { method: "POST", body: JSON.stringify({ email: "yok-boyle@example.invalid", role: "support" }) }); check("team olmayan e-posta 404", r.status === 404);
  r = await api("/api/admin/team", { method: "PATCH", body: JSON.stringify({ userId: p.id, role: "moderator" }) }); check("team rol değiştir", r.ok);
  r = await api(`/api/admin/team?userId=${uid}`, { method: "DELETE" }); check("kendini kaldırma engeli 409", r.status === 409);
  r = await api(`/api/admin/team?userId=${p.id}`, { method: "DELETE" }); b = await r.json().catch(() => ({})); check("team kaldır", r.ok, r.ok ? "" : b.error);
  await sv(`/auth/v1/admin/users/${p.id}`, { method: "DELETE" });
  r = await api("/api/admin/notify", { method: "POST", body: JSON.stringify({ mode: "preview", segment: "all", title: "x", body: "x" }) }); b = await r.json(); check("notify önizleme (tümü)", r.ok && typeof b.count === "number", `${b.count} alıcı`);
  for (const seg of ["noir_active", "noir_expiring", "inactive_7", "inactive_30", "new_7"]) { r = await api("/api/admin/notify", { method: "POST", body: JSON.stringify({ mode: "preview", segment: seg, title: "x", body: "x" }) }); b = await r.json(); check(`notify önizleme ${seg}`, r.ok, `${b.count}`); }
  r = await api("/api/admin/notify", { method: "POST", body: JSON.stringify({ mode: "send", segment: "new_7", title: "x", body: "x", confirmCount: -1 }) }); check("notify yanlış sayıyla gönderim 409 (gönderilmedi)", r.status === 409, String(r.status));
  r = await api("/api/admin/notify", { method: "POST", body: JSON.stringify({ mode: "preview", segment: "all", title: "x", body: "x", url: "https://evil.example" }) }); check("notify dış bağlantı reddi 400", r.status === 400);
  const prof = await (await sv("/rest/v1/profiles?select=id&kind=eq.human&limit=1")).json();
  r = await api(`/api/admin/users/${prof[0]?.id}/notes`); b = await r.json(); check("not API (076 yoksa anlaşılır hata)", r.status === 503 || r.ok, `${r.status} ${b.error ?? ""}`);
  r = await api("/api/admin/users?q=a"); b = await r.json(); check("kullanıcı arama (palet)", r.ok && Array.isArray(b.users), `${b.users?.length}`);
  r = await api("/api/admin/conversations"); b = await r.json(); check("sohbet listesi", r.ok, `${b.conversations?.length} sohbet`);
  const conv = b.conversations?.find((c) => c.preview !== "Henüz mesaj yok") ?? b.conversations?.[0];
  if (conv) { r = await api(`/api/admin/conversations/${conv.id}`); const th = await r.json(); const sorted = th.messages?.every((m, i, a) => i === 0 || a[i - 1].created_at <= m.created_at); check("sohbet mesajları (artan sırada)", r.ok && sorted, `${th.messages?.length} mesaj`); }
  r = await api("/api/profile/export"); check("verilerimi indir (profilsiz test hesabı 404)", r.status === 404, String(r.status));
  r = await api("/api/admin/badges"); b = await r.json(); check("badges", r.ok, JSON.stringify(b.counts));
} finally {
  await sv(`/rest/v1/admin_users?user_id=eq.${uid}`, { method: "DELETE" });
  await sv(`/auth/v1/admin/users/${uid}`, { method: "DELETE" }).then(async (res) => { if (!res.ok) await sv(`/auth/v1/admin/users/${uid}`, { method: "PUT", body: JSON.stringify({ ban_duration: "876000h" }) }); });
  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} geçti`);
  if (passed !== results.length) process.exitCode = 1;
}
