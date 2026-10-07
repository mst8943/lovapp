export type AdminPage = { key: string; href: string; label: string; roles: string[]; keywords?: string };

const ALL = ["owner", "bot_editor", "support", "moderator"];

export const ADMIN_PAGES: AdminPage[] = [
  { key: "overview", href: "/admin/lovask-control", label: "Genel bakış", roles: ALL, keywords: "dashboard özet ana sayfa" },
  { key: "users", href: "/admin/lovask-control/users", label: "Kullanıcılar", roles: ["owner", "support", "moderator"], keywords: "üyeler profil bot" },
  { key: "applications", href: "/admin/lovask-control/applications", label: "Başvurular", roles: ["owner", "support"], keywords: "davet onay üyelik" },
  { key: "payments", href: "/admin/lovask-control/payments", label: "Ödemeler", roles: ["owner", "support"], keywords: "noir dekont gelir kupon sipariş" },
  { key: "support", href: "/admin/lovask-control/support", label: "Canlı destek", roles: ["owner", "support"], keywords: "talep ticket yardım" },
  { key: "reports", href: "/admin/lovask-control/reports", label: "Şikâyetler", roles: ["owner", "moderator"], keywords: "bildirim rapor engel" },
  { key: "photos", href: "/admin/lovask-control/photos", label: "Fotoğraflar", roles: ["owner", "moderator"], keywords: "moderasyon onay red görsel" },
  { key: "conversations", href: "/admin/lovask-control/conversations", label: "Sohbetler", roles: ["owner", "support", "moderator"], keywords: "mesaj denetim devral" },
  { key: "community", href: "/admin/lovask-control/community", label: "Hikayeler ve Buluşma", roles: ["owner", "moderator"], keywords: "etkinlik story plan" },
  { key: "bots", href: "/admin/lovask-control/bots", label: "Bot stüdyosu", roles: ["owner", "bot_editor"], keywords: "persona yapay zeka fotoğraf havuzu" },
  { key: "blog", href: "/admin/lovask-control/blog", label: "Blog", roles: ["owner", "bot_editor"], keywords: "yazı seo içerik" },
  { key: "growth", href: "/admin/lovask-control/growth", label: "Büyüme", roles: ["owner"], keywords: "kaynak kampanya davet analitik" },
  { key: "notify", href: "/admin/lovask-control/notify", label: "Bildirim gönder", roles: ["owner"], keywords: "push segment duyuru" },
  { key: "platform", href: "/admin/lovask-control/platform", label: "Platform özeti", roles: ["owner"], keywords: "özellikler kurulum hazırlık" },
  { key: "health", href: "/admin/lovask-control/health", label: "Sistem sağlığı", roles: ["owner"], keywords: "webhook kapasite durum" },
  { key: "team", href: "/admin/lovask-control/team", label: "Ekip ve roller", roles: ["owner"], keywords: "yönetici yetki moderatör ekle" },
  { key: "audit", href: "/admin/lovask-control/audit", label: "İşlem günlüğü", roles: ["owner"], keywords: "log kayıt denetim" },
  { key: "settings", href: "/admin/lovask-control/settings", label: "Ayarlar", roles: ["owner"], keywords: "marka logo doğrulama kurulum" },
];
