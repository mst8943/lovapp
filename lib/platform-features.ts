export type PlatformFeature = { name: string; detail: string; href?: string };
export type PlatformFeatureGroup = { title: string; features: PlatformFeature[] };

export const PLATFORM_FEATURES: PlatformFeatureGroup[] = [
  {
    title: "Keşif ve eşleşme",
    features: [
      { name: "Kart kaydırma keşfi", detail: "Yaş, şehir ve tercih filtreleriyle sıralanan kart destesi." },
      { name: "Süper beğeni ve geri alma", detail: "Notlu süper beğeni, son kaydırmayı geri alma." },
      { name: "Boost", detail: "Noir üyelerine periyodik profil öne çıkarma; keşif sıralamasında ağırlık artar." },
      { name: "Beğenenler ve ziyaretçiler", detail: "Kimin baktığı ve beğendiği, ücretsiz üyeler için bulanık önizleme." },
      { name: "Çevrimiçi durum", detail: "Anlık varlık bilgisi ve okundu işaretleri." },
    ],
  },
  {
    title: "Sohbet",
    features: [
      { name: "Gerçek zamanlı mesajlaşma", detail: "Kalıcı konuşmalar, anlık gelen kutusu güncellemesi.", href: "/admin/lovask-control/conversations" },
      { name: "Sesli ve fotoğraflı mesaj", detail: "Web ve Android'de ses kaydı, gizli depolamada fotoğraf mesajı." },
      { name: "AI Wingman", detail: "Sohbeti başlatmak ve sürdürmek için yapay zekâ önerileri." },
      { name: "Gizli konuşmalar", detail: "Kullanıcı konuşmayı listesinden gizleyebilir." },
    ],
  },
  {
    title: "Topluluk",
    features: [
      { name: "Hikâyeler", detail: "24 saat sonra kaybolan paylaşımlar, tam ekran izleyici.", href: "/admin/lovask-control/community" },
      { name: "Buluşma planları", detail: "Ortak plan seçen üyeler birbirini görür.", href: "/admin/lovask-control/community" },
      { name: "Sesli biyografi", detail: "Profile kısa ses tanıtımı ekleme." },
      { name: "Yüz yüze etkinlikler", detail: "Yöneticinin yayınladığı etkinliklere kontenjanlı katılım kaydı.", href: "/admin/lovask-control/community" },
      { name: "Özel buluşma planları", detail: "Eşleşmeler arasında kişiye özel plan önerme ve yanıtlama." },
    ],
  },
  {
    title: "Gelir",
    features: [
      { name: "Noir VIP üyelik", detail: "Haftalık ve aylık paketler, ayrıcalık yönetimi.", href: "/admin/lovask-control/payments" },
      { name: "Shopier ve Lemon Squeezy", detail: "Ödeme bağlantıları ve webhook doğrulaması." },
      { name: "Dekont ve Telegram onayı", detail: "Havale ödemelerini panelden veya Telegram'dan onaylama." },
      { name: "Gelir özeti ve kupon teklifleri", detail: "Onaylı sipariş ve aylık gelir özeti; kuponlar uyumlu ödeme sağlayıcısı bağlanana kadar taslak kalır.", href: "/admin/lovask-control/payments" },
      { name: "Davet ve referans", detail: "Kişisel davet kodları, kaynak takibi.", href: "/admin/lovask-control/growth" },
    ],
  },
  {
    title: "Güven ve güvenlik",
    features: [
      { name: "Fotoğraf moderasyonu", detail: "Yüklenen fotoğraflar onaydan geçer; klavye kısayollarıyla (A onayla, R reddet, oklar gezin) hızlı inceleme.", href: "/admin/lovask-control/photos" },
      { name: "Selfie doğrulama", detail: "Doğrulama rozeti ve manuel inceleme akışı.", href: "/admin/lovask-control/settings" },
      { name: "Şikâyet ve engelleme", detail: "Kullanıcı bildirimi, moderatör kuyruğu.", href: "/admin/lovask-control/reports" },
      { name: "Bot ve kötüye kullanım koruması", detail: "Cloudflare Turnstile ve istek hız sınırı." },
      { name: "SSS ve güvenlik ipuçları sayfaları", detail: "SEO uyumlu sık sorulan sorular (FAQ şeması) ve güvenli tanışma rehberi.", href: "/sss" },
      { name: "Hesap silme ve kurtarma", detail: "Silinen hesap 30 gün içinde geri alınabilir." },
      { name: "Verilerimi indir (KVKK)", detail: "Üye kendi profil, eşleşme ve mesaj verilerini tek dosyada indirir." },
    ],
  },
  {
    title: "Büyüme",
    features: [
      { name: "Segmentli bildirim", detail: "Üyeleri segmente ayırıp önizleme, test ve onayla toplu push gönderme.", href: "/admin/lovask-control/notify" },
      { name: "Büyüme paneli", detail: "Kayıt kaynakları, dönüşüm ve indirme takibi.", href: "/admin/lovask-control/growth" },
      { name: "Blog ve SEO", detail: "Zengin metin editörü, site haritası, yapılandırılmış veri.", href: "/admin/lovask-control/blog" },
      { name: "Uygulama içi kampanya kartı", detail: "Zamanlanmış duyuru kartı, isteğe bağlı tıklama ölçümü.", href: "/admin/lovask-control/growth" },
      { name: "PWA ve Android indirme", detail: "Ana ekrana eklenebilir web uygulaması, imzalı APK dağıtımı." },
    ],
  },
  {
    title: "Yönetim",
    features: [
      { name: "Rol bazlı yönetim paneli", detail: "Sahip, moderatör, destek ve bot editörü rolleri.", href: "/admin/lovask-control/users" },
      { name: "Bot stüdyosu", detail: "Persona, fotoğraf havuzu, gecikmeli eşleşme ve otomasyon.", href: "/admin/lovask-control/bots" },
      { name: "Başvuru ve davet akışı", detail: "Üyelik başvurusu, onay ve davet e-postası.", href: "/admin/lovask-control/applications" },
      { name: "Canlı destek", detail: "Kullanıcı talepleri ve yanıt kuyruğu.", href: "/admin/lovask-control/support" },
      { name: "Sistem sağlığı", detail: "Kapasite, başarısız webhook ve servis durumu.", href: "/admin/lovask-control/health" },
      { name: "Hesap silme talepleri", detail: "KVKK: bekleyen, silinen ve geri alınan hesap silme talepleri.", href: "/admin/lovask-control/deletions" },
      { name: "Bekleme süresi rozetleri", detail: "Ödeme ve destek taleplerinde ne kadardır beklediği, geciken işler vurgulanır." },
      { name: "Son yönetici işlemleri", detail: "Genel bakışta son 6 yönetici işlemi ve işlem günlüğüne kısayol.", href: "/admin/lovask-control" },
      { name: "Bugün yapılacaklar", detail: "Bekleyen ödeme, başvuru, destek ve şikâyetler tek kartta.", href: "/admin/lovask-control" },
      { name: "Hızlı arama (Ctrl+K)", detail: "Panelde sayfa ve üye arama, klavye ile gezinme." },
      { name: "14 günlük trend grafikleri", detail: "Yeni üye, eşleşme, mesaj ve onaylı ödeme trendi, genel bakışta.", href: "/admin/lovask-control" },
      { name: "Üye etkinlik geçmişi", detail: "Üyenin eşleşme, şikâyet, destek, ödeme ve fotoğraf olaylarını tek zaman çizgisinde gösterir." },
      { name: "Üye notları", detail: "Ekibin üye hakkında bıraktığı, üyeye görünmeyen iç notlar." },
      { name: "Hazır destek yanıtları", detail: "Sık sorulan taleplere tek tıkla şablon yanıt." },
      { name: "Ekip ve roller", detail: "Yönetici ekleme, rol değiştirme ve kaldırma; son sahip korunur.", href: "/admin/lovask-control/team" },
      { name: "İşlem günlüğü", detail: "Yönetici işlemlerinin değiştirilemez kaydı: kim, ne zaman, neyi yaptı.", href: "/admin/lovask-control/audit" },
      { name: "CSV dışa aktarma", detail: "Kullanıcı ve ödeme listelerini Excel için indirme." },
      { name: "Sağlık ucu ve duman testi", detail: "Herkese açık /api/health ve tek komutla yönetim API testi (npm run smoke).", href: "/api/health" },
      { name: "Telegram yönetimi", detail: "Önemli işlemleri Telegram üzerinden takip ve onay." },
    ],
  },
  {
    title: "Mobil",
    features: [
      { name: "Flutter Android uygulaması", detail: "Web ile aynı hesap ve veri; keşif, sohbet, hikâye, Noir." },
      { name: "Push bildirimleri", detail: "Android için Firebase, tarayıcı için Web Push." },
      { name: "Google ile giriş", detail: "Sağlayıcı açıksa web ve mobilde tek dokunuşla kayıt." },
    ],
  },
];
