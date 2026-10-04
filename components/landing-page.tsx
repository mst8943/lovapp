import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Bell,
  Check,
  Crown,
  Download,
  Heart,
  LockKeyhole,
  MapPin,
  MessageCircle,
  Mic,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import "./landing-page.css";
import "./landing-page-light.css";

export function LandingPage() {
  return (
    <main className="landing-stage">
      <header className="landing-nav">
        <BrandMark />
        <nav aria-label="Sayfa menüsü">
          <Link href="#nasil-calisir">Nasıl çalışır?</Link>
          <Link href="#noir">Noir</Link>
          <Link href="#android">Android</Link>
          <Link href="/blog">Hikâyeler</Link>
          <Link href="/login" className="landing-login">
            Giriş yap
          </Link>
        </nav>
      </header>

      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-hero-copy">
          <span className="landing-kicker">
            <i /> Niyetini saklamayanlar için
          </span>
          <h1 id="landing-title">
            Bir fotoğraftan
            <br />
            <em>daha fazlasını</em> gör.
          </h1>
          <p>
            Ne aradığını söyle. Seni gerçekten merak eden insanlarla tanış.
            Lovask, ilk bakışı dürüst bir sohbete dönüştürür. Daha rahat keşif ve
            anlık bildirimler için Android uygulamamızı indir.
          </p>
          <div className="landing-actions">
            <Link href="/login" className="landing-primary">
              Tanışmaya başla <ArrowRight size={18} />
            </Link>
            <a
              href="/api/download/android?utm_source=website-hero"
              className="landing-apk-link"
            >
              <Download size={18} /> Android uygulamasını indir
            </a>
          </div>
          <div className="landing-assurance" aria-label="Topluluk güvenceleri">
            <span>
              <ShieldCheck size={15} /> 18+ topluluk
            </span>
            <span>
              <BadgeCheck size={15} /> İncelenen profiller
            </span>
            <span>Gizlilik öncelikli</span>
          </div>
        </div>

        <div className="landing-encounter" aria-label="Lovask profil deneyimi">
          <div className="landing-thread" aria-hidden="true">
            <Heart size={18} fill="currentColor" />
          </div>
          <article className="landing-person landing-person-one">
            <Image
              src="/hero_woman.webp"
              alt="Lovask üyesi kadın profili"
              fill
              priority
              sizes="(max-width: 760px) 64vw, 32vw"
            />
            <div className="landing-person-copy">
              <span>Ciddi ilişki</span>
              <strong>Ela, 28</strong>
              <small>İstanbul · Mimarlık</small>
            </div>
          </article>
          <article className="landing-person landing-person-two">
            <Image
              src="/hero_man.webp"
              alt="Lovask üyesi erkek profili"
              fill
              priority
              sizes="(max-width: 760px) 54vw, 27vw"
            />
            <div className="landing-person-copy">
              <span>Yeni tanışmalar</span>
              <strong>Aras, 31</strong>
              <small>İstanbul · Gastronomi</small>
            </div>
          </article>
          <p className="landing-icebreaker">
            <Sparkles size={15} />
            <span>
              <small>İlk sözü kolaylaştır</small>“Birlikte kaybolmak istediğin
              şehir?”
            </span>
          </p>
        </div>
      </section>

      <section className="landing-noir" id="noir" aria-labelledby="noir-title">
        <div className="landing-noir-intro">
          <Link href="/download" className="landing-noir-note">
            <Crown size={18} />
            <span>
              <strong>Android’de 3 gün Noir hediye</strong>
              <small>Profilini tamamla, ayrıcalıkları keşfet</small>
            </span>
            <ArrowRight size={16} />
          </Link>
          <span className="landing-noir-eyebrow">
            <Crown size={16} /> LOVASK NOIR
          </span>
          <h2 id="noir-title">
            Tanışmaya kendi <em>ritmini</em> kat.
          </h2>
          <p>
            Temel keşif ve sohbet ücretsiz. Noir, kiminle ilgileneceğini
            seçerken sana daha fazla kontrol ve görünürlük verir.
          </p>
          <Link href="/noir">
            Noir ayrıcalıklarını gör <ArrowRight size={17} />
          </Link>
        </div>
        <div className="landing-noir-benefits">
          <article>
            <span>01</span>
            <div>
              <strong>Sınır olmadan keşfet</strong>
              <p>
                Sınırsız beğeniyle kararlarını günlük hak sayısına göre verme.
              </p>
            </div>
          </article>
          <article>
            <span>02</span>
            <div>
              <strong>İlgiyi gör, kararını değiştir</strong>
              <p>
                Seni beğenenleri gör; son kararını geri al ve her gün bir Süper
                Beğeni kullan.
              </p>
            </div>
          </article>
          <article>
            <span>
              <Zap size={19} />
            </span>
            <div>
              <strong>Öne çıkmak istediğinde Boost</strong>
              <p>
                Haftada bir kez 30 dakika boyunca uygun profilini keşifte öne
                çıkar.
              </p>
            </div>
          </article>
        </div>
      </section>

      <section
        className="landing-how"
        id="nasil-calisir"
        aria-labelledby="how-title"
      >
        <header className="landing-section-heading">
          <p>Tanışmanın daha net hâli</p>
          <h2 id="how-title">
            Üç küçük adım.
            <br />
            <em>Gerçek bir başlangıç.</em>
          </h2>
          <span>
            Profilini tamamla, sana uyan kişiyi keşfet ve ortak bir ayrıntıdan
            sohbete gir.
          </span>
        </header>
        <div className="landing-steps">
          <article className="landing-step landing-step-profile">
            <div className="landing-step-meta">
              <b>01</b>
              <span>Profilini oluştur</span>
            </div>
            <div className="landing-profile-passport">
              <Image
                src="/profiles/lara.webp"
                alt="Lara'nın örnek profil fotoğrafı"
                fill
                sizes="(max-width: 760px) 70vw, 24vw"
              />
              <div className="landing-passport-top">
                <span>%92 tamamlandı</span>
                <i />
              </div>
              <div className="landing-passport-copy">
                <small>Hafta sonu ritüelim</small>
                <strong>Yeni bir sokakta kaybolmak.</strong>
                <span>
                  <MapPin size={12} /> Kadıköy
                </span>
              </div>
            </div>
            <div className="landing-step-copy">
              <h3>Niyetini baştan göster.</h3>
              <p>
                Ne aradığını ve seni anlatan küçük ayrıntıları ekle. Profilin,
                doğru kişiye ilk ipucunu versin.
              </p>
              <div>
                <span>Ciddi ilişki</span>
                <span>Keşif</span>
              </div>
            </div>
          </article>
          <article className="landing-step landing-step-discover">
            <div className="landing-step-meta">
              <b>02</b>
              <span>Sana uyanı keşfet</span>
            </div>
            <div className="landing-discovery-card">
              <Image
                src="/profiles/defne.webp"
                alt="Defne'nin örnek keşif profili"
                fill
                sizes="(max-width: 760px) 70vw, 24vw"
              />
              <div className="landing-discovery-badge">
                <BadgeCheck size={14} /> Doğrulandı
              </div>
              <div className="landing-discovery-copy">
                <strong>Defne, 27</strong>
                <span>
                  <MapPin size={12} /> 3 km uzakta
                </span>
                <p>“İyi bir kahve ve uzun yürüyüş.”</p>
              </div>
              <button type="button" aria-label="Defne profilini beğen">
                <Heart size={22} fill="currentColor" />
              </button>
            </div>
            <div className="landing-step-copy">
              <h3>Fotoğrafın arkasını gör.</h3>
              <p>
                Niyet, mesafe ve karakterini anlatan cevapları birlikte
                değerlendir. Daha az tahmin, daha isabetli keşif.
              </p>
              <div>
                <span>Tercihler</span>
                <span>Yakınındaki kişiler</span>
              </div>
            </div>
          </article>
          <article className="landing-step landing-step-chat">
            <div className="landing-step-meta">
              <b>03</b>
              <span>Sohbeti başlat</span>
            </div>
            <div className="landing-chat-preview">
              <div className="landing-chat-head">
                <span>
                  <Image
                    src="/profiles/defne.webp"
                    alt=""
                    width={42}
                    height={42}
                  />
                  <i />
                </span>
                <div>
                  <strong>Defne</strong>
                  <small>Şimdi çevrimiçi</small>
                </div>
                <MessageCircle size={19} />
              </div>
              <p className="landing-chat-day">Bugün</p>
              <div className="landing-bubble landing-bubble-them">
                Kaybolmak istediğin şehir hangisi?
              </div>
              <div className="landing-bubble landing-bubble-me">
                Lizbon. Sokaklarını plansız gezmek için ☀️
              </div>
              <div className="landing-voice">
                <Mic size={16} />
                <i />
                <i />
                <i />
                <i />
                <i />
                <span>0:08</span>
              </div>
              <div className="landing-typing">
                <i />
                <i />
                <i />
              </div>
            </div>
            <div className="landing-step-copy">
              <h3>“Merhaba”dan öteye geç.</h3>
              <p>
                Profildeki gerçek bir ayrıntıdan başla. Hazır konuşma önerileri
                ilk mesajın yükünü hafifletsin.
              </p>
              <div>
                <span>Mesaj</span>
                <span>Sesli mesaj</span>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="landing-trust" aria-labelledby="trust-title">
        <div className="landing-trust-copy">
          <p>Güven, sonradan eklenen bir özellik değil</p>
          <h2 id="trust-title">
            Kontrol her zaman <em>sende.</em>
          </h2>
          <span>
            Kimlerle görünür olduğunu belirle, istemediğin teması bitir ve
            gerektiğinde tek dokunuşla bildirimde bulun.
          </span>
          <Link href="/community-guidelines">
            Topluluk yaklaşımımızı oku <ArrowRight size={16} />
          </Link>
        </div>
        <div className="landing-trust-list">
          <article>
            <ShieldCheck size={22} />
            <div>
              <strong>İncelenen topluluk</strong>
              <p>Profil ve içerik bildirimleri moderasyon sürecine alınır.</p>
            </div>
          </article>
          <article>
            <LockKeyhole size={22} />
            <div>
              <strong>Gizlilik ayarları</strong>
              <p>Keşfedilme ve profil görünürlüğü kararları sana aittir.</p>
            </div>
          </article>
          <article>
            <MessageCircle size={22} />
            <div>
              <strong>Sınır koyma araçları</strong>
              <p>
                Engelleme ve şikâyet seçenekleri sohbetin her anında
                ulaşılabilir.
              </p>
            </div>
          </article>
        </div>
      </section>

      <section
        className="landing-app-section"
        id="android"
        aria-labelledby="app-title"
      >
        <div
          className="landing-phone-stage"
          aria-label="Lovask Android uygulaması ekranları"
        >
          <div className="landing-phone landing-phone-messages">
            <i />
            <Image
              src="/landing/messages.png"
              alt="Lovask mesajlar ekranı"
              fill
              sizes="220px"
            />
          </div>
          <div className="landing-phone landing-phone-discover">
            <i />
            <Image
              src="/landing/discover.png"
              alt="Lovask keşfet ekranı"
              fill
              sizes="280px"
            />
          </div>
          <div className="landing-phone landing-phone-profile">
            <i />
            <Image
              src="/landing/profile.png"
              alt="Lovask profil ekranı"
              fill
              sizes="220px"
            />
          </div>
          <span className="landing-phone-seal">
            <Heart size={17} fill="currentColor" /> Lovask
          </span>
        </div>
        <div className="landing-app-copy">
          <p>Lovask Android</p>
          <h2 id="app-title">
            Bağlantılarını
            <br />
            <em>cebinde taşı.</em>
          </h2>
          <span>
            Keşfet, eşleş ve sohbetlerine tam ekran uygulama deneyimiyle
            kaldığın yerden devam et. Uygulamada profilini tamamlayınca hesabına
            bir kez 3 gün Noir hediye edilir.
          </span>
          <Link href="/noir" className="landing-app-noir">
            <Crown size={18} />
            <span>
              <strong>3 gün Noir’ı uygulamada keşfet</strong>
              <small>Sınırsız beğeni, seni beğenenler ve Boost</small>
            </span>
            <ArrowRight size={17} />
          </Link>
          <ul>
            <li>
              <Bell size={17} />
              <div>
                <strong>Anlık bildirimler</strong>
                <small>Yeni eşleşme ve mesajları kaçırma.</small>
              </div>
            </li>
            <li>
              <Sparkles size={17} />
              <div>
                <strong>Tam ekran deneyim</strong>
                <small>
                  Tarayıcı çubuğu olmadan, Lovask için tasarlanan görünüm.
                </small>
              </div>
            </li>
            <li>
              <Check size={17} />
              <div>
                <strong>Resmî sürüm</strong>
                <small>Güncellemeler indirme sayfamızda yayınlanır.</small>
              </div>
            </li>
          </ul>
          <div className="landing-app-actions">
            <a
              href="/api/download/android?utm_source=website-android"
              className="landing-app-download"
            >
              <Download size={19} />
              <span>
                <small>Android v1.9.11 · ücretsiz indirme</small>APK’yı ücretsiz
                indir
              </span>
            </a>
            <Link href="/login">Web’den devam et</Link>
          </div>
          <small className="landing-install-note">
            Android 7.0 ve üzeri · 3 günlük Noir hediyesi ilk uygun cihaz
            kurulumu ve tamamlanan profil için bir kez tanımlanır.
          </small>
        </div>
      </section>

      <footer className="landing-footer">
        <BrandMark />
        <p>Gerçek bir bağ, açık bir niyetle başlar.</p>
        <nav aria-label="Site bağlantıları">
          <Link href="/privacy">Gizlilik</Link>
          <Link href="/terms">Koşullar</Link>
          <Link href="/community-guidelines">Topluluk</Link>
          <a href="mailto:destek@lovask.com.tr">Destek</a>
        </nav>
        <small>© {new Date().getFullYear()} Lovask</small>
      </footer>
    </main>
  );
}

function BrandMark() {
  return (
    <Link href="/" className="landing-nav-brand" aria-label="Lovask ana sayfa">
      <span>l</span>
      <b>lovask</b>
    </Link>
  );
}
