import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal-document";
import { FAQ } from "@/lib/faq";
import "../legal.css";

export const metadata: Metadata = { title: "Sık Sorulan Sorular", description: "Üyelik, eşleşme, Noir, güvenlik ve hesap yönetimi hakkında sık sorulan soruların yanıtları." };

export default function FaqPage() {
  const jsonLd = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.map((item) => ({ "@type": "Question", name: item.q, acceptedAnswer: { "@type": "Answer", text: item.a } })) };
  return <LegalDocument eyebrow="Yardım" title="Sık sorulan sorular" updated="8 Ekim 2026">
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    {FAQ.map((item) => <section key={item.q}><h2>{item.q}</h2><p>{item.a}</p></section>)}
  </LegalDocument>;
}
