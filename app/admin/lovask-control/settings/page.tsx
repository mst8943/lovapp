"use client";

import Image from "next/image";
import { FormEvent, useEffect, useState } from "react";
import { Save } from "lucide-react";
import { AdminResourceNav } from "@/components/admin-resource-nav";
import "../operations.css";
import "./settings.css";

type BrandSettings = { brand_name: string; tagline: string; support_email: string; logo_url: string };
type SetupCheck = { label: string; ready: boolean; detail: string };
type VerificationSettings = { emailEnabled: boolean; smsEnabled: boolean; providers: { email: boolean; sms: boolean }; providerValues: { resendFromEmail: string; resendFromName: string; netgsmUsercode: string; netgsmMsgheader: string; resendApiKeySet: boolean; netgsmPasswordSet: boolean; encryptionReady: boolean }; pending: Array<{ id: string; profile_id: string; selfieUrl: string | null; profileUrl: string | null; profiles: { display_name: string } | null }> };
const defaultBrandSettings: BrandSettings = { brand_name: "Lovask", tagline: "Tesadüften fazlası", support_email: "destek@example.com", logo_url: "/logo_l_extra_thick.png" };

export default function SettingsPage() {
  const [values, setValues] = useState<BrandSettings>(defaultBrandSettings);
  const [status, setStatus] = useState("Yükleniyor…");
  const [checks, setChecks] = useState<SetupCheck[]>([]);
  const [verification, setVerification] = useState<VerificationSettings | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/branding", { cache: "no-store" }).then((response) => response.json()),
      fetch("/api/admin/setup", { cache: "no-store" }).then((response) => response.json()),
      fetch("/api/admin/verification", { cache: "no-store" }).then((response) => response.json()),
    ]).then(([brand, setup, verificationData]) => {
      if (brand.brand_name) setValues(brand);
      setChecks(setup.checks ?? []);
      if (verificationData.providers) setVerification(verificationData);
      setStatus("");
    }).catch(() => setStatus("Ayarlar yüklenemedi."));
  }, []);

  const update = (key: keyof BrandSettings) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setValues((current) => ({ ...current, [key]: event.target.value }));
  };

  const saveVerification = async () => {
    if (!verification) return;
    const response = await fetch("/api/admin/verification", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "settings", emailEnabled: verification.emailEnabled, smsEnabled: verification.smsEnabled }) });
    const result = await response.json();
    setStatus(response.ok ? "Doğrulama ayarları kaydedildi." : result.error ?? "Ayarlar kaydedilemedi.");
  };
  const saveProvider = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const response = await fetch("/api/admin/verification", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "provider", ...Object.fromEntries(form) }) });
    const result = await response.json();
    if (!response.ok) return setStatus(result.error ?? "Sağlayıcı kaydedilemedi.");
    const refreshed = await fetch("/api/admin/verification", { cache: "no-store" }).then((r) => r.json());
    if (refreshed.providers) setVerification(refreshed);
    formElement.reset();
    setStatus("Sağlayıcı ayarları kaydedildi.");
  };
  const reviewSelfie = async (requestId: string, decision: "approved" | "rejected") => {
    const response = await fetch("/api/admin/verification", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "review", requestId, status: decision }) });
    const result = await response.json();
    if (!response.ok) return setStatus(result.error ?? "İstek incelenemedi.");
    setVerification((current) => current ? { ...current, pending: current.pending.filter((item) => item.id !== requestId) } : current);
    setStatus("Selfie incelemesi kaydedildi.");
  };
  const save = async (event: FormEvent) => {
    event.preventDefault();
    setStatus("Kaydediliyor…");
    const response = await fetch("/api/admin/branding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brandName: values.brand_name, tagline: values.tagline, supportEmail: values.support_email, logoUrl: values.logo_url }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setStatus(data.error ?? "Kaydedilemedi.");
    setValues(data);
    setStatus("Kaydedildi.");
  };

  return (
    <main className="ops-stage">
      <AdminResourceNav />
      <section className="ops-content brand-settings">
        <header><div><small>İlk kurulum</small><h1>Marka ve sistem ayarları</h1><p>Markanı buradan tanımla. Gizli anahtarlar sunucu ortamında kalır; aşağıdaki kontrol listesi eksikleri gösterir.</p></div></header>
        <section className="setup-checks">
          <h2>Kurulum kontrolü</h2>
          {checks.map((check) => <div className={check.ready ? "setup-check ready" : "setup-check"} key={check.label}><i>{check.ready ? "✓" : "!"}</i><div><strong>{check.label}</strong><small>{check.ready ? "Hazır" : `Eksik: ${check.detail}`}</small></div></div>)}
        </section>
        <form onSubmit={save}>
          <div className="brand-preview"><Image src={values.logo_url} alt="Logo önizlemesi" width={64} height={64} unoptimized /><div><small>Önizleme</small><strong>{values.brand_name || "Marka adı"}</strong><span>{values.tagline || "Kısa açıklama"}</span></div></div>
          <label>Marka adı<input value={values.brand_name} onChange={update("brand_name")} maxLength={80} required /></label>
          <label>Kısa açıklama<input value={values.tagline} onChange={update("tagline")} maxLength={160} required /></label>
          <label>Destek e-postası<input type="email" value={values.support_email} onChange={update("support_email")} required /></label>
          <label>Logo adresi<input value={values.logo_url} onChange={update("logo_url")} placeholder="/logo.png veya https://…" required /><small>Sunucudaki bir dosya yolu veya HTTPS adresi.</small></label>
          <footer><span role="status">{status}</span><button className="admin-primary" disabled={status === "Kaydediliyor…"}><Save size={16} /> Kaydet</button></footer>
        </form>
        <section className="setup-checks">
          <h2>Hesap doğrulama</h2>
          <p>SMS ve e-posta kodları başlangıçta kapalıdır. Sağlayıcı anahtarları sunucuda tutulur.</p>
          {verification ? <>
            <form onSubmit={saveProvider}>
              <h3>Sağlayıcı bilgileri</h3>
              <p>Gizli anahtarlar şifrelenerek saklanır ve bu ekranda geri gösterilmez. Sunucuda VERIFICATION_SETTINGS_KEY gereklidir.</p>
              <label>Resend API anahtarı<input name="resendApiKey" type="password" placeholder={verification.providerValues.resendApiKeySet ? "Kaydedilmiş · değiştirmek için yaz" : "re_…"} /></label>
              <label>Gönderici e-posta<input name="resendFromEmail" type="email" defaultValue={verification.providerValues.resendFromEmail} /></label>
              <label>Gönderici adı<input name="resendFromName" defaultValue={verification.providerValues.resendFromName} /></label>
              <label>Netgsm kullanıcı kodu<input name="netgsmUsercode" defaultValue={verification.providerValues.netgsmUsercode} /></label>
              <label>Netgsm şifresi<input name="netgsmPassword" type="password" placeholder={verification.providerValues.netgsmPasswordSet ? "Kaydedilmiş · değiştirmek için yaz" : ""} /></label>
              <label>Netgsm gönderici başlığı<input name="netgsmMsgheader" defaultValue={verification.providerValues.netgsmMsgheader} /></label>
              <button type="submit" className="admin-primary" disabled={!verification.providerValues.encryptionReady}>Sağlayıcıları kaydet</button>
            </form>
            <label><input type="checkbox" checked={verification.emailEnabled} disabled={!verification.providers.email} onChange={(event) => setVerification({ ...verification, emailEnabled: event.target.checked })} /> E-posta kodu {verification.providers.email ? "" : "· Resend ayarları eksik"}</label>
            <label><input type="checkbox" checked={verification.smsEnabled} disabled={!verification.providers.sms} onChange={(event) => setVerification({ ...verification, smsEnabled: event.target.checked })} /> SMS kodu {verification.providers.sms ? "" : "· Netgsm ayarları eksik"}</label>
            <button type="button" className="admin-primary" onClick={() => void saveVerification()}>Doğrulama ayarlarını kaydet</button>
            <h2>Bekleyen selfie incelemeleri</h2>
            {verification.pending.length ? verification.pending.map((item) => <div key={item.id} className="setup-check"><strong>{item.profiles?.display_name ?? item.profile_id}</strong><div style={{ display: "flex", gap: 12 }}>{item.profileUrl ? <Image src={item.profileUrl} alt="Profil fotoğrafı" width={100} height={100} unoptimized style={{ objectFit: "cover" }} /> : null}{item.selfieUrl ? <Image src={item.selfieUrl} alt="Doğrulama selfiesi" width={100} height={100} unoptimized style={{ objectFit: "cover" }} /> : null}</div><button type="button" onClick={() => void reviewSelfie(item.id, "approved")}>Onayla</button><button type="button" onClick={() => void reviewSelfie(item.id, "rejected")}>Reddet</button></div>) : <p>Bekleyen istek yok.</p>}
          </> : <p>Doğrulama ayarları yüklenemedi.</p>}
        </section>
      </section>
    </main>
  );
}
