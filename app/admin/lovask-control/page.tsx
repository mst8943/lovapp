"use client";

import Link from "next/link";
import {
  Banknote,
  Bot,
  Camera,
  ChevronRight,
  ClipboardList,
  FileText,
  HeartPulse,
  LifeBuoy,
  MessageSquareText,
  MessageSquareWarning,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { AdminResourceNav } from "@/components/admin-resource-nav";
import { useAdminRole } from "@/components/admin-role-context";
import { AdminTrends } from "@/components/admin-trends";
import { AdminTodo } from "@/components/admin-todo";
import "./admin-page.css";

type AdminStats = {
  activeProfiles: number;
  todayMatches: number;
  botMessages: number;
  bots: number;
  botLikes: number;
  pendingBotMatches: number;
  completedBotMatches: number;
  botMatchRate: number;
};

const emptyStats: AdminStats = {
  activeProfiles: 0,
  todayMatches: 0,
  botMessages: 0,
  bots: 0,
  botLikes: 0,
  pendingBotMatches: 0,
  completedBotMatches: 0,
  botMatchRate: 0,
};

export default function AdminPage() {
  const [stats, setStats] = useState(emptyStats);
  const [activeBotCount, setActiveBotCount] = useState(0);
  const [status, setStatus] = useState("Canlı veriler yükleniyor…");
  const [counts, setCounts] = useState<Record<string, number>>({});

  const loadData = useCallback(async () => {
    try {
      const [botsRes, badgesRes] = await Promise.all([
        fetch("/api/admin/bots", { cache: "no-store" }),
        fetch("/api/admin/badges", { cache: "no-store" }).catch(() => null),
      ]);

      if (botsRes.ok) {
        const data = await botsRes.json().catch(() => ({}));
        setStats(data.stats ?? emptyStats);
        const botsList = Array.isArray(data.bots) ? data.bots : [];
        setActiveBotCount(botsList.filter((b: { active?: boolean }) => b.active).length);
        setStatus("");
      } else {
        setStatus("");
      }

      if (badgesRes && badgesRes.ok) {
        const badgeData = await badgesRes.json().catch(() => ({}));
        setCounts(badgeData.counts ?? {});
      }
    } catch {
      setStatus("");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const today = new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "long",
    timeZone: "Europe/Istanbul",
  }).format(new Date());

  return (
    <main className="admin-stage">
      <AdminResourceNav />
      <section className="admin-main">
        <header>
          <div>
            <small>{today} · İstanbul</small>
            <h1>
              Yönetim Kontrol Merkezi · <em>Genel Bakış</em>
            </h1>
          </div>
          <Link className="admin-primary" href="/admin/lovask-control/bots">
            <Bot size={17} /> Bot Stüdyosuna Git
          </Link>
        </header>

        <RegistrationModePanel />

        <div className="admin-stats">
          <Stat
            label="Aktif profiller"
            value={stats.activeProfiles.toLocaleString("tr-TR")}
            detail="Tamamlanmış canlı üyeler"
          />
          <Stat
            label="Bugünkü eşleşme"
            value={stats.todayMatches.toLocaleString("tr-TR")}
            detail={`%${stats.botMatchRate} başarı oranı · ${stats.todayMatches} eşleşme`}
          />
          <Stat
            label="Bot mesajları"
            value={stats.botMessages.toLocaleString("tr-TR")}
            detail={`${stats.botLikes} toplam bot beğenisi`}
          />
          <Stat
            label="Bot ekosistemi"
            value={stats.bots.toLocaleString("tr-TR")}
            detail={`${activeBotCount} keşfette aktif`}
          />
        </div>

        <AdminTodo />

        <AdminTrends />

        <AndroidAcquisition />

        {status ? <p className="admin-data-status">{status}</p> : null}

        <div className="admin-grid">
          {/* Sol Kolon: Ana Yönetim Modülleri */}
          <section className="admin-panel">
            <div className="panel-head">
              <div>
                <small>Operasyonel modüller</small>
                <h2>Yönetim Alanları</h2>
              </div>
            </div>

            <div className="dashboard-modules-grid">
              <Link className="dashboard-module-card" href="/admin/lovask-control/users">
                <div className="dashboard-module-head">
                  <span className="dashboard-module-icon">
                    <Users size={18} />
                  </span>
                  {counts.users ? (
                    <span className="dashboard-module-badge">{counts.users} yeni</span>
                  ) : null}
                </div>
                <div className="dashboard-module-body">
                  <strong>Kullanıcılar</strong>
                  <p>Kayıtlı profilleri incele, rolleri düzenle ve moderasyon uygula.</p>
                </div>
                <div className="dashboard-module-foot">
                  <span>Yönetime git</span>
                  <ChevronRight size={14} />
                </div>
              </Link>

              <Link className="dashboard-module-card" href="/admin/lovask-control/applications">
                <div className="dashboard-module-head">
                  <span className="dashboard-module-icon">
                    <ClipboardList size={18} />
                  </span>
                  {counts.applications ? (
                    <span className="dashboard-module-badge">{counts.applications} bekliyor</span>
                  ) : null}
                </div>
                <div className="dashboard-module-body">
                  <strong>Başvurular</strong>
                  <p>Davetiye ve üyelik başvurularını değerlendirip onayla.</p>
                </div>
                <div className="dashboard-module-foot">
                  <span>Başvuruları incele</span>
                  <ChevronRight size={14} />
                </div>
              </Link>

              <Link className="dashboard-module-card" href="/admin/lovask-control/bots">
                <div className="dashboard-module-head">
                  <span className="dashboard-module-icon">
                    <Bot size={18} />
                  </span>
                  <span className="dashboard-module-badge highlight">Özel Stüdyo</span>
                </div>
                <div className="dashboard-module-body">
                  <strong>Bot Stüdyosu</strong>
                  <p>Personalar, fotoğraf havuzu, AI sağlayıcıları ve otomasyon ayarları.</p>
                </div>
                <div className="dashboard-module-foot">
                  <span>Stüdyoyu aç</span>
                  <ChevronRight size={14} />
                </div>
              </Link>

              <Link className="dashboard-module-card" href="/admin/lovask-control/payments">
                <div className="dashboard-module-head">
                  <span className="dashboard-module-icon">
                    <Banknote size={18} />
                  </span>
                  {counts.payments ? (
                    <span className="dashboard-module-badge">{counts.payments} işlem</span>
                  ) : null}
                </div>
                <div className="dashboard-module-body">
                  <strong>Ödemeler & Gelirler</strong>
                  <p>VIP üyelik satışları, bakiye hareketleri ve ödeme dökümleri.</p>
                </div>
                <div className="dashboard-module-foot">
                  <span>Mali hareketler</span>
                  <ChevronRight size={14} />
                </div>
              </Link>

              <Link className="dashboard-module-card" href="/admin/lovask-control/support">
                <div className="dashboard-module-head">
                  <span className="dashboard-module-icon">
                    <LifeBuoy size={18} />
                  </span>
                  {counts.support ? (
                    <span className="dashboard-module-badge">{counts.support} talep</span>
                  ) : null}
                </div>
                <div className="dashboard-module-body">
                  <strong>Canlı Destek</strong>
                  <p>Kullanıcı yardım biletleri ve aktif destek görüşmeleri.</p>
                </div>
                <div className="dashboard-module-foot">
                  <span>Talepleri gör</span>
                  <ChevronRight size={14} />
                </div>
              </Link>

              <Link className="dashboard-module-card" href="/admin/lovask-control/reports">
                <div className="dashboard-module-head">
                  <span className="dashboard-module-icon">
                    <MessageSquareWarning size={18} />
                  </span>
                  {counts.reports ? (
                    <span className="dashboard-module-badge">{counts.reports} şikâyet</span>
                  ) : null}
                </div>
                <div className="dashboard-module-body">
                  <strong>Şikâyetler</strong>
                  <p>Kullanıcı raporları, uygunsuz davranış ve içerik denetimi.</p>
                </div>
                <div className="dashboard-module-foot">
                  <span>Raporları aç</span>
                  <ChevronRight size={14} />
                </div>
              </Link>
            </div>
          </section>

          {/* Sağ Kolon: Sistem Durumu & Canlı Nabız */}
          <section className="admin-panel activity-panel">
            <div className="panel-head">
              <div>
                <small>Canlı nabız</small>
                <h2>Sistem & Altyapı</h2>
              </div>
            </div>

            <div className="dashboard-status-list">
              <div className="dashboard-status-item">
                <div>
                  <i className="dashboard-status-dot" />
                  <span className="dashboard-status-label">Supabase Veritabanı</span>
                </div>
                <span className="dashboard-status-value">Aktif & Bağlı</span>
              </div>

              <div className="dashboard-status-item">
                <div>
                  <i className="dashboard-status-dot" />
                  <span className="dashboard-status-label">Canlı Bildirimler (Realtime)</span>
                </div>
                <span className="dashboard-status-value">Dinleniyor</span>
              </div>

              <div className="dashboard-status-item">
                <div>
                  <i className="dashboard-status-dot" />
                  <span className="dashboard-status-label">Yapay Zekâ Entegrasyonu</span>
                </div>
                <span className="dashboard-status-value">Hazır</span>
              </div>

              <div className="dashboard-status-item">
                <div>
                  <i className="dashboard-status-dot" />
                  <span className="dashboard-status-label">Güvenlik & Yetkilendirme</span>
                </div>
                <span className="dashboard-status-value">Korumalı</span>
              </div>
            </div>

            <div style={{ margin: "20px 0 10px 0", borderTop: "1px solid rgba(255, 255, 255, 0.06)" }} />

            <div className="panel-head" style={{ marginBottom: 12 }}>
              <div>
                <small>Son 24 saat</small>
                <h2>Aktivite Özeti</h2>
              </div>
            </div>

            <Activity
              icon={<Sparkles size={15} />}
              title={`${stats.todayMatches} yeni eşleşme kaydedildi`}
              time="Bugün"
            />
            <Activity
              icon={<MessageSquareText size={15} />}
              title={`${stats.botMessages} bot mesajı iletildi`}
              time="Toplam"
            />
            <Activity
              icon={<Users size={15} />}
              title={`${stats.activeProfiles} profil onaylandı`}
              time="Canlı"
            />

            <div style={{ margin: "20px 0 10px 0", borderTop: "1px solid rgba(255, 255, 255, 0.06)" }} />

            <div className="panel-head" style={{ marginBottom: 12 }}>
              <div>
                <small>Hızlı erişim</small>
                <h2>Diğer Araçlar</h2>
              </div>
            </div>

            <div className="quick-links-list">
              <Link className="quick-link-item" href="/admin/lovask-control/photos">
                <span><Camera size={14} /> Fotoğraf Havuzu Moderasyonu</span>
                <ChevronRight size={13} />
              </Link>
              <Link className="quick-link-item" href="/admin/lovask-control/conversations">
                <span><MessageSquareText size={14} /> Sohbet Geçmişi ve Kayıtlar</span>
                <ChevronRight size={13} />
              </Link>
              <Link className="quick-link-item" href="/admin/lovask-control/blog">
                <span><FileText size={14} /> Blog & İçerik Yönetimi</span>
                <ChevronRight size={13} />
              </Link>
              <Link className="quick-link-item" href="/admin/lovask-control/health">
                <span><HeartPulse size={14} /> Detaylı Sistem Sağlığı</span>
                <ChevronRight size={13} />
              </Link>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="admin-stat">
      <small>{label}</small>
      <strong>{value}</strong>
      <span>{detail}</span>
    </div>
  );
}

function AndroidAcquisition() {
  const role = useAdminRole();
  const [totals, setTotals] = useState<{ androidDownloads: number; androidOpens: number; androidRegistrations: number; androidGifts: number } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (role !== "owner" && role !== "support") return;
    fetch("/api/admin/growth", { cache: "no-store" }).then(async (response) => {
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "Uygulama sayaçları alınamadı.");
      setTotals(body.totals);
    }).catch((cause) => setError(cause instanceof Error ? cause.message : "Uygulama sayaçları alınamadı."));
  }, [role]);
  if (role !== "owner" && role !== "support") return null;
  return <><div className="admin-stats">
    <Stat label="APK indirme başlatma" value={totals ? totals.androidDownloads.toLocaleString("tr-TR") : "—"} detail="Bağlantı isteği" />
    <Stat label="Ölçülen ilk açılış" value={totals ? totals.androidOpens.toLocaleString("tr-TR") : "—"} detail="Tekil kurulum kimliği" />
    <Stat label="Android kaydı" value={totals ? totals.androidRegistrations.toLocaleString("tr-TR") : "—"} detail="Tamamlanan hesap kaydı" />
    <Stat label="Noir hediyesi" value={totals ? totals.androidGifts.toLocaleString("tr-TR") : "—"} detail="Tanımlanan 3 günlük hak" />
  </div>{error ? <p className="admin-data-status" role="alert">{error}</p> : null}</>;
}

function Activity({
  icon,
  title,
  time,
}: {
  icon: React.ReactNode;
  title: string;
  time: string;
}) {
  return (
    <div className="activity">
      <span>{icon}</span>
      <div>
        <strong>{title}</strong>
        <small>{time}</small>
      </div>
    </div>
  );
}

function RegistrationModePanel() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("Kayıt modu yükleniyor…");

  useEffect(() => {
    fetch("/api/admin/registration-settings", { cache: "no-store" })
      .then(async (response) => ({ response, body: await response.json().catch(() => ({})) }))
      .then(({ response, body }) => {
        if (!response.ok) return setStatus(body.error ?? "Kayıt modu yüklenemedi.");
        setEnabled(body.enabled === true);
        setStatus("");
      })
      .catch(() => setStatus("Kayıt modu yüklenemedi."));
  }, []);

  const toggle = async () => {
    if (enabled === null || saving) return;
    const next = !enabled;
    setSaving(true);
    setStatus("Kaydediliyor…");
    try {
      const response = await fetch("/api/admin/registration-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) return setStatus(body.error ?? "Kayıt modu kaydedilemedi.");
      setEnabled(body.enabled === true);
      setStatus(body.enabled ? "Standart kayıt herkese açıldı." : "Başvuru ve davet moduna dönüldü.");
    } catch {
      setStatus("Kayıt modu kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={enabled ? "registration-mode-panel open" : "registration-mode-panel"}>
      <span className="registration-mode-icon">
        <UserPlus size={19} />
      </span>
      <div>
        <small>Üyelik kapısı</small>
        <strong>{enabled ? "Standart kayıt açık" : "Başvuru ve davet modu"}</strong>
        <p>
          {enabled
            ? "Ziyaretçiler e-posta veya Google ile doğrudan hesap oluşturabilir."
            : "Yeni üyeler kurul onayı ve davetiye olmadan hesap oluşturamaz."}
        </p>
      </div>
      <div className="registration-mode-action">
        <button
          type="button"
          className={enabled ? "mini-switch active" : "mini-switch"}
          onClick={() => void toggle()}
          disabled={enabled === null || saving}
          aria-pressed={enabled === true}
          aria-label="Standart kayıt modunu aç veya kapat"
        >
          <i />
        </button>
        <small>{status || (enabled ? "Canlı · herkese açık" : "Canlı · kontrollü")}</small>
      </div>
    </section>
  );
}
