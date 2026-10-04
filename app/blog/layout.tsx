import type { Metadata } from "next";
import "./blog.css";

export const metadata: Metadata = {
  title: { default: "Lovask Blog", template: "%s · Lovask Blog" },
  description: "Tanışma, iletişim, ilişki psikolojisi ve güvenli çevrim içi flört üzerine uzman görüşleri.",
  alternates: { canonical: "/blog" },
  openGraph: { type: "website", locale: "tr_TR", url: "/blog", siteName: "Lovask", title: "Lovask Blog", description: "Daha anlamlı tanışmalar ve daha güçlü iletişim için rehberler." },
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return children;
}
