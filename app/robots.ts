import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://lovask.com.tr";

export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: ["/", "/blog", "/blog/"], disallow: ["/admin/", "/api/", "/demo", "/login", "/noir", "/onboarding", "/profile/", "/reset-password", "/update-password"] }, sitemap: `${siteUrl}/sitemap.xml`, host: siteUrl };
}
