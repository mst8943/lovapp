"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Download,
  HelpCircle,
  BadgeCheck,
  ChevronDown,
  ChevronRight,
  Crown,
  Eye,
  EyeOff,
  LockKeyhole,
  LogOut,
  MapPin,
  Share2,
  Pencil,
  Settings,
  Sparkles,
  Trash2,
  UserRound,
  Zap,
} from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { NotificationControl } from "@/components/notification-control";
import { ReferralPanel } from "@/components/referral-panel";
import { SupportCenter } from "@/components/support-center";
import { VoiceBioEditor } from "@/components/voice-bio-editor";
import type { ViewerProfile } from "@/components/lovask-app";
import "./profile-settings.css";

type ProfileVisitor = {
  id: string;
  name: string;
  age: number;
  city: string;
  verified: boolean;
  image: string;
  visitedAt: string;
};

type BoostStatus = { activeUntil: string | null; nextAvailableAt: string | null; noirUntil: string | null; eligible: boolean; canActivate: boolean };

export function LovaskProfileView({
  liveMode,
  viewer,
}: {
  liveMode: boolean;
  viewer: ViewerProfile;
}) {
  const router = useRouter();
  const [discoverable, setDiscoverable] = useState(viewer.discoverable ?? true);
  const [ghostEnabled, setGhostEnabled] = useState(false);
  const [ghostAvailable, setGhostAvailable] = useState(viewer.isNoir);
  const [boost, setBoost] = useState<BoostStatus | null>(null);
  const [boostBusy, setBoostBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const deleteDialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!liveMode) return;
    void fetch("/api/profile/account", { cache: "no-store" }).then((response) => response.json()).then((data) => {
      setGhostEnabled(data.profile?.ghost_enabled === true);
      setGhostAvailable(data.ghostAvailable === true);
    }).catch(() => undefined);
  }, [liveMode]);

  useEffect(() => {
    if (!liveMode) return;
    void fetch("/api/profile/boost", { cache: "no-store" }).then((response) => response.ok ? response.json() : null).then(setBoost).catch(() => undefined);
  }, [liveMode]);

  const activateBoost = async () => {
    if (boostBusy || !boost?.canActivate) return;
    setBoostBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/profile/boost", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Boost başlatılamadı. Durumu yenile.");
      setBoost(data);
      setNotice("Boost başladı. Profilin 30 dakika boyunca uygun kişilerin keşfinde daha yüksek görünme şansına sahip.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Boost başlatılamadı."); }
    finally { setBoostBusy(false); }
  };

  const toggleGhost = async () => {
    if (busy || !ghostAvailable) return;
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/profile/account", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ghostEnabled: !ghostEnabled }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Hayalet Modu güncellenemedi.");
      setGhostEnabled(!ghostEnabled);
      setNotice(!ghostEnabled ? "Profilini yalnızca beğendiğin kişiler keşfette görebilir." : "Profilin yeniden herkese açık keşfette görünür.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Hayalet Modu güncellenemedi."); }
    finally { setBusy(false); }
  };

  const toggleDiscoverable = async () => {
    if (busy) return;
    const next = !discoverable;
    if (!liveMode) {
      setDiscoverable(next);
      return;
    }
    setBusy(true);
    setNotice("");
    try {
    const response = await fetch("/api/profile/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ discoverable: next }),
    });
    const body = await response.json().catch(() => ({}));
    if (response.ok) { setDiscoverable(next); setNotice(next ? "Profilin keşfette görünür." : "Profilin keşfetten gizlendi. Mevcut sohbetlerin devam eder."); }
    else setNotice(body.error ?? "Görünürlük değiştirilemedi.");
    } catch { setNotice("Bağlantı kurulamadı. Görünürlüğün değişmedi; tekrar dene."); }
    finally { setBusy(false); }
  };

  const signOut = async () => {
    if (busy) return;
    setBusy(true);
    try {
    const { createClient } = await import("@/lib/supabase/client");
    const client = createClient();
    const result = await client?.auth.signOut();
    if (result?.error) throw result.error;
    router.replace("/login");
    } catch { setNotice("Oturum kapatılamadı. Tekrar dene."); }
    finally { setBusy(false); }
  };

  const removeAccount = async () => {
    if (busy || confirmation !== "HESABIMI SİL") return;
    if (!liveMode) { setDeleteError("Demo hesabı silinmez. Bu işlem yalnızca kendi hesabında kullanılabilir."); return; }
    setBusy(true);
    setDeleteError("");
    try {
    const response = await fetch("/api/profile/account", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmation }),
    });
    const body = await response.json().catch(() => ({}));
    if (response.ok) router.replace("/account-recovery");
    else setDeleteError(body.error ?? "Hesap silme talebi oluşturulamadı. Tekrar dene.");
    } catch { setDeleteError("Bağlantı kurulamadı. Hesap silme talebin oluşturulmadı; tekrar dene."); }
    finally { setBusy(false); }
  };

  return (
    <motion.div
      className="screen profile-screen profile-v2"
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
    >
      <header className="profile-page-header">
        <div>
          <h1>Profilim</h1>
        </div>
        <div className="profile-header-actions">
          <button type="button" className="profile-icon-button" aria-label="Profilini paylaş"><Share2 size={18} /></button>
          <Link href="/profile/edit" className="profile-icon-button" aria-label="Profili düzenle"><Pencil size={18} /></Link>
          <Link href="/profile/verification" className="profile-icon-button" aria-label="Hesabını doğrula">✓</Link>
          <button type="button" className="profile-icon-button" aria-label="Profil ayarları"><Settings size={18} /></button>
        </div>
      </header>

      <section className="profile-passport">
        <div className="self-ring">
          <Image
            src={viewer.image}
            alt="Profil fotoğrafın"
            fill
            loading="eager"
            sizes="104px"
            unoptimized={viewer.image.startsWith("http")}
          />
        </div>
        <div className="passport-copy">
          <small>{viewer.isNoir ? "Noir Üye" : "Lovask Üyesi"}</small>
          <h2>
            <span>{viewer.name}</span>
            <em>{viewer.age}</em>
          </h2>
          <p>
            <MapPin size={13} />
            {viewer.city || "Türkiye"}
          </p>
        </div>
        <div className="xp-showcase">
          <span>
            <Sparkles size={14} />
            <b>{viewer.xp.toLocaleString("tr-TR")}</b> XP
          </span>
          <small>Seviye {viewer.level}</small>
        </div>
        <div className="profile-stats">
          <div>
            <strong>{viewer.matchCount}</strong>
            <small>Eşleşme</small>
          </div>
          <div>
            <strong>{viewer.likeCount}</strong>
            <small>Beğeni</small>
          </div>
          <div>
            <strong>{viewer.badges.length}</strong>
            <small>Niyet</small>
          </div>
        </div>
      </section>

      {(viewer.badges.length > 0 || viewer.answer) && (
        <section className="profile-signature-clean">
          {viewer.badges.length > 0 && (
            <div className="badges">
              {viewer.badges.map((badge) => (
                <span key={badge}>{badge}</span>
              ))}
            </div>
          )}
          {viewer.answer && (
            <blockquote>
              <span>{viewer.prompt || "Beni tanımanın en iyi yolu…"}</span>
              <b>{viewer.answer}</b>
            </blockquote>
          )}
        </section>
      )}

      <VoiceBioEditor liveMode={liveMode} />
      <div className="profile-grouped-hub">
        {liveMode && boost ? <section className="profile-hub-group"><h2 className="hub-group-title">Boost</h2><div className="hub-group-content"><div className="hub-row-interactive"><span className="hub-row-icon"><Zap size={16}/></span><div className="hub-row-text"><strong>30 dakika öne çık</strong><small>{boost.activeUntil ? `${new Date(boost.activeUntil).toLocaleString("tr-TR")} tarihine kadar aktif.` : boost.nextAvailableAt ? `Yeni hak: ${new Date(boost.nextAvailableAt).toLocaleString("tr-TR")}` : !boost.noirUntil || new Date(boost.noirUntil) <= new Date() ? "Noir üyeleri haftada bir kez kullanabilir." : !boost.eligible ? "Profilini görünür yap, Hayalet Modu kapat ve onaylı fotoğraf ekle." : "Uygun kişilerin keşfinde görünme şansın artar."}</small></div>{boost.canActivate ? <button type="button" className="primary-button" disabled={boostBusy} onClick={() => void activateBoost()}>{boostBusy ? "Başlatılıyor…" : "Başlat"}</button> : !boost.noirUntil || new Date(boost.noirUntil) <= new Date() ? <Link href="/noir">Noir</Link> : null}</div></div></section> : null}
        <section className="profile-hub-group">
          <h2 className="hub-group-title">Tercihler ve gizlilik</h2>
          <div className="hub-group-content">
            <NotificationControl liveMode={liveMode} />
            <div className="hub-divider" />
            <div className="hub-row-interactive">
              <span className="hub-row-icon">
                {discoverable ? <Eye size={16} /> : <EyeOff size={16} />}
              </span>
              <div className="hub-row-text">
                <strong>Keşfet görünürlüğü</strong>
                <small>
                  {discoverable
                    ? "Yeni kişiler profilini görebilir."
                    : "Yeni kişilere görünmezsin. Sohbetlerin devam eder."}
                </small>
              </div>
              <button
                type="button"
                className="hub-switch-btn"
                onClick={() => void toggleDiscoverable()}
                role="switch"
                aria-checked={discoverable}
                aria-label="Keşfet görünürlüğü"
                disabled={busy}
              >
                <i className={`switch ${discoverable ? "active" : ""}`}>
                  <b />
                </i>
              </button>
            </div>
            <div className="hub-divider" />
            <div className="hub-row-interactive">
              <span className="hub-row-icon"><EyeOff size={16} /></span>
              <div className="hub-row-text"><strong>Hayalet Modu</strong><small>{ghostAvailable ? "Yalnızca beğendiğin kişilere görün." : "Noir üyelerine özel."}</small></div>
              {ghostAvailable ? <button type="button" className="hub-switch-btn" role="switch" aria-checked={ghostEnabled} aria-label="Hayalet Modu" disabled={busy} onClick={() => void toggleGhost()}><i className={`switch ${ghostEnabled ? "active" : ""}`}><b /></i></button> : <Link href="/noir">Noir</Link>}
            </div>
          </div>
          {notice ? <p className="profile-feedback" role="status">{notice}</p> : null}
        </section>

        <section className="profile-hub-group">
          <h2 className="hub-group-title">Destek ve güvenlik</h2>
          <div className="hub-group-content">
            <SupportCenter liveMode={liveMode} />
            <BlockedProfiles liveMode={liveMode} />
            {viewer.isAdmin ? (
              <>
                <div className="hub-divider" />
                <Link href="/admin/lovask-control" className="hub-row-interactive hub-link-row">
                  <span className="hub-row-icon">
                    <LockKeyhole size={16} />
                  </span>
                  <div className="hub-row-text">
                    <strong>Yönetim alanı</strong>
                    <small>Lovask kontrol ve operasyon merkezini aç</small>
                  </div>
                  <ChevronRight size={16} className="hub-chevron-icon" />
                </Link>
              </>
            ) : null}
          </div>
        </section>

        <section className="profile-hub-group">
          <h2 className="hub-group-title">Hesap</h2>
          <div className="hub-group-content">
            <button
              type="button"
              className="hub-row-interactive hub-button-row"
              onClick={() => void signOut()}
              disabled={busy}
            >
              <span className="hub-row-icon">
                <LogOut size={16} />
              </span>
              <div className="hub-row-text">
                <strong>Oturumu kapat</strong>
                <small>Bu cihazdaki açık oturumunu sonlandır</small>
              </div>
              <ChevronRight size={16} className="hub-chevron-icon" />
            </button>

            <div className="hub-divider" />

            <Link className="hub-row-interactive hub-button-row" href="/sss">
              <span className="hub-row-icon"><HelpCircle size={16} /></span>
              <div className="hub-row-text">
                <strong>Yardım ve güvenlik</strong>
                <small>Sık sorulan sorular, güvenli tanışma ipuçları</small>
              </div>
              <ChevronRight size={16} className="hub-chevron-icon" />
            </Link>

            <div className="hub-divider" />

            <a className="hub-row-interactive hub-button-row" href="/api/profile/export" download>
              <span className="hub-row-icon"><Download size={16} /></span>
              <div className="hub-row-text">
                <strong>Verilerimi indir</strong>
                <small>Profilin, eşleşmelerin ve gönderdiğin mesajlar tek dosyada</small>
              </div>
              <ChevronRight size={16} className="hub-chevron-icon" />
            </a>

            <div className="hub-divider" />

            <button
              type="button"
              className="hub-row-interactive hub-button-row danger-row"
              onClick={() => { setConfirmation(""); setDeleteError(""); deleteDialog.current?.showModal(); }}
              disabled={busy}
            >
              <span className="hub-row-icon danger-icon">
                <Trash2 size={16} />
              </span>
              <div className="hub-row-text">
                <strong className="danger-text">Hesabımı sil</strong>
                <small>Hesabın ve verilerin kalıcı olarak kaldırılır.</small>
              </div>
              <ChevronRight size={16} className="hub-chevron-icon danger-icon" />
            </button>
          </div>
        </section>
      </div>

      <small className="profile-section-label">Üyelik ve hareketler</small>
      <div className="profile-vip-grid">
        <Link href="/noir" className="noir-entry">
          <span className="profile-row-icon"><Crown size={16} /></span>
          <div className="vip-copy">
            <strong>{viewer.isNoir ? "Noir Ayrıcalıkları" : "Noir'a Geç"}</strong>
            <small>{viewer.isNoir ? "Avantajların ve haftalık 30 dakika Boost" : "Aboneliksiz · Haftalık 30 dakika Boost"}</small>
          </div>
          <ChevronRight size={16} />
        </Link>
        <ProfileVisitors liveMode={liveMode} initialPremium={viewer.isNoir} />
      </div>
      <ReferralPanel liveMode={liveMode} />

      <dialog ref={deleteDialog} className="account-delete-dialog" aria-labelledby="delete-title" onCancel={(event) => { if (busy) event.preventDefault(); }}>
        <form onSubmit={(event) => { event.preventDefault(); void removeAccount(); }}>
          <Trash2 size={24} aria-hidden="true" />
          <h2 id="delete-title">Hesabını silmek istiyor musun?</h2>
          <p>Profilin hemen gizlenir ve 30 gün sonra kalıcı olarak silinir. Bu süre içinde hesabını geri alabilirsin.</p>
          <label>Onaylamak için <strong>HESABIMI SİL</strong> yaz.
            <input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" required />
          </label>
          {deleteError ? <p role="alert">{deleteError}</p> : null}
          <footer><button type="button" autoFocus disabled={busy} onClick={() => deleteDialog.current?.close()}>Vazgeç</button><button type="submit" disabled={busy || confirmation !== "HESABIMI SİL"}>{busy ? "Planlanıyor…" : "Hesabımı sil"}</button></footer>
        </form>
      </dialog>
    </motion.div>
  );
}

function ProfileVisitors({
  liveMode,
  initialPremium,
}: {
  liveMode: boolean;
  initialPremium: boolean;
}) {
  const [state, setState] = useState<{
    loading: boolean;
    premium: boolean;
    count: number;
    visitors: ProfileVisitor[];
  }>({
    loading: liveMode,
    premium: initialPremium,
    count: liveMode ? 0 : 8,
    visitors: [],
  });

  useEffect(() => {
    if (!liveMode) return;
    let active = true;
    void fetch("/api/profile/visitors", { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json().catch(() => ({}))) as {
          premium?: boolean;
          count?: number;
          visitors?: ProfileVisitor[];
        };
        if (active && response.ok) {
          setState({
            loading: false,
            premium: Boolean(result.premium),
            count: result.count ?? 0,
            visitors: result.visitors ?? [],
          });
        } else if (active) {
          setState((current) => ({ ...current, loading: false }));
        }
      })
      .catch(() => {
        if (active) setState((current) => ({ ...current, loading: false }));
      });
    return () => {
      active = false;
    };
  }, [liveMode]);

  return (
    <section className={`visitors-card ${state.premium ? "premium" : "locked"}`}>
      <div className="visitors-heading">
        <span className="profile-row-icon">
          <Eye size={16} />
        </span>
        <div>
          <small>Profil Ziyaretleri</small>
          <h3>Seni merak edenler</h3>
        </div>
        <b>{state.loading ? "…" : state.premium ? state.count : <LockKeyhole size={13} />}</b>
      </div>

      {state.loading ? (
        <div className="visitor-loading">
          <i />
          <i />
          <i />
        </div>
      ) : state.premium ? (
        state.visitors.length ? (
          <div className="visitor-list">
            {state.visitors.map((visitor) => (
              <div className="visitor" key={visitor.id}>
                <span>
                  <Image
                    src={visitor.image}
                    alt={visitor.name}
                    fill
                    sizes="48px"
                    unoptimized={visitor.image.startsWith("http")}
                  />
                </span>
                <div>
                  <strong>
                    {visitor.name}, {visitor.age}
                    {visitor.verified ? <BadgeCheck size={13} /> : null}
                  </strong>
                  <small>
                    {visitor.city} · {formatVisitTime(visitor.visitedAt)}
                  </small>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p>Henüz bir ziyaret yok. Profilin keşfette göründükçe burada belirecek.</p>
        )
      ) : (
        <Link className="visitor-lock" href="/noir">
          <div className="blurred-faces">
            <i />
            <i />
            <i />
          </div>
          <div>
            <strong>Ziyaretçilerin burada seni bekliyor</strong>
            <p>Noir ile ziyaretçilerinin isimlerini, fotoğraflarını ve ziyaret zamanını gör.</p>
          </div>
          <LockKeyhole size={16} />
        </Link>
      )}
    </section>
  );
}

function BlockedProfiles({ liveMode }: { liveMode: boolean }) {
  const [blocked, setBlocked] = useState<
    Array<{ blocked_id: string; profiles: { display_name: string } | null }>
  >([]);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!liveMode) return;
    try {
    const response = await fetch("/api/safety", { cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    if (response.ok) setBlocked(body.blocked ?? []);
    else setNotice("Engellenen profiller yüklenemedi.");
    } catch { setNotice("Engellenen profiller yüklenemedi. Bağlantını kontrol et."); }
  }, [liveMode]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const unblock = async (profileId: string) => {
    if (pending) return;
    setPending(profileId);
    setNotice("");
    try {
    const response = await fetch("/api/safety", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "unblock", targetProfileId: profileId }),
    });
    if (response.ok) setBlocked((current) => current.filter((item) => item.blocked_id !== profileId));
    else setNotice("Engel kaldırılamadı. Tekrar dene.");
    } catch { setNotice("Bağlantı kurulamadı. Engel kaldırılmadı."); }
    finally { setPending(null); }
  };

  if (!liveMode || (blocked.length === 0 && !notice)) return null;

  return (
    <>
      <div className="hub-divider" />
      <div className="hub-blocked-wrapper">
        <button
          type="button"
          className="hub-row-interactive hub-button-row"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <span className="hub-row-icon">
            <UserRound size={16} />
          </span>
          <div className="hub-row-text">
            <strong>Engellenen profiller</strong>
            <small>Engellediğin kullanıcıları yönet</small>
          </div>
          <div className="hub-row-action">
            <span className="hub-badge-count hub-badge-muted">{blocked.length}</span>
            <ChevronDown size={16} className={`hub-chevron-icon ${open ? "rotated" : ""}`} />
          </div>
        </button>

        {notice ? <p className="profile-feedback" role="status">{notice}</p> : null}
        {open ? (
          <div className="hub-blocked-list">
            {blocked.map((item) => (
              <div key={item.blocked_id} className="hub-blocked-item">
                <span>{item.profiles?.display_name ?? "Profil"}</span>
                <button type="button" disabled={pending !== null} onClick={() => void unblock(item.blocked_id)}>
                  {pending === item.blocked_id ? "Kaldırılıyor…" : "Engeli kaldır"}
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </>
  );
}

function formatVisitTime(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 2) return "Az önce";
  if (minutes < 60) return `${minutes} dk önce`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} sa önce`;
  return `${Math.floor(hours / 24)} gün önce`;
}
