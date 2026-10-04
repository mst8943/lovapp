import Link from "next/link";
import { Brand } from "@/components/brand";

export function LegalDocument({ eyebrow, title, updated = "16 Ağustos 2026", children }: { eyebrow: string; title: string; updated?: string; children: React.ReactNode }) {
  return <main className="legal-page"><nav><Brand/><Link href="/">Ana sayfa</Link></nav><article><header><small>{eyebrow}</small><h1>{title}</h1><p>Son güncelleme: {updated}</p></header>{children}</article><footer><Link href="/privacy">Gizlilik</Link><Link href="/terms">Kullanım koşulları</Link><Link href="/community-guidelines">Topluluk ilkeleri</Link></footer></main>;
}
