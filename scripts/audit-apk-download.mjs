import { performance } from "node:perf_hooks";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:3000";
const runs = Number(process.argv[3] ?? 3);
const apkUrl = new URL("/lovask.apk", baseUrl);
const head = await fetch(apkUrl, { method: "HEAD", cache: "no-store" });
const expectedBytes = Number(head.headers.get("content-length") ?? 0);
const samples = [];

for (let index = 0; index < runs; index += 1) {
  const target = new URL(apkUrl);
  target.searchParams.set("speed-run", String(index + 1));
  const started = performance.now();
  const response = await fetch(target, { cache: "no-store" });
  const bytes = (await response.arrayBuffer()).byteLength;
  const durationMs = performance.now() - started;
  samples.push({
    run: index + 1,
    status: response.status,
    bytes,
    durationMs: Math.round(durationMs * 10) / 10,
    kilobytesPerSecond: Math.round((bytes / 1024) / Math.max(durationMs / 1000, .001)),
  });
}

const durations = samples.map((sample) => sample.durationMs).sort((a, b) => a - b);
const throughputs = samples.map((sample) => sample.kilobytesPerSecond).sort((a, b) => a - b);
const summary = {
  expectedBytes,
  durationP95Ms: durations[Math.ceil(durations.length * .95) - 1] ?? 0,
  minimumKilobytesPerSecond: throughputs[0] ?? 0,
};
const thresholds = {
  headers: head.ok && head.headers.get("content-type") === "application/vnd.android.package-archive",
  responses: samples.every((sample) => sample.status === 200 && sample.bytes > 0 && (!expectedBytes || sample.bytes === expectedBytes)),
  duration: summary.durationP95Ms <= 10_000,
  throughput: summary.minimumKilobytesPerSecond >= 128,
};
const pass = Object.values(thresholds).every(Boolean);
console.log(JSON.stringify({ baseUrl, runs, pass, thresholds, summary, samples }, null, 2));
if (!pass) process.exitCode = 1;
