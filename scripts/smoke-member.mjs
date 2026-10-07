// npm run smoke:member [baseUrl]: member-side end-to-end check against a running app and its real database.
// Creates three throwaway members (with profiles), exercises the member APIs, and removes everything afterwards.
// Checks that need migration 077 are reported as SKIP when the migration has not been applied yet.
import { existsSync, readFileSync } from "node:fs";

const envFile = [".env.production.local", ".env.local"].find(existsSync);
const fileEnv = envFile ? Object.fromEntries(readFileSync(envFile, "utf8").split(/\r?\n/).map((line) => line.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map((match) => [match[1], match[2].replace(/^["']|["']$/g, "")])) : {};
const env = (key) => process.env[key] ?? fileEnv[key] ?? "";
const U = env("NEXT_PUBLIC_SUPABASE_URL").replace(/\/$/, ""), ANON = env("NEXT_PUBLIC_SUPABASE_ANON_KEY"), SVC = env("SUPABASE_SERVICE_ROLE_KEY");
if (!U || !ANON || !SVC) { console.error("Supabase ayarları eksik. Önce npm run setup ve npm run doctor çalıştırın."); process.exit(1); }
const app = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");

const sv = (path, init = {}) => fetch(`${U}${path}`, { ...init, headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, "Content-Type": "application/json", Prefer: "return=representation", ...(init.headers ?? {}) } });
const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  -> " + detail : ""}`); };
const skip = (name, why) => console.log(`SKIP  ${name}  -> ${why}`);
const stamp = Date.now();
const password = `Tt-${Math.random().toString(36).slice(2)}A1!`;
const members = [];

async function makeMember(label, gender) {
  const email = `smoke-${label}-${stamp}@example.invalid`;
  const user = await (await sv("/auth/v1/admin/users", { method: "POST", body: JSON.stringify({ email, password, email_confirm: true }) })).json();
  const [profile] = await (await sv("/rest/v1/profiles", { method: "POST", body: JSON.stringify({ user_id: user.id, kind: "human", display_name: `Smoke ${label}`, birth_date: "1995-05-05", gender, city: "İstanbul", onboarding_completed: true, is_discoverable: true }) })).json();
  const login = await (await fetch(`${U}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) })).json();
  const member = { label, userId: user.id, profileId: profile.id, headers: { Authorization: `Bearer ${login.access_token}`, "Content-Type": "application/json" } };
  members.push(member);
  return member;
}
const call = async (member, path, init = {}) => { const response = await fetch(`${app}${path}`, { ...init, headers: { ...member.headers, ...(init.headers ?? {}) } }); const body = await response.json().catch(() => ({})); return { status: response.status, ok: response.ok, body }; };

for (let i = 0; i < 60; i++) { try { if ((await fetch(`${app}/api/health`)).status < 500) break; } catch {} await new Promise((r) => setTimeout(r, 3000)); }
let adminId;
try {
  const A = await makeMember("a", "kadın"), B = await makeMember("b", "erkek"), C = await makeMember("c", "erkek");
  check("üyeler ve profiller oluşturuldu", members.every((m) => m.profileId && m.headers.Authorization.length > 20));

  let r = await call(A, "/api/profile/export"); check("verilerimi indir", r.ok && r.body.profile?.display_name === "Smoke a" && Array.isArray(r.body.sentMessages));
  r = await call(A, "/api/profile/coach", { method: "POST" }); check("profil koçu", r.ok && typeof r.body.score === "number" && r.body.checks?.length === 5, `puan ${r.body.score}, kaynak ${r.body.source}`);
  r = await fetch(`${app}/api/profile/coach`, { method: "POST" }); check("profil koçu oturumsuz 401", r.status === 401);
  r = await call(A, "/api/daily-question"); const questionOk = r.ok && r.body.question?.options?.length >= 2; check("günün sorusu", questionOk, r.body.question?.text);

  const probe = await call(A, "/api/profile/credits"); const migrated = (await sv("/rest/v1/credit_ledger?select=id&limit=1")).ok;
  check("kredi bakiyesi ucu", probe.ok && probe.body.balances?.boost === 0, migrated ? "077 uygulanmış" : "077 yok, boş bakiye");
  r = await call(A, "/api/date-plans"); check("buluşma planları listesi (migration olsa da olmasa da)", r.ok && Array.isArray(r.body.plans));
  const start = new Date(Date.now() + 3600e3).toISOString(), end = new Date(Date.now() + 7200e3).toISOString();
  r = await call(A, "/api/date-plans", { method: "POST", body: JSON.stringify({ venue: "Smoke Kafe", city: "İstanbul", startsAt: start, expectedEndAt: end, emergencyContactName: "Ayşe", emergencyContactPhone: "123" }) }); check("acil durum kişisi geçersiz telefon 400", r.status === 400);

  if (!migrated) {
    skip("günün sorusu yanıtı, rozetler, güvenlik check-in, krediler", "077 migration'ı uygulanmadı");
  } else {
    r = await call(A, "/api/daily-question", { method: "POST", body: JSON.stringify({ optionIndex: 0 }) }); check("günün sorusu yanıtla", r.status === 201 && r.body.answer === 0);
    r = await call(A, "/api/daily-question", { method: "POST", body: JSON.stringify({ optionIndex: 1 }) }); check("aynı gün ikinci yanıt 409", r.status === 409);
    await call(B, "/api/daily-question", { method: "POST", body: JSON.stringify({ optionIndex: 0 }) });
    r = await call(A, "/api/daily-question"); check("aynı şıkkı seçen sayısı", r.ok && r.body.sameCount >= 1, `${r.body.sameCount}`);

    r = await call(A, "/api/date-plans", { method: "POST", body: JSON.stringify({ venue: "Smoke Kafe", city: "İstanbul", startsAt: start, expectedEndAt: end, emergencyContactName: "Ayşe", emergencyContactPhone: "0530 111 22 33" }) }); check("buluşma planı acil durum kişisiyle", r.status === 201);
    r = await call(A, "/api/date-plans"); const plan = r.body.plans?.[0]; check("plan listesinde maskeli telefon", plan?.emergency_contact_masked === "•••• 2233" && !JSON.stringify(r.body).includes("5301112233"));
    r = await call(A, "/api/date-plans", { method: "PATCH", body: JSON.stringify({ id: plan.id, action: "safe" }) }); check("güvende olduğumu onayla", r.ok);
    r = await call(A, "/api/date-plans"); check("onay kaydedildi", Boolean(r.body.plans?.[0]?.safe_confirmed_at));

    const [x, y] = [A.profileId, B.profileId].sort(); const [x2, y2] = [C.profileId, B.profileId].sort();
    const matchAB = (await (await sv("/rest/v1/matches", { method: "POST", body: JSON.stringify({ user_a: x, user_b: y }) })).json())[0];
    const matchCB = (await (await sv("/rest/v1/matches", { method: "POST", body: JSON.stringify({ user_a: x2, user_b: y2 }) })).json())[0];
    r = await call(A, "/api/endorsements", { method: "POST", body: JSON.stringify({ toProfileId: B.profileId, badge: "kind" }) }); check("rozet: yeterli sohbet yokken 403", r.status === 403, r.body.error);
    for (const [member, match] of [[A, matchAB], [C, matchCB]]) for (let i = 0; i < 3; i++) await sv("/rest/v1/messages", { method: "POST", body: JSON.stringify({ match_id: match.id, sender_id: member.profileId, kind: "text", body: `merhaba ${i}` }) });
    r = await call(A, "/api/endorsements", { method: "POST", body: JSON.stringify({ toProfileId: B.profileId, badge: "kind" }) }); check("rozet bırak", r.status === 201);
    r = await call(A, "/api/endorsements", { method: "POST", body: JSON.stringify({ toProfileId: B.profileId, badge: "kind" }) }); check("aynı rozet ikinci kez 409", r.status === 409);
    r = await call(A, "/api/endorsements", { method: "POST", body: JSON.stringify({ toProfileId: C.profileId, badge: "kind" }) }); check("eşleşmediği kişiye rozet 403", r.status === 403);
    r = await call(C, "/api/endorsements", { method: "POST", body: JSON.stringify({ toProfileId: B.profileId, badge: "kind" }) }); check("ikinci üyeden aynı rozet", r.status === 201);
    r = await call(A, `/api/endorsements?profileId=${B.profileId}`); check("rozet iki kişiden gelince görünür", r.ok && r.body.badges?.[0]?.key === "kind" && r.body.badges[0].count === 2 && !JSON.stringify(r.body).includes(C.profileId));

    // Credits: an admin grants one boost credit, the member spends it through the Boost endpoint.
    const admin = await (await sv("/auth/v1/admin/users", { method: "POST", body: JSON.stringify({ email: `smoke-admin-${stamp}@example.invalid`, password, email_confirm: true }) })).json(); adminId = admin.id;
    await sv("/rest/v1/admin_users", { method: "POST", body: JSON.stringify({ user_id: adminId, role: "owner" }) });
    const adminLogin = await (await fetch(`${U}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ email: `smoke-admin-${stamp}@example.invalid`, password }) })).json();
    const adminCall = { headers: { Authorization: `Bearer ${adminLogin.access_token}`, "Content-Type": "application/json" } };
    await sv("/rest/v1/profile_photos", { method: "POST", body: JSON.stringify({ profile_id: A.profileId, storage_path: `smoke/${stamp}.webp`, processing_status: "ready", moderation_status: "approved", is_primary: true, sort_order: 0 }) });
    r = await call(adminCall, `/api/admin/users/${A.profileId}/credits`, { method: "POST", body: JSON.stringify({ kind: "boost", delta: 1, reason: "smoke test" }) }); check("admin kredi verir", r.status === 201);
    r = await call(adminCall, `/api/admin/users/${A.profileId}/credits`, { method: "POST", body: JSON.stringify({ kind: "boost", delta: -5, reason: "fazla düşme" }) }); check("bakiye eksiye düşemez 409", r.status === 409);
    r = await call(A, "/api/profile/credits"); check("üye bakiyesini görür", r.body.balances?.boost === 1);
    r = await call(A, "/api/profile/boost", { method: "POST" }); check("kredi ile Boost başlatılır", r.ok && Boolean(r.body.activeUntil), JSON.stringify(r.body).slice(0, 80));
    r = await call(A, "/api/profile/credits"); check("kredi harcandı", r.body.balances?.boost === 0);
    r = await call(A, "/api/profile/boost", { method: "POST" }); check("Boost sürerken ikinci istek kredi harcamaz", r.body.activeUntil && (await call(A, "/api/profile/credits")).body.balances?.boost === 0);
  }

  // Calls (migration 078): signaling lifecycle between two matched members who have chatted.
  if (!(await sv("/rest/v1/call_sessions?select=id&limit=1")).ok) {
    skip("arama akışı", "078 migration'ı uygulanmadı");
  } else {
    const [lo, hi] = [A.profileId, C.profileId].sort();
    const callMatch = (await (await sv("/rest/v1/matches", { method: "POST", body: JSON.stringify({ user_a: lo, user_b: hi }) })).json())[0];
    const post = (who, path, body) => call(who, path, { method: "POST", body: JSON.stringify(body) });
    r = await post(A, "/api/calls", { matchId: callMatch.id, kind: "audio" }); check("arama: sohbet temeli yokken 403", r.status === 403, r.body.error);
    for (const who of [A, C]) for (let i = 0; i < 3; i++) await sv("/rest/v1/messages", { method: "POST", body: JSON.stringify({ match_id: callMatch.id, sender_id: who.profileId, kind: "text", body: `selam ${i}` }) });
    r = await call(A, "/api/calls/ice"); check("ICE sunucuları", r.ok && r.body.iceServers?.[0]?.urls?.length > 0, `relay: ${r.body.relayAvailable}`);
    r = await post(A, "/api/calls", { matchId: "00000000-0000-4000-8000-000000000000", kind: "audio" }); check("arama: olmayan eşleşme 403", r.status === 403);
    await sv(`/rest/v1/notification_preferences?profile_id=eq.${C.profileId}`, { method: "DELETE" });
    await sv("/rest/v1/notification_preferences", { method: "POST", body: JSON.stringify({ profile_id: C.profileId, calls_enabled: false }) });
    r = await post(A, "/api/calls", { matchId: callMatch.id, kind: "video" }); check("arama: aranan aramaları kapattıysa 403", r.status === 403, r.body.error);
    await sv(`/rest/v1/notification_preferences?profile_id=eq.${C.profileId}`, { method: "PATCH", body: JSON.stringify({ calls_enabled: true }) });
    await sv("/rest/v1/blocks", { method: "POST", body: JSON.stringify({ blocker_id: C.profileId, blocked_id: A.profileId }) });
    r = await post(A, "/api/calls", { matchId: callMatch.id, kind: "video" }); check("arama: engelli kişiye 403", r.status === 403);
    await sv(`/rest/v1/blocks?blocker_id=eq.${C.profileId}`, { method: "DELETE" });

    r = await post(A, "/api/calls", { matchId: callMatch.id, kind: "video" }); const callId = r.body.id; check("arama başlat", r.status === 201 && Boolean(callId));
    r = await post(C, "/api/calls", { matchId: callMatch.id, kind: "audio" }); check("hat meşgulken ikinci arama 409", r.status === 409);
    r = await call(C, "/api/calls"); check("aranan gelen aramayı görür", r.ok && r.body.incoming?.id === callId && r.body.incoming.callerName === "Smoke a");
    r = await call(A, "/api/calls"); check("arayan kendi aramasını 'gelen' görmez", r.ok && r.body.incoming === null);
    r = await post(A, `/api/calls/${callId}/signal`, { kind: "offer", payload: { type: "offer", sdp: "v=0 test" } }); check("teklif gönder", r.status === 201);
    r = await post(C, `/api/calls/${callId}/signal`, { kind: "offer", payload: { sdp: "x" } }); check("aranan teklif gönderemez 403", r.status === 403);
    r = await post(C, `/api/calls/${callId}/signal`, { kind: "answer", payload: { sdp: "x" } }); check("kabul etmeden yanıt gönderilemez 403", r.status === 403);
    r = await call(A, `/api/calls/${callId}`, { method: "PATCH", body: JSON.stringify({ action: "accept" }) }); check("arayan kabul edemez 403", r.status === 403);
    r = await call(C, `/api/calls/${callId}`, { method: "PATCH", body: JSON.stringify({ action: "accept" }) }); check("aranan kabul eder", r.ok && r.body.session.status === "accepted");
    r = await call(C, `/api/calls/${callId}`, { method: "PATCH", body: JSON.stringify({ action: "accept" }) }); check("ikinci kabul 409", r.status === 409);
    r = await post(C, `/api/calls/${callId}/signal`, { kind: "answer", payload: { type: "answer", sdp: "v=0 reply" } }); check("yanıt gönder", r.status === 201);
    r = await call(C, `/api/calls/${callId}`); check("aranan teklifi alır, kendi yanıtını görmez", r.ok && r.body.role === "callee" && r.body.signals.length === 1 && r.body.signals[0].kind === "offer" && r.body.peerName === "Smoke a");
    r = await call(A, `/api/calls/${callId}`); check("arayan yanıtı alır", r.ok && r.body.signals.length === 1 && r.body.signals[0].kind === "answer");
    r = await call(B, `/api/calls/${callId}`); check("üçüncü kişi aramayı göremez 404", r.status === 404);
    r = await post(B, `/api/calls/${callId}/signal`, { kind: "ice", payload: { candidate: "x" } }); check("üçüncü kişi sinyal gönderemez 404", r.status === 404);
    r = await post(A, `/api/calls/${callId}/signal`, { kind: "ice", payload: { x: "y".repeat(20000) } }); check("aşırı büyük sinyal reddedilir", r.status === 413);
    r = await call(A, `/api/calls/${callId}`, { method: "PATCH", body: JSON.stringify({ action: "end" }) }); check("aramayı bitir", r.ok && r.body.session.status === "ended");
    r = await call(A, `/api/calls/${callId}`, { method: "PATCH", body: JSON.stringify({ action: "end" }) }); check("ikinci bitirme zararsız", r.ok && r.body.session.status === "ended");
    r = await post(A, `/api/calls/${callId}/signal`, { kind: "ice", payload: { candidate: "x" } }); check("biten aramaya sinyal 409", r.status === 409);
    r = await post(A, "/api/calls", { matchId: callMatch.id, kind: "audio" }); const second = r.body.id; check("bittikten sonra yeni arama", r.status === 201);
    r = await call(C, `/api/calls/${second}`, { method: "PATCH", body: JSON.stringify({ action: "decline" }) }); check("aranan reddeder", r.ok && r.body.session.status === "declined");
    r = await post(A, "/api/calls", { matchId: callMatch.id, kind: "audio" }); const third = r.body.id; r = await call(A, `/api/calls/${third}`, { method: "PATCH", body: JSON.stringify({ action: "cancel" }) }); check("arayan vazgeçer", r.ok && r.body.session.status === "cancelled");
  }
} finally {
  for (const member of members) {
    await sv(`/rest/v1/profiles?id=eq.${member.profileId}`, { method: "DELETE" });
    await sv(`/auth/v1/admin/users/${member.userId}`, { method: "DELETE" });
  }
  if (adminId) {
    await sv(`/rest/v1/admin_users?user_id=eq.${adminId}`, { method: "DELETE" });
    const del = await sv(`/auth/v1/admin/users/${adminId}`, { method: "DELETE" });
    if (!del.ok) await sv(`/auth/v1/admin/users/${adminId}`, { method: "PUT", body: JSON.stringify({ ban_duration: "876000h" }) });
  }
  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} geçti`);
  if (passed !== results.length) process.exitCode = 1;
}
