import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright-core";

createRequire(import.meta.url)("@next/env").loadEnvConfig(process.cwd());

const baseUrl = process.argv[2] ?? "http://127.0.0.1:3000";
const origin = new URL(baseUrl).origin;
const testEnv = await readFile(".env.test.local", "utf8");
const env = (name) => testEnv.match(new RegExp(`^${name}=(.*)$`, "m"))?.[1]?.trim() ?? "";
const qa = {
  a: { email: env("LOVASK_QA_A_EMAIL"), password: env("LOVASK_QA_A_PASSWORD"), profileId: env("LOVASK_QA_A_PROFILE_ID"), name: "QA Erkek Test" },
  b: { email: env("LOVASK_QA_B_EMAIL"), password: env("LOVASK_QA_B_PASSWORD"), profileId: env("LOVASK_QA_B_PROFILE_ID"), name: "QA Kadın Test" },
};
for (const account of Object.values(qa)) if (!account.email || !account.password || !account.profileId) throw new Error("Run create-qa-dating-accounts.mjs first.");

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const outputDir = "artifacts/qa-audit";
await mkdir(outputDir, { recursive: true });

const checks = [];
const events = [];
const record = (name, pass, details = undefined) => checks.push({ name, pass: Boolean(pass), ...(details === undefined ? {} : { details }) });
const body = async (response) => response.json().catch(() => ({}));

async function resetQaPair() {
  const low = qa.a.profileId < qa.b.profileId ? qa.a.profileId : qa.b.profileId;
  const high = low === qa.a.profileId ? qa.b.profileId : qa.a.profileId;
  const { data: matches, error: matchReadError } = await admin.from("matches").select("id").eq("user_a", low).eq("user_b", high);
  if (matchReadError) throw matchReadError;
  for (const match of matches ?? []) {
    const deleted = await admin.from("matches").delete().eq("id", match.id);
    if (deleted.error) throw deleted.error;
  }
  for (const [left, right] of [[qa.a.profileId, qa.b.profileId], [qa.b.profileId, qa.a.profileId]]) {
    for (const table of ["swipes", "blocks"]) {
      const leftColumn = table === "swipes" ? "swiper_id" : "blocker_id";
      const rightColumn = table === "swipes" ? "target_id" : "blocked_id";
      const deleted = await admin.from(table).delete().eq(leftColumn, left).eq(rightColumn, right);
      if (deleted.error) throw deleted.error;
    }
  }
  const reports = await admin.from("reports").delete().in("reporter_id", [qa.a.profileId, qa.b.profileId]).in("reported_id", [qa.a.profileId, qa.b.profileId]);
  if (reports.error) throw reports.error;
  for (const table of ["swipe_daily_usage", "message_daily_usage", "message_request_daily_usage", "notification_read_state"]) {
    const deleted = await admin.from(table).delete().in("profile_id", [qa.a.profileId, qa.b.profileId]);
    if (deleted.error) throw deleted.error;
  }
  const visible = await admin.from("profiles").update({ is_discoverable: true, deleted_at: null, safety_restricted_at: null }).in("id", [qa.a.profileId, qa.b.profileId]);
  if (visible.error) throw visible.error;
}

async function login(browser, account, label) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  const page = await context.newPage();
  page.on("pageerror", (error) => events.push(`${label}:pageerror:${error.message}`));
  page.on("requestfailed", (request) => {
    if (!request.url().includes("_rsc=") && !request.url().includes("/auth/v1/logout")) events.push(`${label}:requestfailed:${request.url()}:${request.failure()?.errorText}`);
  });
  await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle", timeout: 60_000 });
  await page.getByLabel("E-posta").fill(account.email);
  await page.locator('input[autocomplete="current-password"]').fill(account.password);
  await page.locator("form").getByRole("button", { name: "Giriş yap" }).click();
  await page.waitForURL((url) => url.origin === origin && url.pathname !== "/login", { timeout: 60_000 });
  await page.waitForLoadState("networkidle");
  return { context, page };
}

await resetQaPair();
const browser = await chromium.launch({ executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", headless: true });

try {
  const anonymous = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  const emptyLogin = await anonymous.request.post(`${baseUrl}/api/auth/password`, { headers: { Origin: origin }, data: {} });
  record("auth.empty", emptyLogin.status() === 400, { status: emptyLogin.status() });
  const shortPassword = await anonymous.request.post(`${baseUrl}/api/auth/password`, { headers: { Origin: origin }, data: { mode: "login", email: qa.a.email, password: "short" } });
  record("auth.passwordValidation", shortPassword.status() === 400, { status: shortPassword.status() });
  const wrongPassword = await anonymous.request.post(`${baseUrl}/api/auth/password`, { headers: { Origin: origin }, data: { mode: "login", email: qa.a.email, password: "WrongPassword1!" } });
  const missingAccount = await anonymous.request.post(`${baseUrl}/api/auth/password`, { headers: { Origin: origin }, data: { mode: "login", email: "qa-olmayan-hesap@lovask.com.tr", password: "WrongPassword1!" } });
  const [wrongBody, missingBody] = await Promise.all([body(wrongPassword), body(missingAccount)]);
  record("auth.invalidCredentials", [400, 401].includes(wrongPassword.status()) && wrongBody.code === "invalid_credentials", { status: wrongPassword.status(), code: wrongBody.code });
  record("auth.noEnumeration", wrongPassword.status() === missingAccount.status() && wrongBody.code === missingBody.code, { wrong: wrongBody.code, missing: missingBody.code });
  const crossOrigin = await anonymous.request.post(`${baseUrl}/api/auth/password`, { headers: { Origin: "https://example.invalid" }, data: { mode: "login", email: qa.a.email, password: qa.a.password } });
  record("auth.origin", crossOrigin.status() === 403, { status: crossOrigin.status() });
  const duplicate = await anonymous.request.post(`${baseUrl}/api/auth/register`, {
    headers: { Origin: origin },
    data: { fullName: qa.a.name, email: qa.a.email, password: qa.a.password, passwordConfirmation: qa.a.password, termsAccepted: true, privacyAccepted: true, marketingConsent: false },
  });
  const duplicateBody = await body(duplicate);
  record("auth.duplicateOrClosedRegistration", [403, 409].includes(duplicate.status()) && ["registration_closed", "account_exists"].includes(duplicateBody.code), { status: duplicate.status(), code: duplicateBody.code });
  const protectedApi = await anonymous.request.get(`${baseUrl}/api/notifications`);
  const protectedPage = await anonymous.newPage();
  await protectedPage.goto(`${baseUrl}/onboarding`, { waitUntil: "networkidle", timeout: 60_000 });
  record("auth.protectedApi", protectedApi.status() === 401, { status: protectedApi.status() });
  record("auth.protectedPage", new URL(protectedPage.url()).pathname === "/login", { url: protectedPage.url() });
  const resetPage = await anonymous.newPage();
  await resetPage.goto(`${baseUrl}/reset-password`, { waitUntil: "networkidle", timeout: 60_000 });
  record("auth.forgotPasswordUi", await resetPage.locator('input[type="email"]').isVisible());
  await anonymous.close();

  const a = await login(browser, qa.a, "A");
  const b = await login(browser, qa.b, "B");
  record("auth.loginA", new URL(a.page.url()).pathname !== "/login");
  record("auth.loginB", new URL(b.page.url()).pathname !== "/login");
  await a.page.reload({ waitUntil: "networkidle" });
  record("auth.sessionRefresh", (await a.context.request.get(`${baseUrl}/api/profile/onboarding`)).status() === 200);

  const profileAResponse = await a.context.request.get(`${baseUrl}/api/profile/onboarding`);
  const profileA = (await body(profileAResponse)).profile;
  record("profile.persistence", profileAResponse.status() === 200 && profileA?.name === qa.a.name && profileA?.city === "İstanbul" && profileA?.photos?.length === 2, { status: profileAResponse.status(), photos: profileA?.photos?.length });
  const validProfile = {
    action: "save",
    name: qa.a.name,
    birthDate: "1999-04-15",
    gender: "erkek",
    city: "İstanbul",
    phone: "",
    badgeSlugs: ["serious", "coffee"],
    prompt: profileA.prompt,
    answer: profileA.answer,
    minAge: 18,
    maxAge: 80,
    interestedGenders: ["kadın"],
    sameCityOnly: true,
    relationshipGoal: "serious",
    maritalStatus: "never_married",
    hasChildren: false,
    childrenPreference: "open",
    district: "",
    alcoholUse: "",
    smokingUse: "",
    petPreference: "",
    sportsHabit: "",
    heightCm: null,
    educationLevel: "",
    languages: [],
  };
  const longName = await a.context.request.post(`${baseUrl}/api/profile/onboarding`, { data: { ...validProfile, name: "x".repeat(61) } });
  const underage = await a.context.request.post(`${baseUrl}/api/profile/onboarding`, { data: { ...validProfile, birthDate: "2012-01-01" } });
  const invalidGender = await a.context.request.post(`${baseUrl}/api/profile/onboarding`, { data: { ...validProfile, gender: "unexpected" } });
  record("profile.longValue", longName.status() === 400, { status: longName.status() });
  record("profile.underage", underage.status() === 400, { status: underage.status() });
  record("profile.unexpectedGenderRejected", invalidGender.status() === 400, { status: invalidGender.status() });
  await a.context.request.post(`${baseUrl}/api/profile/onboarding`, { data: validProfile });
  const xssText = "QA <b>Türkçe</b> 😊 & özel";
  const xssSave = await a.context.request.post(`${baseUrl}/api/profile/onboarding`, { data: { ...validProfile, answer: xssText } });
  await a.page.goto(`${baseUrl}/?tab=profile`, { waitUntil: "networkidle", timeout: 60_000 });
  record("profile.reactEscaping", xssSave.status() === 200 && await a.page.getByText(xssText, { exact: true }).isVisible() && await a.page.locator("blockquote b b").count() === 0, { status: xssSave.status() });
  await a.context.request.post(`${baseUrl}/api/profile/onboarding`, { data: validProfile });

  const { data: bPhoto } = await admin.from("profile_photos").select("id").eq("profile_id", qa.b.profileId).order("sort_order").limit(1).single();
  const idorPhotoDelete = await a.context.request.delete(`${baseUrl}/api/profile/photos`, { data: { photoId: bPhoto.id } });
  record("security.photoOwnership", idorPhotoDelete.status() === 404, { status: idorPhotoDelete.status() });
  const badImage = await a.context.request.post(`${baseUrl}/api/profile/photos`, { multipart: { photo: { name: "bad.jpg", mimeType: "image/jpeg", buffer: Buffer.from("not-an-image") } } });
  record("profile.invalidImage", badImage.status() === 400, { status: badImage.status() });
  const uploadBytes = await readFile("public/profiles/mert.webp");
  const uploaded = await a.context.request.post(`${baseUrl}/api/profile/photos`, { multipart: { photo: { name: "qa-upload.webp", mimeType: "image/webp", buffer: uploadBytes } } });
  const uploadedBody = await body(uploaded);
  record("profile.photoUpload", uploaded.status() === 201 && Boolean(uploadedBody.photo?.id), { status: uploaded.status() });
  if (uploadedBody.photo?.id) {
    const removed = await a.context.request.delete(`${baseUrl}/api/profile/photos`, { data: { photoId: uploadedBody.photo.id } });
    record("profile.photoDelete", removed.status() === 200, { status: removed.status() });
  }

  const unmatchedChat = await a.context.request.get(`${baseUrl}/api/chat?profileId=${qa.b.profileId}`);
  record("security.messageAuthorization", unmatchedChat.status() === 403, { status: unmatchedChat.status() });
  const allowanceResponse = await a.context.request.get(`${baseUrl}/api/discovery?summary=1`);
  const allowance = await body(allowanceResponse);
  record("discovery.initialAllowance", allowanceResponse.status() === 200 && allowance.likeAllowance?.remaining === 10, allowance.likeAllowance);
  const rankedQaCard = await admin.from("swipes").insert({ swiper_id: qa.b.profileId, target_id: qa.a.profileId, direction: "right" });
  if (rankedQaCard.error) throw rankedQaCard.error;
  const deckA = await body(await a.context.request.get(`${baseUrl}/api/discovery`));
  record("discovery.mutualVisibilityA", deckA.profiles?.some((profile) => profile.id === qa.b.profileId), { count: deckA.profiles?.length });
  const removedRank = await admin.from("swipes").delete().eq("swiper_id", qa.b.profileId).eq("target_id", qa.a.profileId);
  if (removedRank.error) throw removedRank.error;
  const deckB = await body(await b.context.request.get(`${baseUrl}/api/discovery`));
  record("discovery.mutualVisibilityB", deckB.profiles?.some((profile) => profile.id === qa.a.profileId), { count: deckB.profiles?.length });
  const basicFilter = { minAge: 18, maxAge: 80, verifiedOnly: false, sameCityOnly: false, cities: [], relationshipGoals: [], maxDistanceKm: null, maritalStatuses: [], hasChildrenValues: [], childrenPreferences: [], alcoholValues: [], smokingValues: [], petValues: [], sportsValues: [], zodiacValues: [], minHeightCm: null, maxHeightCm: null, educationValues: [], languageValues: [] };
  const wrongFilter = await a.context.request.patch(`${baseUrl}/api/discovery/preferences`, { data: { ...basicFilter, interestedGenders: ["erkek"] } });
  const filteredDeck = await body(await a.context.request.get(`${baseUrl}/api/discovery`));
  record("discovery.backendFilter", wrongFilter.status() === 200 && !filteredDeck.profiles?.some((profile) => profile.id === qa.b.profileId));
  const restoredFilter = await a.context.request.patch(`${baseUrl}/api/discovery/preferences`, { data: { ...basicFilter, interestedGenders: ["kadın"] } });
  record("discovery.filterRestore", restoredFilter.status() === 200, { status: restoredFilter.status() });
  const hideB = await b.context.request.patch(`${baseUrl}/api/profile/account`, { data: { discoverable: false } });
  const hiddenDeck = await body(await a.context.request.get(`${baseUrl}/api/discovery`));
  record("privacy.discoveryVisibility", hideB.status() === 200 && !hiddenDeck.profiles?.some((profile) => profile.id === qa.b.profileId));
  await b.context.request.patch(`${baseUrl}/api/profile/account`, { data: { discoverable: true } });

  const firstLike = await a.context.request.post(`${baseUrl}/api/discovery`, { data: { targetProfileId: qa.b.profileId, direction: "right" } });
  const firstLikeBody = await body(firstLike);
  record("match.firstLike", firstLike.status() === 200 && firstLikeBody.matched === false, { status: firstLike.status(), body: firstLikeBody });
  const notificationB = await body(await b.context.request.get(`${baseUrl}/api/notifications`));
  record("notifications.like", notificationB.unreadLikes >= 1, notificationB);
  const mutualLike = await b.context.request.post(`${baseUrl}/api/discovery`, { data: { targetProfileId: qa.a.profileId, direction: "right" } });
  const mutualBody = await body(mutualLike);
  record("match.mutual", mutualLike.status() === 200 && mutualBody.matched === true && Boolean(mutualBody.matchId), { status: mutualLike.status(), body: mutualBody });
  const duplicateLike = await b.context.request.post(`${baseUrl}/api/discovery`, { data: { targetProfileId: qa.a.profileId, direction: "right" } });
  record("match.duplicateLike", duplicateLike.status() === 409, { status: duplicateLike.status() });
  const low = qa.a.profileId < qa.b.profileId ? qa.a.profileId : qa.b.profileId;
  const high = low === qa.a.profileId ? qa.b.profileId : qa.a.profileId;
  const { data: matchRows } = await admin.from("matches").select("id,status").eq("user_a", low).eq("user_b", high);
  const matchId = matchRows?.[0]?.id;
  record("match.databaseUnique", matchRows?.length === 1 && matchRows[0].status === "active", matchRows);
  const conversationsA = await body(await a.context.request.get(`${baseUrl}/api/conversations`));
  const conversationsB = await body(await b.context.request.get(`${baseUrl}/api/conversations`));
  record("match.visibleBoth", conversationsA.conversations?.some((item) => item.matchId === matchId && item.matched) && conversationsB.conversations?.some((item) => item.matchId === matchId && item.matched));

  await a.page.goto(`${baseUrl}/?tab=messages`, { waitUntil: "networkidle", timeout: 60_000 });
  await b.page.goto(`${baseUrl}/?tab=messages`, { waitUntil: "networkidle", timeout: 60_000 });
  await a.page.locator("button.conversation").filter({ hasText: qa.b.name }).click();
  await a.page.getByRole("textbox", { name: "Mesaj" }).waitFor();
  await a.page.getByRole("textbox", { name: "Mesaj" }).fill("QA TEST UNREAD - Türkçe 😊");
  await a.page.getByRole("button", { name: "Gönder" }).click();
  const inboxRealtime = await b.page.getByText("QA TEST UNREAD - Türkçe 😊", { exact: true }).waitFor({ timeout: 15_000 }).then(() => true).catch(() => false);
  record("messaging.inboxRealtime", inboxRealtime);
  if (!inboxRealtime) await b.page.screenshot({ path: `${outputDir}/inbox-realtime-failure.png`, fullPage: true });
  await b.page.locator("button.conversation").filter({ hasText: qa.a.name }).click();
  await b.page.getByRole("textbox", { name: "Mesaj" }).waitFor();
  const messageA = "QA TEST 001 - otomatik test mesajı";
  await a.page.getByRole("textbox", { name: "Mesaj" }).fill(messageA);
  await a.page.getByRole("button", { name: "Gönder" }).click();
  const realtimeAtoB = await b.page.getByText(messageA).waitFor({ timeout: 15_000 }).then(() => true).catch(() => false);
  if (!realtimeAtoB) await b.page.screenshot({ path: `${outputDir}/chat-realtime-failure.png`, fullPage: true });
  record("messaging.realtimeAtoB", realtimeAtoB);
  const messageB = "QA TEST 002 - cevap mesajı";
  await b.page.getByRole("textbox", { name: "Mesaj" }).fill(messageB);
  await b.page.getByRole("button", { name: "Gönder" }).click();
  await a.page.getByText(messageB).waitFor({ timeout: 15_000 });
  record("messaging.realtimeBtoA", true);

  const whitespace = await a.context.request.post(`${baseUrl}/api/chat`, { data: { profileId: qa.b.profileId, message: "   ", clientId: crypto.randomUUID() } });
  const tooLong = await a.context.request.post(`${baseUrl}/api/chat`, { data: { profileId: qa.b.profileId, message: "x".repeat(1201), clientId: crypto.randomUUID() } });
  record("messaging.emptyValidation", whitespace.status() === 400, { status: whitespace.status() });
  record("messaging.longValidation", tooLong.status() === 400, { status: tooLong.status() });
  const duplicateId = crypto.randomUUID();
  const firstDuplicate = await a.context.request.post(`${baseUrl}/api/chat`, { data: { profileId: qa.b.profileId, message: "QA duplicate idempotency", clientId: duplicateId } });
  const secondDuplicate = await a.context.request.post(`${baseUrl}/api/chat`, { data: { profileId: qa.b.profileId, message: "QA duplicate idempotency", clientId: duplicateId } });
  const secondDuplicateBody = await body(secondDuplicate);
  record("messaging.idempotency", firstDuplicate.status() === 201 && secondDuplicate.status() === 200 && secondDuplicateBody.duplicate === true, { first: firstDuplicate.status(), second: secondDuplicate.status() });
  const rapid = await Promise.all([1, 2, 3].map((index) => a.context.request.post(`${baseUrl}/api/chat`, { data: { profileId: qa.b.profileId, message: `QA rapid ${index}`, clientId: crypto.randomUUID() } })));
  record("messaging.rapid", rapid.every((response) => response.status() === 201), rapid.map((response) => response.status()));
  const history = await body(await b.context.request.get(`${baseUrl}/api/chat?profileId=${qa.a.profileId}`));
  const timestamps = (history.messages ?? []).map((message) => Date.parse(message.createdAt));
  record("messaging.persistence", history.messages?.some((message) => message.text === messageA) && history.messages?.some((message) => message.text === messageB));
  record("messaging.order", timestamps.every((value, index) => index === 0 || value >= timestamps[index - 1]), timestamps);
  const duplicateRows = await admin.from("messages").select("id", { count: "exact", head: true }).eq("match_id", matchId).eq("client_message_id", duplicateId);
  record("messaging.databaseIdempotency", duplicateRows.count === 1, { count: duplicateRows.count });

  const quiet = await a.context.request.patch(`${baseUrl}/api/push/preferences`, { data: { quietHoursEnabled: true, quietStart: "22:30", quietEnd: "08:30", timezone: "Europe/Istanbul" } });
  const quietBody = await body(await a.context.request.get(`${baseUrl}/api/push/preferences`));
  record("privacy.notificationPreferences", quiet.status() === 200 && quietBody.preferences?.quiet_start?.startsWith("22:30"), { status: quiet.status(), quietStart: quietBody.preferences?.quiet_start });
  const badDeletion = await a.context.request.delete(`${baseUrl}/api/profile/account`, { data: { confirmation: "yanlış" } });
  record("account.deletionConfirmation", badDeletion.status() === 400, { status: badDeletion.status() });

  const viewports = [[360, 800], [390, 844], [768, 1024], [1440, 1000]];
  for (const [width, height] of viewports) {
    await a.page.setViewportSize({ width, height });
    const layout = await a.page.evaluate(() => ({ viewport: innerWidth, body: document.body.scrollWidth, html: document.documentElement.scrollWidth }));
    record(`responsive.chat.${width}`, Math.max(layout.body, layout.html) <= width, layout);
    await a.page.screenshot({ path: `${outputDir}/chat-${width}.png`, fullPage: true });
  }
  await a.page.setViewportSize({ width: 390, height: 844 });
  await a.page.getByRole("button", { name: "Güvenlik seçenekleri" }).click();
  await a.page.getByRole("button", { name: "Şikâyet et" }).click();
  await a.page.getByLabel("Şikâyet nedeni").selectOption("other");
  await a.page.getByLabel("Şikâyet ayrıntısı").fill("QA otomatik rapor testi");
  await a.page.getByLabel("Bu profili ayrıca engelle").uncheck();
  await a.page.screenshot({ path: `${outputDir}/report-modal-390.png`, fullPage: true });
  await a.page.getByRole("button", { name: "Şikâyeti gönder" }).click();
  await a.page.getByText("Şikâyetin güvenlik ekibine iletildi.").waitFor();
  const reportRows = await admin.from("reports").select("id,reason,details,match_id").eq("reporter_id", qa.a.profileId).eq("reported_id", qa.b.profileId);
  record("safety.report", reportRows.data?.length === 1 && reportRows.data[0].reason === "other" && reportRows.data[0].match_id === matchId, reportRows.data);
  const invalidReport = await a.context.request.post(`${baseUrl}/api/safety`, { data: { action: "report", targetProfileId: qa.b.profileId, reason: "invalid" } });
  record("safety.reportValidation", invalidReport.status() === 400, { status: invalidReport.status() });

  const blocked = await a.context.request.post(`${baseUrl}/api/safety`, { data: { action: "block", targetProfileId: qa.b.profileId } });
  const blockedMessage = await b.context.request.post(`${baseUrl}/api/chat`, { data: { profileId: qa.a.profileId, message: "blocked", clientId: crypto.randomUUID() } });
  const blockedConversations = await body(await b.context.request.get(`${baseUrl}/api/conversations`));
  const blockRows = await admin.from("blocks").select("blocker_id").eq("blocker_id", qa.a.profileId).eq("blocked_id", qa.b.profileId);
  record("safety.block", blocked.status() === 200 && blockRows.data?.length === 1 && blockedMessage.status() === 403 && !blockedConversations.conversations?.some((item) => item.matchId === matchId), { block: blocked.status(), message: blockedMessage.status() });
  const unblocked = await a.context.request.post(`${baseUrl}/api/safety`, { data: { action: "unblock", targetProfileId: qa.b.profileId } });
  const blockAfter = await admin.from("blocks").select("blocker_id").eq("blocker_id", qa.a.profileId).eq("blocked_id", qa.b.profileId);
  record("safety.unblock", unblocked.status() === 200 && blockAfter.data?.length === 0, { status: unblocked.status() });

  await resetQaPair();
  await a.context.request.post(`${baseUrl}/api/discovery`, { data: { targetProfileId: qa.b.profileId, direction: "right" } });
  const rematch = await b.context.request.post(`${baseUrl}/api/discovery`, { data: { targetProfileId: qa.a.profileId, direction: "right" } });
  const rematchBody = await body(rematch);
  const unmatched = await a.context.request.post(`${baseUrl}/api/safety`, { data: { action: "unmatch", targetProfileId: qa.b.profileId } });
  const afterUnmatchA = await body(await a.context.request.get(`${baseUrl}/api/conversations`));
  const afterUnmatchB = await body(await b.context.request.get(`${baseUrl}/api/conversations`));
  record("safety.unmatch", rematchBody.matched === true && unmatched.status() === 200 && !afterUnmatchA.conversations?.some((item) => item.profile.id === qa.b.profileId) && !afterUnmatchB.conversations?.some((item) => item.profile.id === qa.a.profileId), { unmatch: unmatched.status() });

  const scheduledDeletion = await a.context.request.delete(`${baseUrl}/api/profile/account`, { data: { confirmation: "HESABIMI SİL" } });
  const scheduledBody = await body(scheduledDeletion);
  const [{ data: deletionRequest }, { data: hiddenProfile }] = await Promise.all([
    admin.from("account_deletion_requests").select("scheduled_for,cancelled_at,completed_at").eq("profile_id", qa.a.profileId).single(),
    admin.from("profiles").select("deleted_at,is_discoverable").eq("id", qa.a.profileId).single(),
  ]);
  record("account.deletionScheduled", scheduledDeletion.status() === 202 && Boolean(scheduledBody.scheduledFor) && Boolean(deletionRequest?.scheduled_for) && !deletionRequest?.cancelled_at && Boolean(hiddenProfile?.deleted_at) && hiddenProfile?.is_discoverable === false, { status: scheduledDeletion.status() });
  const restoredAccount = await a.context.request.post(`${baseUrl}/api/profile/account`);
  const [{ data: restoredRequest }, { data: restoredProfile }] = await Promise.all([
    admin.from("account_deletion_requests").select("cancelled_at").eq("profile_id", qa.a.profileId).single(),
    admin.from("profiles").select("deleted_at").eq("id", qa.a.profileId).single(),
  ]);
  record("account.deletionCancelled", restoredAccount.status() === 200 && Boolean(restoredRequest?.cancelled_at) && restoredProfile?.deleted_at === null, { status: restoredAccount.status() });
  await a.context.request.patch(`${baseUrl}/api/profile/account`, { data: { discoverable: true } });

  await a.page.goto(`${baseUrl}/?tab=profile`, { waitUntil: "networkidle", timeout: 60_000 });
  await a.page.getByRole("button", { name: /Oturumu kapat/ }).click();
  await a.page.waitForURL((url) => url.pathname === "/login", { timeout: 15_000 });
  const afterLogout = await a.context.request.get(`${baseUrl}/api/notifications`);
  record("auth.logout", afterLogout.status() === 401, { status: afterLogout.status() });

  await Promise.all([a.context.close(), b.context.close()]);
} catch (error) {
  events.push(`fatal:${error instanceof Error ? error.stack ?? error.message : String(error)}`);
} finally {
  await browser.close();
}

const result = { baseUrl, pass: checks.every((check) => check.pass) && events.length === 0, checks, events };
await writeFile(`${outputDir}/qa-flow.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
assert.equal(events.length, 0, "Browser flow produced fatal errors.");
if (!result.pass) process.exitCode = 1;
