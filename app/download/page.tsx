import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, Crown, Download, ShieldCheck, Smartphone, Sparkles, Zap } from "lucide-react";
import { Brand } from "@/components/brand";
import "./download.css";

export const metadata = {
  title: "Android APK İndir | Lovask",
  description: "Lovask Android uygulamasını doğrudan cihazınıza indirin. Hızlı, güvenli ve kesintisiz mobil eşleşme deneyimi.",
};

export default async function DownloadPage({ searchParams }: { searchParams: Promise<{ utm_source?: string }> }) {
  const { utm_source: rawSource } = await searchParams;
  const source = rawSource && /^[a-zA-Z0-9_-]{1,80}$/.test(rawSource) ? rawSource : "website-download";
  return (
    <main className="download-stage">
      <div className="download-ambient ambient-top" />
      <div className="download-ambient ambient-bottom" />

      <div className="download-shell">
        <header className="download-header">
          <Link href="/" className="download-back" aria-label="Ana sayfaya dön">
            <ArrowLeft size={16} />
            <span>Ana Sayfa</span>
          </Link>
          <Brand />
          <Link href="/login" className="download-login-link">
            Giriş Yap
          </Link>
        </header>

        <section className="download-hero">
          <div className="apk-badge">
            <Sparkles size={14} />
            <span>Resmî İmzalı Android Sürümü · v1.9.11</span>
          </div>

          <div className="apk-phone-preview">
            <div className="phone-glow" />
            <div className="phone-circle">
              <Smartphone size={44} strokeWidth={1.5} />
            </div>
          </div>

          <h1>
            Lovask <em>Android APK</em>
          </h1>
          <p className="download-desc">
            Anlık bildirimler, akıcı profil kartları ve güvenli sohbet deneyimi için Lovask uygulamasını doğrudan telefonuna yükle. Bu cihazda ilk giriş yapan hesaba, profili tamamlayınca bir kez 3 gün Noir hediye edilir.
          </p>

          <div className="download-action-box">
            <a href={`/api/download/android?utm_source=${encodeURIComponent(source)}`} className="download-primary-btn">
              <Download size={20} />
              <span>
                <strong>Hemen APK İndir</strong>
                <small>3 gün Noir hediye · Android 7.0+</small>
              </span>
            </a>

            <div className="download-security-pill">
              <ShieldCheck size={16} />
              <span>Lovask tarafından imzalanmış resmî paket</span>
            </div>
          </div>
        </section>

        <section className="download-noir" aria-labelledby="download-noir-title">
          <span className="download-noir-label"><Crown size={16} /> UYGULAMA HEDİYESİ</span>
          <h2 id="download-noir-title">İlk 3 günün <em>Noir.</em></h2>
          <p>Uygulamayı indirip giriş yap ve profilini tamamla; bu cihazdaki ilk hesap 3 gün Noir kullanır. Başka e-postayla tekrar alınamaz.</p>
          <div className="download-noir-features">
            <span><CheckCircle2 size={16} /> Sınırsız beğeni</span>
            <span><CheckCircle2 size={16} /> Seni beğenenleri gör</span>
            <span><Zap size={16} /> Haftalık 30 dakika Boost</span>
          </div>
          <Link href="/noir">Tüm Noir ayrıcalıklarını incele <ArrowRight size={16} /></Link>
        </section>

        <section className="release-signature" aria-label="Sürüm doğrulama bilgileri">
          <span><small>SÜRÜM</small><strong>1.9.11</strong></span>
          <span><small>PAKET</small><strong>tr.com.lovask.app</strong></span>
          <span><small>SHA-256</small><code title="ED37C2BD4AC447AB94F95F91B7B1323131EFDD7FF6CB2B296587464B6D599ED4">ED37C2BD…599ED4</code></span>
        </section>

        <section className="install-steps-section">
          <h2>3 Adımda Kolay Kurulum</h2>
          <div className="install-steps-grid">
            <div className="step-card">
              <div className="step-num">1</div>
              <h3>APK Dosyasını İndir</h3>
              <p>Yukarıdaki &quot;Hemen APK İndir&quot; butonuna basarak kurulum dosyasını cihazına kaydet.</p>
            </div>

            <div className="step-card">
              <div className="step-num">2</div>
              <h3>Yüklemeye İzin Ver</h3>
              <p>Tarayıcın uyarı verirse &quot;Yine de indir&quot; ve &quot;Bilinmeyen kaynaklara izin ver&quot; seçeneklerini onayla.</p>
            </div>

            <div className="step-card">
              <div className="step-num">3</div>
              <h3>Kur ve Giriş Yap</h3>
              <p>İndirilenler bildirimine dokunup &quot;Yükle&quot;ye bas. Uygulamayı açarak Lovask deneyimine başla.</p>
            </div>
          </div>
        </section>

        <section className="download-perks-section">
          <div className="perk-row">
            <CheckCircle2 size={18} />
            <span>Resmî Lovask sürümünü doğrudan bu sayfadan indirme</span>
          </div>
          <div className="perk-row">
            <CheckCircle2 size={18} />
            <span>Kişiselleştirilmiş anlık eşleşme ve mesaj bildirimleri</span>
          </div>
          <div className="perk-row">
            <CheckCircle2 size={18} />
            <span>Yüksek performanslı, düşük veri tüketen optimize edilmiş altyapı</span>
          </div>
        </section>

        <footer className="download-footer">
          <Link href="/blog">Lovask Blog</Link>
          <Link href="/login">Giriş Yap</Link>
          <Link href="/">Ana Sayfa</Link>
          <small>&copy; {new Date().getFullYear()} LOVASK. TÜM HAKLARI SAKLIDIR.</small>
        </footer>
      </div>
    </main>
  );
}
