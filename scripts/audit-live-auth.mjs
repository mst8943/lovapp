import { mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright-core";

const baseUrl = process.env.LOVASK_BASE_URL ?? "https://lovask.com.tr";
const required = [
  "LOVASK_STANDARD_EMAIL", "LOVASK_STANDARD_PASSWORD", "LOVASK_STANDARD_PROFILE_ID",
  "LOVASK_NOIR_EMAIL", "LOVASK_NOIR_PASSWORD", "LOVASK_NOIR_PROFILE_ID",
  "LOVASK_OWNER_EMAIL", "LOVASK_OWNER_PASSWORD",
];
for (const name of required) if (!process.env[name]) throw new Error(`${name} is missing.`);
await mkdir("artifacts/test-audit", { recursive: true });

const browser = await chromium.launch({
  executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  headless: true,
});
const browserEvents = [];

async function login(kind, email, password) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
  const page = await context.newPage();
  page.on("pageerror", (error) => browserEvents.push(`${kind}:pageerror:${error.message}`));
  await page.goto(`${baseUrl}/login`, { waitUntil: "networkidle", timeout: 60_000 });
  await page.getByLabel("E-posta").fill(email);
  await page.locator('input[autocomplete="current-password"]').fill(password);
  await page.locator("form").getByRole("button", { name: "Giriş yap" }).click();
  await page.waitForURL((url) => url.origin === new URL(baseUrl).origin && url.pathname !== "/login", { timeout: 60_000 });
  await page.waitForLoadState("networkidle");
  return { context, page };
}

async function json(response) {
  return response.json().catch(() => ({}));
}

const standard = await login("standard", process.env.LOVASK_STANDARD_EMAIL, process.env.LOVASK_STANDARD_PASSWORD);
const noir = await login("noir", process.env.LOVASK_NOIR_EMAIL, process.env.LOVASK_NOIR_PASSWORD);
const owner = await login("owner", process.env.LOVASK_OWNER_EMAIL, process.env.LOVASK_OWNER_PASSWORD);

const results = { login: {}, authorization: {}, entitlement: {}, matching: {}, messaging: {}, quotas: {}, admin: {}, bots: {}, notifications: {} };
results.login = {
  standard: new URL(standard.page.url()).pathname !== "/login",
  noir: new URL(noir.page.url()).pathname !== "/login",
  owner: new URL(owner.page.url()).pathname !== "/login",
};

const [standardAdmin, standardLikes, standardVisitors, standardAllowance] = await Promise.all([
  standard.context.request.get(`${baseUrl}/api/admin/health`),
  standard.context.request.get(`${baseUrl}/api/discovery/likes`),
  standard.context.request.get(`${baseUrl}/api/profile/visitors`),
  standard.context.request.get(`${baseUrl}/api/discovery?summary=1`),
]);
const standardLikesBody = await json(standardLikes);
const standardVisitorsBody = await json(standardVisitors);
const standardAllowanceBody = await json(standardAllowance);
results.authorization.standardAdminDenied = standardAdmin.status() === 403;
results.entitlement.standardLikesPrivate = standardLikes.status() === 200
  && standardLikesBody.premium === false && standardLikesBody.count === 0
  && Array.isArray(standardLikesBody.profiles) && standardLikesBody.profiles.length === 0;
results.entitlement.standardVisitorsPrivate = standardVisitors.status() === 200
  && standardVisitorsBody.premium === false && standardVisitorsBody.count === 0
  && Array.isArray(standardVisitorsBody.visitors) && standardVisitorsBody.visitors.length === 0;
results.entitlement.standardAllowance = standardAllowanceBody.likeAllowance ?? null;

const firstSwipe = await standard.context.request.post(`${baseUrl}/api/discovery`, {
  data: { targetProfileId: process.env.LOVASK_NOIR_PROFILE_ID, direction: "right" },
});
const firstSwipeBody = await json(firstSwipe);
results.matching.standardLikeAccepted = firstSwipe.status() === 200 && firstSwipeBody.matched === false;

const noirLikes = await noir.context.request.get(`${baseUrl}/api/discovery/likes`);
const noirLikesBody = await json(noirLikes);
results.entitlement.noirCanSeeLiker = noirLikes.status() === 200 && noirLikesBody.premium === true
  && Array.isArray(noirLikesBody.profiles)
  && noirLikesBody.profiles.some((profile) => profile.id === process.env.LOVASK_STANDARD_PROFILE_ID);

const mutualSwipe = await noir.context.request.post(`${baseUrl}/api/discovery`, {
  data: { targetProfileId: process.env.LOVASK_STANDARD_PROFILE_ID, direction: "right" },
});
const mutualSwipeBody = await json(mutualSwipe);
results.matching.mutualMatch = mutualSwipe.status() === 200 && mutualSwipeBody.matched === true && Boolean(mutualSwipeBody.matchId);

const initialMessage = await noir.context.request.post(`${baseUrl}/api/chat`, {
  data: { profileId: process.env.LOVASK_STANDARD_PROFILE_ID, message: "[AUDIT] Noir eşleşme mesajı", clientId: randomUUID() },
});
const initialMessageBody = await json(initialMessage);
results.messaging.noirToStandard = initialMessage.status() === 201 && initialMessageBody.messageLimit === 100;

const history = await standard.context.request.get(`${baseUrl}/api/chat?profileId=${process.env.LOVASK_NOIR_PROFILE_ID}`);
const historyBody = await json(history);
results.messaging.historyVisible = history.status() === 200 && Array.isArray(historyBody.messages)
  && historyBody.messages.some((message) => message.text === "[AUDIT] Noir eşleşme mesajı");

const standardMessageStatuses = [];
for (let index = 1; index <= 26; index += 1) {
  const response = await standard.context.request.post(`${baseUrl}/api/chat`, {
    data: { profileId: process.env.LOVASK_NOIR_PROFILE_ID, message: `[AUDIT] Standart kota ${index}/26`, clientId: randomUUID() },
  });
  standardMessageStatuses.push({ status: response.status(), body: await json(response) });
}
const acceptedMessages = standardMessageStatuses.filter((entry) => entry.status === 201);
const rejectedMessages = standardMessageStatuses.filter((entry) => entry.status === 429);
results.quotas.standardMessages = {
  pass: acceptedMessages.length === 25 && rejectedMessages.length === 1,
  accepted: acceptedMessages.length,
  rejected: rejectedMessages.length,
  finalRemaining: acceptedMessages.at(-1)?.body?.remainingMessages,
  limit: acceptedMessages.at(-1)?.body?.messageLimit,
};

const deckResponse = await standard.context.request.get(`${baseUrl}/api/discovery`);
const deckBody = await json(deckResponse);
const botProfiles = Array.isArray(deckBody.profiles) ? deckBody.profiles.filter((profile) => profile.isBot) : [];
const remainingLikes = Number(deckBody.likeAllowance?.remaining ?? 0);
const botSwipeResults = [];
for (const profile of botProfiles.slice(0, Math.max(0, remainingLikes + 1))) {
  const response = await standard.context.request.post(`${baseUrl}/api/discovery`, {
    data: { targetProfileId: profile.id, direction: "right" },
  });
  botSwipeResults.push({ status: response.status(), body: await json(response) });
}
results.quotas.standardLikes = {
  expectedRemainingBefore: remainingLikes,
  accepted: botSwipeResults.filter((entry) => entry.status === 200).length,
  rejected: botSwipeResults.filter((entry) => entry.status === 429).length,
  pass: remainingLikes > 0
    && botSwipeResults.filter((entry) => entry.status === 200).length === remainingLikes
    && botSwipeResults.some((entry) => entry.status === 429),
};
results.bots.testAccountBotLikesCreated = botSwipeResults.filter((entry) => entry.status === 200).length;

const [ownerHealth, ownerBots, ownerAi, standardNotifications, noirNotifications] = await Promise.all([
  owner.context.request.get(`${baseUrl}/api/admin/health`),
  owner.context.request.get(`${baseUrl}/api/admin/bots`),
  owner.context.request.get(`${baseUrl}/api/admin/ai-settings`),
  standard.context.request.get(`${baseUrl}/api/notifications`),
  noir.context.request.get(`${baseUrl}/api/notifications`),
]);
const ownerHealthBody = await json(ownerHealth);
const ownerBotsBody = await json(ownerBots);
results.admin = {
  healthStatus: ownerHealth.status(),
  botsStatus: ownerBots.status(),
  aiStatus: ownerAi.status(),
  healthAvailable: ownerHealth.status() === 200 && Boolean(ownerHealthBody.measuredAt),
};
results.bots.ownerMetricsAvailable = ownerBots.status() === 200 && Array.isArray(ownerBotsBody.bots);
results.bots.botCount = Array.isArray(ownerBotsBody.bots) ? ownerBotsBody.bots.length : null;
results.bots.pendingJobs = Array.isArray(ownerBotsBody.bots)
  ? ownerBotsBody.bots.reduce((sum, bot) => sum + Number(bot.pendingJobs ?? 0), 0) : null;
results.bots.failedJobs = Array.isArray(ownerBotsBody.bots)
  ? ownerBotsBody.bots.reduce((sum, bot) => sum + Number(bot.failedJobs ?? 0), 0) : null;
results.notifications = { standardStatus: standardNotifications.status(), noirStatus: noirNotifications.status() };

await standard.page.goto(`${baseUrl}/?tab=messages`, { waitUntil: "networkidle", timeout: 60_000 });
await standard.page.screenshot({ path: "artifacts/test-audit/live-authenticated-messages.png", fullPage: true });
await owner.page.goto(`${baseUrl}/admin/lovask-control`, { waitUntil: "networkidle", timeout: 60_000 });
await owner.page.screenshot({ path: "artifacts/test-audit/live-owner-dashboard.png", fullPage: true });

await Promise.all([standard.context.close(), noir.context.close(), owner.context.close()]);
await browser.close();

const pass = results.login.standard && results.login.noir && results.login.owner
  && results.authorization.standardAdminDenied
  && results.entitlement.standardLikesPrivate && results.entitlement.standardVisitorsPrivate && results.entitlement.noirCanSeeLiker
  && results.matching.standardLikeAccepted && results.matching.mutualMatch
  && results.messaging.noirToStandard && results.messaging.historyVisible
  && results.quotas.standardMessages.pass && results.quotas.standardLikes.pass
  && results.admin.healthAvailable && results.admin.botsStatus === 200 && results.admin.aiStatus === 200
  && results.bots.ownerMetricsAvailable
  && results.notifications.standardStatus === 200 && results.notifications.noirStatus === 200
  && browserEvents.length === 0;
console.log(JSON.stringify({ baseUrl, pass, results, browserEvents }, null, 2));
if (!pass) process.exitCode = 1;
