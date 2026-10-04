"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Send,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { FormEvent, Suspense, useState } from "react";
import { TurnstileChallenge } from "@/components/turnstile-challenge";
import { safeInternalPath } from "@/lib/navigation";
import { turkishCities } from "@/lib/turkish-cities";
import { createClient } from "@/lib/supabase/client";
import { useGoogleAuthEnabled, useOpenRegistration } from "./registration-mode-context";
import "./application.css";

type Mode = "login" | "apply" | "register";
type ApplicationResult = { received: boolean };

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const openRegistration = useOpenRegistration();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState(() => {
    const error = searchParams.get("error");
    return error ? callbackErrorMessage(error) : "";
  });
  const [application, setApplication] = useState<ApplicationResult | null>(
    null,
  );
  const [applicationChallenge, setApplicationChallenge] = useState("");
  const [applicationChallengeReset, setApplicationChallengeReset] = useState(0);
  const [registrationSent, setRegistrationSent] = useState("");
  const googleEnabled = useGoogleAuthEnabled();

  const destination = () =>
    safeInternalPath(
      new URLSearchParams(window.location.search).get("next"),
      "/",
    );
  const callback = (flow: "login" | "register") => {
    const url = new URL("/auth/callback", window.location.origin);
    url.searchParams.set(
      "next",
      flow === "register" ? "/onboarding" : destination(),
    );
    url.searchParams.set("flow", flow);
    return url.toString();
  };

  const selectMode = (next: Mode) => {
    setMode(next);
    setNote("");
    setApplication(null);
    setRegistrationSent("");
  };

  const googleAuth = async (flow: "login" | "register") => {
    if (!googleEnabled)
      return setNote(
        "Google girişi henüz etkin değil. Davet aldığın e-posta ve şifreyle giriş yapabilirsin.",
      );
    const client = createClient();
    if (!client) return setNote("Giriş sistemi şu anda kullanılamıyor.");
    setBusy(true);
    setNote("");
    const { error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callback(flow),
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) {
      setNote(authErrorMessage(error.code, "google"));
      setBusy(false);
    }
  };

  const emailRegistration = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setNote("");
    const values = new FormData(event.currentTarget);
    const email = String(values.get("email") ?? "");
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: values.get("fullName"),
          email,
          password: values.get("password"),
          passwordConfirmation: values.get("passwordConfirmation"),
          termsAccepted: values.get("termsAccepted") === "on",
          privacyAccepted: values.get("privacyAccepted") === "on",
          marketingConsent: values.get("marketingConsent") === "on",
        }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        requiresEmailConfirmation?: boolean;
        code?: string;
        error?: string;
      };
      if (!response.ok || !result.ok)
        return setNote(registrationErrorMessage(result.code, result.error));
      if (result.requiresEmailConfirmation) setRegistrationSent(email);
      else router.push("/onboarding");
    } catch {
      setNote("Kayıt sistemiyle bağlantı kurulamadı. Biraz sonra tekrar dene.");
    } finally {
      setBusy(false);
    }
  };

  const emailLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setNote("");
    try {
      const response = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "login", email, password }),
      });
      const result = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        code?: string;
        error?: string;
      };
      if (!response.ok || !result.ok)
        return setNote(
          result.code === "validation_failed"
            ? (result.error ?? "E-posta veya şifreyi kontrol et.")
            : authErrorMessage(result.code, "login"),
        );
      window.location.assign(destination());
    } catch {
      setNote("Giriş sistemiyle bağlantı kurulamadı. Biraz sonra tekrar dene.");
    } finally {
      setBusy(false);
    }
  };

  const submitApplication = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setNote("");
    const values = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: values.get("fullName"),
          email: values.get("email"),
          instagramUsername: values.get("instagramUsername"),
          phone: values.get("phone"),
          notificationConsent: values.get("notificationConsent") === "on",
          occupation: values.get("occupation"),
          industry: values.get("industry"),
          city: values.get("city"),
          applicationNote: values.get("applicationNote"),
          marketingConsent: values.get("marketingConsent") === "on",
          privacyNoticeAccepted: values.get("privacyNoticeAccepted") === "on",
          companyWebsite: values.get("companyWebsite"),
          turnstileToken: applicationChallenge,
        }),
      });
      const body = (await response
        .json()
        .catch(() => ({}))) as ApplicationResult & { error?: string };
      if (!response.ok) return setNote(body.error ?? "Başvuru gönderilemedi.");
      setApplication(body);
    } catch {
      setNote(
        "Başvuru sistemiyle bağlantı kurulamadı. Biraz sonra tekrar dene.",
      );
    } finally {
      setBusy(false);
      setApplicationChallenge("");
      setApplicationChallengeReset((value) => value + 1);
    }
  };

  return (
    <main className="login-stage membership-gate">
      <section
        className={
          mode === "apply" ? "login-card application-card" : "login-card"
        }
      >
        <Image
          className="login-wordmark"
          src="/lovask-discovery-logo.png"
          alt="Lovask"
          width={150}
          height={39}
          priority
        />
        <div className="login-hero">
          <small className="eyebrow">Bir karşılaşma yeter</small>
          <h1>
            Aynı anda.
            <br />
            <em>Aynı histe.</em>
          </h1>
          <p>Kendin olduğun yerde, sana iyi gelen biriyle tanış.</p>
        </div>
        <div className="auth-mode" role="tablist" aria-label="Üyelik işlemi">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "login"}
            className={mode === "login" ? "active" : ""}
            onClick={() => selectMode("login")}
          >
            Giriş yap
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === (openRegistration ? "register" : "apply")}
            className={
              mode === (openRegistration ? "register" : "apply") ? "active" : ""
            }
            onClick={() => selectMode(openRegistration ? "register" : "apply")}
          >
            {openRegistration ? "Kayıt ol" : "Başvuru yap"}
          </button>
        </div>

        {mode === "login" ? (
          <>
            <button
              className={
                googleEnabled ? "google-login" : "google-login unavailable"
              }
              type="button"
              onClick={() => void googleAuth("login")}
              disabled={busy}
              aria-disabled={!googleEnabled}
            >
              <span className="google-mark">G</span>{" "}
              {googleEnabled
                ? "Google ile giriş yap"
                : "Google girişi · yakında"}
            </button>
            <div className="or">
              <span /> veya e-posta ile <span />
            </div>
            <form onSubmit={emailLogin}>
              <label className="field">
                <span>E-posta</span>
                <input
                  required
                  autoComplete="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="sen@ornek.com"
                />
              </label>
              <label className="field password-field">
                <span>Şifre</span>
                <input
                  required
                  autoComplete="current-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Şifren"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </label>
              <button className="flow-next" disabled={busy}>
                {busy ? "Giriş kontrol ediliyor…" : "Giriş yap"}
                <LockKeyhole size={16} />
              </button>
            </form>
            <Link href="/reset-password" className="forgot-link">
              Şifremi unuttum
            </Link>
            {note ? (
              <div className="login-note" role="status">
                {note}
              </div>
            ) : null}
            <Link href="/demo" className="demo-link">
              Demo olarak keşfet <ArrowRight size={15} />
            </Link>
          </>
        ) : mode === "register" ? (
          registrationSent ? (
            <RegistrationSuccess email={registrationSent} />
          ) : (
            <>
              <button
                className={
                  googleEnabled ? "google-login" : "google-login unavailable"
                }
                type="button"
                onClick={() => void googleAuth("register")}
                disabled={busy}
                aria-disabled={!googleEnabled}
              >
                <span className="google-mark">G</span>{" "}
                {googleEnabled ? "Google ile kaydol" : "Google kaydı · yakında"}
              </button>
              <div className="or">
                <span /> veya e-posta ile <span />
              </div>
              <form className="registration-form" onSubmit={emailRegistration}>
                <label className="field">
                  <span>Ad soyad</span>
                  <input
                    name="fullName"
                    required
                    minLength={3}
                    maxLength={120}
                    autoComplete="name"
                    placeholder="Adın ve soyadın"
                  />
                </label>
                <label className="field">
                  <span>E-posta</span>
                  <input
                    name="email"
                    required
                    type="email"
                    maxLength={254}
                    autoComplete="email"
                    placeholder="sen@ornek.com"
                  />
                </label>
                <label className="field password-field">
                  <span>Şifre</span>
                  <input
                    name="password"
                    required
                    minLength={6}
                    maxLength={128}
                    autoComplete="new-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="En az 6 karakter"
                  />
                  <button
                    type="button"
                    aria-label={
                      showPassword ? "Şifreyi gizle" : "Şifreyi göster"
                    }
                    onClick={() => setShowPassword((value) => !value)}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </label>
                <label className="field">
                  <span>Şifre tekrar</span>
                  <input
                    name="passwordConfirmation"
                    required
                    minLength={6}
                    maxLength={128}
                    autoComplete="new-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Şifreni yeniden yaz"
                  />
                </label>
                <label className="application-consent">
                  <input name="termsAccepted" type="checkbox" required />
                  <span>
                    <Link href="/terms" target="_blank">
                      Kullanım Koşulları
                    </Link>
                    &apos;nı kabul ediyorum.
                  </span>
                </label>
                <label className="application-consent">
                  <input name="privacyAccepted" type="checkbox" required />
                  <span>
                    <Link href="/privacy" target="_blank">
                      Gizlilik ve Aydınlatma Metni
                    </Link>
                    &apos;ni okudum.
                  </span>
                </label>
                <label className="application-consent optional">
                  <input name="marketingConsent" type="checkbox" />
                  <span>
                    Ürün haberleri ve teklifleri almak istiyorum.{" "}
                    <b>Opsiyonel</b>
                  </span>
                </label>
                <button className="flow-next" disabled={busy}>
                  {busy ? "Hesabın hazırlanıyor…" : "Hesabımı oluştur"}
                  <UserPlus size={16} />
                </button>
              </form>
              {note ? (
                <div className="login-note" role="status">
                  {note}
                </div>
              ) : null}
            </>
          )
        ) : application ? (
          <ApplicationSuccess result={application} />
        ) : (
          <>
            <form className="application-form" onSubmit={submitApplication}>
              <div className="application-fields">
                <label className="field">
                  <span>Ad soyad</span>
                  <input
                    name="fullName"
                    required
                    minLength={3}
                    maxLength={120}
                    autoComplete="name"
                  />
                </label>
                <label className="field">
                  <span>E-posta</span>
                  <input
                    name="email"
                    required
                    type="email"
                    maxLength={254}
                    autoComplete="email"
                  />
                </label>
                <label className="field">
                  <span>Cep telefonu</span>
                  <input
                    name="phone"
                    required
                    type="tel"
                    minLength={10}
                    maxLength={24}
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="05xx xxx xx xx"
                  />
                </label>
                <label className="field">
                  <span>
                    Instagram kullanıcı adı <i>Opsiyonel</i>
                  </span>
                  <div className="instagram-field">
                    <b>@</b>
                    <input
                      name="instagramUsername"
                      maxLength={31}
                      autoComplete="off"
                      placeholder="kullaniciadi"
                    />
                  </div>
                </label>
                <label className="field">
                  <span>Meslek</span>
                  <input
                    name="occupation"
                    required
                    minLength={2}
                    maxLength={120}
                    autoComplete="organization-title"
                    placeholder="Örn. Kurucu ortak"
                  />
                </label>
                <label className="field">
                  <span>Sektör</span>
                  <input
                    name="industry"
                    required
                    minLength={2}
                    maxLength={120}
                    placeholder="Örn. Finans teknolojileri"
                  />
                </label>
                <label className="field">
                  <span>
                    Şehir <i>Opsiyonel</i>
                  </span>
                  <select name="city" defaultValue="">
                    <option value="">Şehir seç</option>
                    {turkishCities.map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="field application-note">
                <span>
                  Kendini kısaca anlat <i>Opsiyonel</i>
                </span>
                <textarea
                  name="applicationNote"
                  minLength={10}
                  maxLength={800}
                  placeholder="Lovask topluluğuna neden katılmak istediğini paylaş."
                />
              </label>
              <input
                className="application-honeypot"
                name="companyWebsite"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
              />
              <label className="application-consent">
                <input name="privacyNoticeAccepted" type="checkbox" required />
                <span>
                  Başvuru bilgilerimin üyelik değerlendirmesi amacıyla
                  işleneceğine ilişkin aydınlatmayı okudum.
                </span>
              </label>
              <label className="application-consent">
                <input name="notificationConsent" type="checkbox" required />
                <span>
                  Başvuru durumum ve kişisel davetiyem hakkında e-posta ve SMS
                  ile bilgilendirilmek istiyorum.
                </span>
              </label>
              <label className="application-consent optional">
                <input name="marketingConsent" type="checkbox" />
                <span>
                  Lovask&apos;tan davet ve üyelik teklifleri hakkında ileti
                  almak istiyorum. <b>Opsiyonel</b>
                </span>
              </label>
              <TurnstileChallenge
                action="membership_application"
                resetKey={applicationChallengeReset}
                onToken={setApplicationChallenge}
              />
              <button
                className="flow-next"
                disabled={
                  busy ||
                  (Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) &&
                    !applicationChallenge)
                }
              >
                {busy ? "Kurula iletiliyor…" : "Başvuruyu kurula ilet"}
                <Send size={16} />
              </button>
            </form>
            {note ? (
              <div className="login-note" role="status">
                {note}
              </div>
            ) : null}
          </>
        )}
        <small className="legal">
          {openRegistration
            ? "Lovask yalnızca 18+ içindir. Kayıt olarak kullanım ve gizlilik koşullarını kabul edersin."
            : "Lovask yalnızca 18+ içindir. Başvuru yapmak üyeliğin kabul edildiği anlamına gelmez."}
        </small>
        <Link className="login-android-link" href="/download">
          Daha rahat bir deneyim için Android uygulamamızı indir →
        </Link>
      </section>
    </main>
  );
}

function RegistrationSuccess({ email }: { email: string }) {
  return (
    <section className="application-success registration-success" role="status">
      <span>
        <ShieldCheck size={27} />
      </span>
      <small>E-postanı doğrula</small>
      <h2>Son bir adım kaldı.</h2>
      <p>
        <strong>{email}</strong> adresine gönderdiğimiz bağlantıyı aç. Ardından
        profilini oluşturmaya başlayabilirsin.
      </p>
    </section>
  );
}

function ApplicationSuccess({ result }: { result: ApplicationResult }) {
  return (
    <section className="application-success" role="status">
      <span>
        <LockKeyhole size={27} />
      </span>
      <small>Başvuru alındı</small>
      <h2>Kurul değerlendirmesi başladı.</h2>
      <p>
        Başvuru bilgilerin e-posta ve SMS ile gönderildi. Profilin uygun
        bulunursa kişisel davetiyeni alacaksın.
      </p>
      <div>
        <ShieldCheck size={17} />
        <span>
          Başvuru kodu yalnızca verdiğin iletişim adreslerine gönderilir.
        </span>
      </div>
      <small>
        {result.received ? "Başvurun güvenli biçimde işleme alındı." : null}
      </small>
    </section>
  );
}

function authErrorMessage(code: string | undefined, mode: "login" | "google") {
  if (code === "invalid_credentials") return "E-posta veya şifre eşleşmedi.";
  if (code === "email_not_confirmed")
    return "Bu hesabın e-posta onayı tamamlanmamış.";
  if (
    code === "over_request_rate_limit" ||
    code === "over_email_send_rate_limit"
  )
    return "Çok fazla deneme yapıldı. Birkaç dakika sonra tekrar dene.";
  if (code === "provider_disabled" || code === "email_provider_disabled")
    return mode === "google"
      ? "Google girişi henüz etkin değil."
      : "E-posta ile giriş şu anda kapalı.";
  if (code === "application_required")
    return "Bu e-posta için onaylanmış bir üyelik bulunamadı. Önce başvuru yapmalısın.";
  if (code === "auth_unavailable")
    return "Üyelik kontrolü şu anda yapılamıyor. Biraz sonra tekrar dene.";
  return mode === "login"
    ? "Giriş yapılamadı. Bilgilerini kontrol et."
    : "Google oturumu başlatılamadı.";
}

function callbackErrorMessage(code: string) {
  if (code === "application_required")
    return "Bu Google e-postası için onaylanmış bir üyelik bulunamadı. Önce başvuru yapmalısın.";
  if (code === "auth_unavailable")
    return "Üyelik kontrolü şu anda yapılamıyor. Biraz sonra tekrar dene.";
  if (code === "registration_closed")
    return "Standart kayıt şu anda kapalı. Üyelik için başvuru yapabilirsin.";
  return "Google oturumu açılamadı. Lütfen tekrar dene.";
}

function registrationErrorMessage(code?: string, fallback?: string) {
  if (code === "registration_closed")
    return "Standart kayıt şu anda kapalı. Sayfayı yenileyip başvuru yapabilirsin.";
  if (code === "account_exists")
    return "Bu e-postayla zaten bir hesap olabilir. Giriş yapmayı veya şifreni sıfırlamayı dene.";
  if (
    code === "over_request_rate_limit" ||
    code === "over_email_send_rate_limit"
  )
    return "Çok fazla deneme yapıldı. Birkaç dakika sonra tekrar dene.";
  return fallback ?? "Hesap oluşturulamadı. Bilgilerini kontrol et.";
}
