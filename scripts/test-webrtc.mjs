// npm run test:webrtc: starts two real headless Chromium pages with fake camera/microphone, connects them through
// lib/call-engine.ts over loopback and checks audio/video flow, mute/camera toggles and permission errors.
// Set CHROMIUM_PATH to use a specific Chromium build.
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "package.json"));
const ts = require("typescript");
const { chromium } = require("playwright-core");
const engineJs = ts.transpileModule(readFileSync(path.join(root, "lib/call-engine.ts"), "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;

const html = `<!doctype html><meta charset=utf-8><body><video id=local autoplay muted playsinline></video><video id=remote autoplay playsinline></video>
<script type=module>
${engineJs.replace(/export class/g, "window.CallEngine = class").replace(/export /g, "")}
window.setup = (role, media, denyMedia) => {
  window.phases = [];
  if (denyMedia) navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException("denied", "NotAllowedError"));
  window.engine = new window.CallEngine({
    role, media, iceServers: [],
    sendSignal: (kind, payload) => window.__send(kind, payload),
    onLocalStream: (s) => { document.getElementById("local").srcObject = s; },
    onRemoteStream: (s) => { document.getElementById("remote").srcObject = s; },
    onPhase: (p, d) => window.phases.push(p + (d ? ":" + d : "")),
  });
  return window.engine.start();
};
window.recv = (kind, payload) => window.engine.handleSignal(kind, payload);
window.info = () => { const r = document.getElementById("remote"); const s = r.srcObject; return { phases: window.phases, audio: s ? s.getAudioTracks().length : 0, video: s ? s.getVideoTracks().length : 0, w: r.videoWidth, h: r.videoHeight }; };
</script>`;
const server = createServer((req, res) => { res.setHeader("content-type", "text/html"); res.end(html); }).listen(0);
const port = server.address().port;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ["--no-sandbox", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--allow-loopback-in-peer-connection", "--autoplay-policy=no-user-gesture-required"] });
const ok = (n, c, d = "") => { if (!c) process.exitCode = 1; console.log(c ? "PASS" : "FAIL", n, d); };

async function scenario(media, denyCaller = false) {
  const ctx = await browser.newContext({ permissions: ["camera", "microphone"] });
  const [a, b] = [await ctx.newPage(), await ctx.newPage()];
  await a.goto(`http://localhost:${port}/`); await b.goto(`http://localhost:${port}/`);
  const toB = []; let bReady = false;
  await a.exposeFunction("__send", async (kind, payload) => { if (bReady) await b.evaluate(([k, p]) => window.recv(k, p), [kind, payload]); else toB.push([kind, payload]); });
  await b.exposeFunction("__send", async (kind, payload) => { await a.evaluate(([k, p]) => window.recv(k, p), [kind, payload]); });
  const started = await a.evaluate(([m, d]) => window.setup("caller", m, d), [media, denyCaller]);
  if (denyCaller) { const info = await a.evaluate(() => window.info()); await ctx.close(); return { started, info }; }
  // The callee only starts after "accept", so the caller's offer and early ICE wait in the queue first.
  await new Promise((r) => setTimeout(r, 500));
  await b.evaluate(([m]) => window.setup("callee", m, false), [media]);
  bReady = true;
  for (const [k, p] of toB.splice(0)) await b.evaluate(([kk, pp]) => window.recv(kk, pp), [k, p]);
  const deadline = Date.now() + 20000; let ia, ib;
  while (Date.now() < deadline) { [ia, ib] = await Promise.all([a.evaluate(() => window.info()), b.evaluate(() => window.info())]); if (ia.phases.includes("connected") && ib.phases.includes("connected") && (media === "audio" || (ia.w > 0 && ib.w > 0))) break; await new Promise((r) => setTimeout(r, 300)); }
  // mute and camera toggle act on the real local tracks
  const toggles = await a.evaluate(() => { window.engine.setMuted(true); window.engine.setCameraOff(true); const s = document.getElementById("local").srcObject; return { audioEnabled: s.getAudioTracks()[0].enabled, videoEnabled: s.getVideoTracks()[0]?.enabled ?? null }; });
  await a.evaluate(() => window.engine.close());
  const stopped = await a.evaluate(() => document.getElementById("local").srcObject.getTracks().every((t) => t.readyState === "ended"));
  await ctx.close();
  return { ia, ib, toggles, stopped, queued: toB.length };
}

const v = await scenario("video");
ok("görüntülü: iki taraf da bağlandı", v.ia.phases.includes("connected") && v.ib.phases.includes("connected"), JSON.stringify(v.ia.phases));
ok("görüntülü: karşı taraftan ses+video geliyor", v.ia.audio === 1 && v.ia.video === 1 && v.ib.audio === 1 && v.ib.video === 1);
ok("görüntülü: karşı videonun gerçek kare boyutu var", v.ia.w > 0 && v.ib.w > 0, `${v.ia.w}x${v.ia.h} / ${v.ib.w}x${v.ib.h}`);
ok("sessize alma ve kamerayı kapatma", v.toggles.audioEnabled === false && v.toggles.videoEnabled === false);
ok("kapatınca yerel kamera/mikrofon durur", v.stopped);
const au = await scenario("audio");
ok("sesli: bağlandı, yalnızca ses akışı var", au.ia.phases.includes("connected") && au.ib.phases.includes("connected") && au.ia.audio === 1 && au.ia.video === 0 && au.ib.video === 0, JSON.stringify(au.ia));
const denied = await scenario("video", true);
ok("izin verilmezse anlaşılır hata", denied.started === false && denied.info.phases.some((p) => p.startsWith("failed:Mikrofon veya kamera izni verilmedi")), JSON.stringify(denied.info.phases));
await browser.close(); server.close();
process.exit(process.exitCode ?? 0);
