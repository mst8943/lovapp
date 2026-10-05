import type { Metadata, Viewport } from "next";
import "@fontsource-variable/manrope";
import "./globals.css";
import "./site-theme.css";
import { PwaRegister } from "@/components/pwa-register";
import { readBrandSettings } from "@/lib/branding";

export async function generateMetadata(): Promise<Metadata> {
  const brand = await readBrandSettings();
  const title = `${brand.brand_name} — ${brand.tagline}`;
  return {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://lovask.com.tr"),
  title: { default: title, template: `%s · ${brand.brand_name}` },
  description: brand.tagline,
  applicationName: brand.brand_name,
  category: "social",
  keywords: ["tanışma", "ilişki", "çevrim içi flört", "güvenli tanışma", brand.brand_name],
  openGraph: {
    type: "website",
    locale: "tr_TR",
    siteName: brand.brand_name,
    title,
    description: brand.tagline,
    images: [{ url: brand.logo_url, alt: brand.brand_name }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description: brand.tagline,
    images: [brand.logo_url],
  },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: brand.brand_name },
  formatDetection: { telephone: false },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#fff8f5",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://jagqvyfnychnoxarebgv.supabase.co" />
        <link rel="dns-prefetch" href="https://jagqvyfnychnoxarebgv.supabase.co" />
      </head>
      <body className="lovask-light" suppressHydrationWarning>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
