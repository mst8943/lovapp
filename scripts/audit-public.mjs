import { chromium } from "playwright-core";

const baseUrl = process.argv[2] ?? "http://127.0.0.1:3000";
const browser = await chromium.launch({
  executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const events = [];
page.on("pageerror", (error) => events.push(`pageerror:${error.message}`));
page.on("requestfailed", (request) => {
  if (!request.url().includes("_rsc=")) events.push(`requestfailed:${request.url()}:${request.failure()?.errorText}`);
});

const blogResponse = await page.goto(`${baseUrl}/blog`, { waitUntil: "networkidle", timeout: 60_000 });
const blog = await page.evaluate(() => ({
  title: document.title,
  description: document.querySelector('meta[name="description"]')?.getAttribute("content") ?? null,
  canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? null,
  jsonLd: Boolean(document.querySelector('script[type="application/ld+json"]')),
  heading: document.querySelector("h1")?.textContent?.trim() ?? null,
  brokenImages: Array.from(document.images).filter((image) => image.complete && image.naturalWidth === 0).map((image) => image.currentSrc || image.src),
}));

const downloadResponse = await page.goto(`${baseUrl}/download`, { waitUntil: "networkidle", timeout: 60_000 });
const download = await page.evaluate(() => ({
  apkHref: document.querySelector('a[href^="/api/download/android?"]')?.getAttribute("href") ?? null,
  packageVisible: document.body.textContent?.includes("tr.com.lovask.app") ?? false,
  brokenImages: Array.from(document.images).filter((image) => image.complete && image.naturalWidth === 0).map((image) => image.currentSrc || image.src),
}));

const [robotsResponse, sitemapResponse, manifestResponse, apkResponse] = await Promise.all([
  page.request.get(`${baseUrl}/robots.txt`),
  page.request.get(`${baseUrl}/sitemap.xml`),
  page.request.get(`${baseUrl}/manifest.webmanifest`),
  page.request.head(`${baseUrl}/lovask.apk`),
]);
const robots = await robotsResponse.text();
const sitemap = await sitemapResponse.text();
const manifest = await manifestResponse.json();
const apkHeaders = apkResponse.headers();
let canonicalValid = false;
try {
  const canonical = new URL(blog.canonical);
  canonicalValid = ["http:", "https:"].includes(canonical.protocol) && canonical.pathname === "/blog";
} catch { /* reported as a failed canonical check below */ }
const checks = {
  statuses: blogResponse?.status() === 200 && downloadResponse?.status() === 200
    && robotsResponse.status() === 200 && sitemapResponse.status() === 200
    && manifestResponse.status() === 200 && apkResponse.status() === 200,
  metadata: Boolean(blog.title && blog.description && blog.heading && blog.jsonLd),
  canonical: canonicalValid,
  robotsSitemap: robots.includes("sitemap.xml"),
  sitemapBlog: sitemap.includes("/blog"),
  images: blog.brokenImages.length === 0 && download.brokenImages.length === 0,
  downloadLink: download.apkHref === "/api/download/android?utm_source=website-download" && download.packageVisible,
  manifest: typeof manifest.name === "string" && manifest.name.startsWith("Lovask") && manifest.display === "standalone",
  apkType: apkHeaders["content-type"] === "application/vnd.android.package-archive",
};
const pass = Object.values(checks).every(Boolean) && events.length === 0;
console.log(JSON.stringify({ baseUrl, pass, checks, blog, download, manifest: { name: manifest.name, display: manifest.display, startUrl: manifest.start_url }, apk: { status: apkResponse.status(), contentType: apkHeaders["content-type"], contentLength: apkHeaders["content-length"] }, events }, null, 2));
await browser.close();
if (!pass) process.exitCode = 1;
