import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Check, ShieldCheck, Sparkles, Users } from "lucide-react";
import { Brand } from "@/components/brand";
import { FoundingCampaignClient } from "@/components/founding-campaign-client";
import { loadOpenRegistration } from "@/lib/registration-settings";
import { createAdminClient } from "@/lib/supabase/admin";
import "./founding.css";

export const metadata: Metadata = { title: "İstanbul Kurucu Üyeleri", description: "Lovask'ın İstanbul'daki ilk 200 kurucu üyesi arasına katılmak için başvur." };
export const dynamic = "force-dynamic";

export default async function FoundingMemberPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [raw, openRegistration] = await Promise.all([searchParams, loadOpenRegistration()]);
  if (openRegistration) redirect("/login?mode=register");
  const params = Object.fromEntries(Object.entries(raw).flatMap(([key, value]) => typeof value === "string" ? [[key, value.slice(0, 200)]] : []));
  const admin = createAdminClient();
  const { data: campaign } = admin ? await admin.from("growth_campaigns").select("id,member_limit").eq("slug", "istanbul-kurucu-200").maybeSingle() : { data: null };
  const { count } = admin && campaign ? await admin.from("campaign_members").select("id", { count: "exact", head: true }).eq("campaign_id", campaign.id) : { count: 0 };
  const limit = campaign?.member_limit ?? 200;
  const joined = Math.min(count ?? 0, limit);
  return <main className="founding-page">
    <nav><Brand/><Link href="/login">Giriş yap</Link></nav>
    <section className="founding-hero">
      <div className="founding-copy">
        <span className="founding-kicker"><Sparkles size={14}/> İstanbul · İlk 200 kişi</span>
        <h1>Bir uygulamaya değil,<br/><em>kurucu çevreye</em> katıl.</h1>
        <p>Lovask&apos;ın kültürünü şekillendirecek İstanbul&apos;daki ilk üyeleri seçiyoruz. Daha az profil, daha açık niyet ve özenli bir topluluk.</p>
        <FoundingCampaignClient params={params}/>
        <small>Başvuru ücretsizdir · 18+ · Kontenjan onay ve profil tamamlamayla kesinleşir</small>
      </div>
      <aside className="founding-ledger">
        <header><span>Kurucu üye defteri</span><b>{String(joined).padStart(3,"0")} / {limit}</b></header>
        <div className="founding-progress"><i style={{ width: `${Math.max(2, joined / limit * 100)}%` }}/></div>
        <ol>{["Başvurun incelenir", "Uygunsan kişisel davet gelir", "Profilini tamamlayınca yerin kesinleşir"].map((item, index) => <li key={item}><b>{index + 1}</b><span>{item}</span></li>)}</ol>
        <div className="founding-seal"><ShieldCheck/><span><strong>30 gün Noir</strong>Kurucu profilini tamamlayan ilk 200 üyeye</span></div>
      </aside>
    </section>
    <section className="founding-benefits">
      <article><Users/><h2>Küçük ve seçilmiş</h2><p>Kalabalık yerine niyeti ve emeği olan bir başlangıç topluluğu.</p></article>
      <article><Check/><h2>Gerçek niyetler</h2><p>Profilde ne aradığını açıkça anlatan, özenli üyelik deneyimi.</p></article>
      <article><Sparkles/><h2>Kurucu ayrıcalığı</h2><p>İlk 200 tamamlanmış profile 30 günlük Noir erişimi.</p></article>
    </section>
    <section className="founding-referral"><span>Bir arkadaşınla gel</span><h2>Davet ettiğin kişi profilini tamamlarsa ikiniz de 7 gün Noir kazanırsınız.</h2><p>Kendi davet bağlantın üyeliğin tamamlandıktan sonra profil ekranında açılır. Ödül otomatik ve kişi başına tek sefer uygulanır.</p></section>
    <footer><Brand/><div><Link href="/privacy">Gizlilik</Link><Link href="/terms">Kullanım koşulları</Link><Link href="/community-guidelines">Topluluk ilkeleri</Link></div></footer>
  </main>;
}
