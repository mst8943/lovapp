import type { MetadataRoute } from "next";
import { getPublishedPosts } from "@/lib/blog";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://lovask.com.tr";
export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await getPublishedPosts();
  return [{ url: siteUrl, lastModified: new Date("2026-08-11"), changeFrequency: "monthly", priority: 1 }, { url: `${siteUrl}/blog`, lastModified: posts[0]?.updated_at ?? new Date("2026-08-11"), changeFrequency: "weekly", priority: .8 }, { url: `${siteUrl}/sss`, lastModified: new Date("2026-10-08"), changeFrequency: "monthly" as const, priority: .6 }, { url: `${siteUrl}/guvenlik-ipuclari`, lastModified: new Date("2026-10-08"), changeFrequency: "monthly" as const, priority: .6 }, ...posts.map((post) => ({ url: `${siteUrl}/blog/${post.slug}`, lastModified: post.updated_at, changeFrequency: "monthly" as const, priority: .7 }))];
}
