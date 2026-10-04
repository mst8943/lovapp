"use client";

import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import { FormEvent, useState } from "react";
import { Brand } from "@/components/brand";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const client = createClient();
    if (!client) return setNote("Demo modu açık. Canlı bağlantıda sıfırlama bağlantısı e-posta adresine gönderilecek.");
    setBusy(true);
    try {
      const response = await fetch("/api/auth/recovery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: "forgot_password", email }) });
      setNote(response.ok ? "Bu adres kayıtlıysa şifre sıfırlama bağlantısı gönderildi." : "İşlem şu anda tamamlanamadı. Birkaç dakika sonra tekrar dene.");
    } catch {
      setNote("İşlem şu anda tamamlanamadı. Birkaç dakika sonra tekrar dene.");
    } finally {
      setBusy(false);
    }
  };

  return <main className="login-stage"><section className="login-card compact-auth"><Brand /><small className="eyebrow">Hesabına dön</small><h1>Yeni bir<br /><em>anahtar.</em></h1><p>Hesabında kayıtlı e-posta adresini yaz. Güvenli bağlantı kısa süreli ve tek kullanımlık olacak.</p><form onSubmit={submit}><label className="field"><span>E-posta</span><input required autoComplete="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="sen@ornek.com" /></label><button className="flow-next" disabled={busy}>{busy ? "Gönderiliyor…" : "Sıfırlama bağlantısı gönder"}<Mail size={16} /></button></form>{note ? <div className="login-note" role="status">{note}</div> : null}<Link href="/login" className="demo-link"><ArrowLeft size={15} /> Girişe dön</Link></section></main>;
}
