import Link from "next/link";
import { ArrowRight, Clock3, Mail } from "lucide-react";
import { Brand } from "@/components/brand";
import { verifyAccessGrant } from "@/lib/membership-access";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function MemberAccessPage({ searchParams }: { searchParams: Promise<{ grant?: string | string[]; error?: string | string[] }> }) {
  const params = await searchParams;
  const grant = typeof params.grant === "string" ? params.grant : "";
  const error = typeof params.error === "string" ? params.error : "";
  const verified = verifyAccessGrant(grant);
  const admin = verified ? createAdminClient() : null;
  const { data: application } = admin && verified
    ? await admin.from("membership_applications").select("email,status").eq("id", verified.applicationId).maybeSingle()
    : { data: null };
  const valid = Boolean(application && ["approved", "invited"].includes(application.status));

  return <main className="login-stage"><section className="login-card compact-auth"><Brand/><small className="eyebrow">Kişisel davetin</small>{valid ? <><h1>Hesabını<br/><em>güvenle aç.</em></h1><p><strong>{maskEmail(application!.email)}</strong> adresine bağlı hesabın hazır. Aşağıdaki düğmeye bastığında sana özel, taze bir şifre oturumu oluşturulacak.</p><div className="login-note"><Clock3 size={16}/> Bu davet e-postanın gönderildiği andan itibaren 24 saat geçerlidir.</div>{error ? <div className="login-note" role="alert">Güvenli bağlantı oluşturulamadı. Biraz sonra tekrar deneyebilirsin.</div> : null}<form action="/api/member-access" method="post"><input type="hidden" name="grant" value={grant}/><button className="flow-next" type="submit">Şifremi belirlemeye devam et <ArrowRight size={16}/></button></form></> : <><h1>Yeni bir<br/><em>bağlantı iste.</em></h1><p>Bu davet bağlantısı kullanılamıyor veya 24 saatlik süresi dolmuş.</p><Link href="/reset-password" className="flow-next auth-link-button">Yeni bağlantı gönder <Mail size={16}/></Link><Link href="/login" className="demo-link">Giriş ekranına dön</Link></>}</section></main>;
}

function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  return `${local.slice(0, 2)}${"•".repeat(Math.max(2, Math.min(6, local.length - 2)))}@${domain}`;
}
