import type { Metadata, Viewport } from "next";
import "@fontsource-variable/manrope";
import "./globals.css";
import "./site-theme.css";
import { PwaRegister } from "@/components/pwa-register";

const supabaseOrigin = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin : null;
  } catch {
    return null;
  }
})();

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://lovask.com.tr"),
  title: { default: "Lovask — Tesadüften fazlası", template: "%s · Lovask" },
  description: "Niyetlerin görünür, sohbetlerin gerçek olduğu yeni nesil eşleşme deneyimi.",
  applicationName: "Lovask",
  category: "social",
  keywords: ["tanışma", "ilişki", "çevrim içi flört", "güvenli tanışma", "Lovask"],
  openGraph: {
    type: "website",
    locale: "tr_TR",
    siteName: "Lovask",
    title: "Lovask — Tesadüften fazlası",
    description: "Niyetlerin görünür, sohbetlerin gerçek olduğu yeni nesil eşleşme deneyimi.",
    images: [{ url: "/logo.png", alt: "Lovask" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Lovask — Tesadüften fazlası",
    description: "Niyetlerin görünür, sohbetlerin gerçek olduğu yeni nesil eşleşme deneyimi.",
    images: ["/logo.png"],
  },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Lovask" },
  formatDetection: { telephone: false },
};

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
        {supabaseOrigin ? <link rel="preconnect" href={supabaseOrigin} /> : null}
        {supabaseOrigin ? <link rel="dns-prefetch" href={supabaseOrigin} /> : null}
      </head>
      <body className="lovask-light" suppressHydrationWarning>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
