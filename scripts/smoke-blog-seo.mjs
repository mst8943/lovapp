import { chromium } from "playwright-core";

const browser = await chromium.launch({ executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const session = await page.context().newCDPSession(page);
await session.send("Network.setCacheDisabled", { cacheDisabled: true });
const errors = [];
page.on("pageerror", (error) => errors.push(`pageerror:${error.message}`));
page.on("console", (message) => { if (message.type() === "error") errors.push(`console:${message.text()}`); });

const blogResponse = await page.goto("http://127.0.0.1:3000/blog", { waitUntil: "networkidle", timeout: 60000 });
const blog = await page.evaluate(() => ({ title: document.title, description: document.querySelector('meta[name="description"]')?.getAttribute("content"), canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href"), jsonLd: Boolean(document.querySelector('script[type="application/ld+json"]')), heading: document.querySelector("h1")?.textContent }));
const robots = await page.request.get("http://127.0.0.1:3000/robots.txt");
const sitemap = await page.request.get("http://127.0.0.1:3000/sitemap.xml");
await page.goto("http://127.0.0.1:3000", { waitUntil: "networkidle", timeout: 60000 });
const landingImages = await page.evaluate(() => performance.getEntriesByType("resource").filter((entry) => entry.initiatorType === "img").map((entry) => ({ name: new URL(entry.name).pathname, bytes: entry.encodedBodySize })));

console.log(JSON.stringify({ status: blogResponse?.status(), blog, robots: { status: robots.status(), hasSitemap: (await robots.text()).includes("sitemap.xml") }, sitemap: { status: sitemap.status(), hasBlog: (await sitemap.text()).includes("/blog") }, landingImages, errors }, null, 2));
await browser.close();
