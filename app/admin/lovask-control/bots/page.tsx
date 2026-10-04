"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bot,
  Camera,
  ChevronRight,
  Clock3,
  Cpu,
  LockKeyhole,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { AdminResourceNav } from "@/components/admin-resource-nav";
import { BotPhotoPool } from "@/components/bot-photo-pool";
import { PhotoCropper } from "@/components/photo-cropper";
import "../operations.css";
import "../admin-page.css";

type AdminBot = {
  id: string;
  name: string;
  age: number;
  active: boolean;
  image: string | null;
  badges: string[];
  automationEnabled: boolean;
  pendingJobs: number;
  failedJobs: number;
  needsReview: boolean;
  lastActivityAt: string;
};

type BotFilter = "all" | "active" | "draft" | "automation_off" | "review";
type StudioTab = "bots" | "photos" | "settings";

export default function BotsManagementPage() {
  const [activeTab, setActiveTab] = useState<StudioTab>(() => {
    if (typeof window === "undefined") return "bots";
    const hash = window.location.hash.toLowerCase();
    const tab = new URLSearchParams(window.location.search).get("tab")?.toLowerCase();
    return hash === "#photos" || tab === "photos" ? "photos" : hash === "#settings" || hash === "#ai" || tab === "settings" || tab === "ai" ? "settings" : "bots";
  });
  const [creating, setCreating] = useState(false);
  const [bots, setBots] = useState<AdminBot[]>([]);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<BotFilter>("all");
  const [selectedBots, setSelectedBots] = useState<string[]>([]);
  const [canDeleteBots, setCanDeleteBots] = useState(false);
  const [quickEditId, setQuickEditId] = useState<string | null>(null);
  const bulkRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);


  const loadBots = useCallback(async () => {
    const response = await fetch("/api/admin/bots", { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(data.error ?? "Botlar yüklenemedi.");
      return;
    }
    setBots(data.bots ?? []);
    setCanDeleteBots(Boolean(data.permissions?.canDeleteBots));
    setStatus("");
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadBots();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadBots]);

  const importBots = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])];
    if (!files.length) return;
    setStatus("Botlar içe aktarılıyor…");
    try {
      let imported = 0;
      for (const file of files) {
      const parsed = JSON.parse(await file.text()) as unknown;
      const bots = Array.isArray(parsed) ? parsed : parsed && typeof parsed === "object" && "bots" in parsed ? (parsed as { bots: unknown }).bots : null;
      if (!Array.isArray(bots) || !bots.length || bots.length > 100) throw new Error("JSON dosyasında 1–100 bot bulunmalı.");
      const response = await fetch("/api/admin/bots", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bots }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error ?? "İçe aktarım başarısız oldu.");
      imported += body.created?.length ?? 0;
      }
      await loadBots();
      setStatus(`${imported} bot içe aktarıldı.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "JSON dosyası okunamadı.");
    }
    if (bulkRef.current) bulkRef.current.value = "";
  };

  const filtered = bots.filter((profile) => {
    const matchesSearch =
      !search ||
      profile.name.toLowerCase().includes(search.toLowerCase()) ||
      profile.badges.some((badge) =>
        badge.toLowerCase().includes(search.toLowerCase()),
      );
    if (!matchesSearch) return false;
    if (filter === "active") return profile.active;
    if (filter === "draft") return !profile.active;
    if (filter === "automation_off") return !profile.automationEnabled;
    if (filter === "review") return profile.needsReview;
    return true;
  });

  const allVisibleSelected =
    filtered.length > 0 &&
    filtered.every((bot) => selectedBots.includes(bot.id));

  const toggleVisible = () => {
    if (allVisibleSelected) {
      const visibleIds = new Set(filtered.map((b) => b.id));
      setSelectedBots((curr) => curr.filter((id) => !visibleIds.has(id)));
    } else {
      const visibleIds = filtered.map((b) => b.id);
      setSelectedBots((curr) => Array.from(new Set([...curr, ...visibleIds])));
    }
  };

  const applyBulkAction = async (action: string) => {
    if (!selectedBots.length) return;
    setStatus("İşlem uygulanıyor…");
    if (action === "delete") {
      if (!confirm(`${selectedBots.length} bot kalıcı olarak silinecek. Emin misiniz?`)) return;
      const chunks = chunkIds(selectedBots, 500);
      let deleted = 0;
      for (const chunk of chunks) {
        const response = await fetch("/api/admin/bots", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: chunk, action: "delete" }) });
        const body = await response.json().catch(() => ({}));
        if (!response.ok) return setStatus(body.error ?? "Botlar silinemedi.");
        deleted += body.deleted ?? 0;
      }
      setSelectedBots([]);
      await loadBots();
      setStatus(`${deleted} bot silindi.`);
      return;
    }
    const response = await fetch("/api/admin/bots", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selectedBots, action }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return setStatus(body.error ?? "Toplu işlem tamamlanamadı.");
    setSelectedBots([]);
    await loadBots();
    setStatus("Toplu işlem tamamlandı.");
  };

  return (
    <main className="admin-stage">
      <AdminResourceNav />
      <section className="admin-main">
        <header>
          <div>
            <small>Yapay Zeka & Karakter Ekosistemi</small>
            <h1>Bot Stüdyosu</h1>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              className="admin-primary"
              onClick={() => setCreating(true)}
            >
              <Plus size={16} /> Yeni bot oluştur
            </button>
          </div>
        </header>

        {/* Stüdyo Sekme Navigasyonu */}
        <div className="studio-nav-bar">
          <div className="studio-tabs" role="tablist">
            <button
              type="button"
              className={activeTab === "bots" ? "studio-tab-btn active" : "studio-tab-btn"}
              onClick={() => {
                setActiveTab("bots");
                if (typeof window !== "undefined") window.location.hash = "bots";
              }}
              role="tab"
              aria-selected={activeTab === "bots"}
            >
              <Bot size={16} /> Bot Profilleri
              <span className="studio-tab-badge">{bots.length}</span>
            </button>
            <button
              type="button"
              className={activeTab === "photos" ? "studio-tab-btn active" : "studio-tab-btn"}
              onClick={() => {
                setActiveTab("photos");
                if (typeof window !== "undefined") window.location.hash = "photos";
              }}
              role="tab"
              aria-selected={activeTab === "photos"}
            >
              <Camera size={16} /> Fotoğraf Havuzu
            </button>
            <button
              type="button"
              className={activeTab === "settings" ? "studio-tab-btn active" : "studio-tab-btn"}
              onClick={() => {
                setActiveTab("settings");
                if (typeof window !== "undefined") window.location.hash = "settings";
              }}
              role="tab"
              aria-selected={activeTab === "settings"}
            >
              <Cpu size={16} /> Yapay Zekâ & Zamanlama
            </button>
          </div>

          <div className="studio-quick-stats">
            <span><b>{bots.filter((b) => b.active).length}</b> keşfette aktif</span>
            <span>·</span>
            <span><b>{bots.filter((b) => b.automationEnabled).length}</b> otomasyonda</span>
          </div>
        </div>

        {/* SEKME 1: Bot Profilleri */}
        {activeTab === "bots" ? (
          <div>
            <div className="bot-kpi-row">
              <div className="bot-kpi-card">
                <small>Toplam Karakter</small>
                <strong>{bots.length}</strong>
                <span>Kayıtlı bot profili</span>
              </div>
              <div className="bot-kpi-card">
                <small>Keşfette Aktif</small>
                <strong style={{ color: "#22c55e" }}>
                  {bots.filter((b) => b.active).length}
                </strong>
                <span>Kullanıcılar eşleşebilir</span>
              </div>
              <div className="bot-kpi-card">
                <small>Taslaklar</small>
                <strong>{bots.filter((b) => !b.active).length}</strong>
                <span>Keşfet kapalı</span>
              </div>
              <div className="bot-kpi-card">
                <small>İnceleme / Kapalı</small>
                <strong
                  style={{
                    color: bots.some((b) => b.needsReview) ? "#f59e0b" : "#9ca3af",
                  }}
                >
                  {bots.filter((b) => b.needsReview || !b.automationEnabled).length}
                </strong>
                <span>Dikkat gerektiren</span>
              </div>
            </div>

            <section className="admin-panel bots-panel" id="bot-studio">
              <div className="panel-head">
                <div>
                  <small>Karakter Listesi</small>
                  <h2>Bot Profilleri ({filtered.length})</h2>
                </div>
                <button onClick={() => bulkRef.current?.click()}>
                  <Upload size={15} /> JSON içe aktar
                </button>
                <input
                  ref={bulkRef}
                  className="visually-hidden"
                  type="file"
                  accept="application/json,.json"
                  multiple
                  onChange={importBots}
                />
              </div>

              <label className="admin-search">
                <Search size={16} />
                <input
                  ref={searchRef}
                  placeholder="Bot ara (isim, rozet)…"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>

              <div className="bot-filters" role="group" aria-label="Bot filtresi">
                {(
                  [
                    ["all", "Tümü"],
                    ["active", "Keşfette"],
                    ["draft", "Taslak"],
                    ["automation_off", "Otomasyonu kapalı"],
                    ["review", "İnceleme gerekli"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    type="button"
                    key={value}
                    className={filter === value ? "active" : ""}
                    onClick={() => setFilter(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <label className="bot-select-all">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleVisible}
                />
                <span>
                  {allVisibleSelected
                    ? "Görünenlerin seçimini kaldır"
                    : `Görünenlerin tümünü seç (${filtered.length})`}
                </span>
              </label>

              {selectedBots.length ? (
                <div className="bot-bulk-actions">
                  <b>{selectedBots.length} seçili</b>
                  <button onClick={() => void applyBulkAction("show")}>
                    Keşfete aç
                  </button>
                  <button onClick={() => void applyBulkAction("automation_on")}>
                    Otomasyonu aç
                  </button>
                  <button onClick={() => void applyBulkAction("automation_off")}>
                    Otomasyonu kapat
                  </button>
                  <button onClick={() => void applyBulkAction("hide")}>
                    Keşfetten kaldır
                  </button>
                  {canDeleteBots ? (
                    <button
                      className="danger"
                      onClick={() => void applyBulkAction("delete")}
                    >
                      <Trash2 size={13} /> Botları sil
                    </button>
                  ) : null}
                  <button onClick={() => setSelectedBots([])}>Seçimi temizle</button>
                </div>
              ) : null}

              {status ? <p className="admin-data-status">{status}</p> : null}

              {!status && filtered.length === 0 ? (
                <p className="admin-data-status">
                  {bots.length === 0
                    ? "Henüz bot yok. İlk karakteri oluşturarak keşfet destesini açabilirsin."
                    : "Arama veya filtre kriterlerine uygun bot bulunamadı."}
                </p>
              ) : null}

              {filtered.map((profile) => (
                <div className="bot-row" key={profile.id}>
                  <input
                    className="bot-select"
                    type="checkbox"
                    aria-label={`${profile.name} botunu seç`}
                    checked={selectedBots.includes(profile.id)}
                    onChange={(event) =>
                      setSelectedBots((current) =>
                        event.target.checked
                          ? [...current, profile.id]
                          : current.filter((id) => id !== profile.id),
                      )
                    }
                  />
                  <Link
                    className="bot-row-link"
                    href={`/admin/lovask-control/bots/${profile.id}`}
                  >
                    <span>
                      {profile.image ? (
                        <Image
                          src={profile.image}
                          alt=""
                          fill
                          sizes="40px"
                          unoptimized={profile.image.startsWith("http")}
                        />
                      ) : (
                        <Bot size={18} />
                      )}
                    </span>
                    <div>
                      <strong>
                        {profile.name}, {profile.age}
                      </strong>
                      <small>
                        {profile.badges.slice(0, 2).join(" · ") ||
                          "Rozet eklenmemiş"}
                      </small>
                    </div>
                    <span className="bot-row-meta">
                      <small>
                        {profile.pendingJobs
                          ? `${profile.pendingJobs} iş bekliyor`
                          : new Intl.DateTimeFormat("tr-TR", {
                              dateStyle: "short",
                            }).format(new Date(profile.lastActivityAt))}
                      </small>
                      <i className={profile.needsReview ? "review" : ""}>
                        {profile.needsReview
                          ? "İncele"
                          : !profile.automationEnabled
                          ? "Otomasyon kapalı"
                          : profile.active
                          ? "Aktif"
                          : "Taslak"}
                      </i>
                    </span>
                    <ChevronRight size={15} />
                  </Link>
                  <button className="bot-quick-edit" type="button" onClick={() => setQuickEditId(profile.id)} aria-label={`${profile.name} hızlı düzenle`} title="Hızlı düzenle"><Pencil size={15} /></button>
                </div>
              ))}
            </section>
          </div>
        ) : null}

        {/* SEKME 2: Fotoğraf Havuzu */}
        {activeTab === "photos" ? (
          <BotPhotoPool onAssigned={loadBots} />
        ) : null}

        {/* SEKME 3: Yapay Zekâ & Zamanlama Ayarları */}
        {activeTab === "settings" ? (
          <div className="studio-settings-grid">
            <section className="admin-panel">
              <div className="panel-head">
                <div>
                  <small>Motor & Dil Modeli</small>
                  <h2>Yapay Zekâ Sağlayıcıları ve Prompt</h2>
                </div>
              </div>
              <AiProviderPanel />
            </section>

            <section className="admin-panel">
              <div className="panel-head">
                <div>
                  <small>Davranış & Tempo</small>
                  <h2>Doğal Zamanlama ve Fallback</h2>
                </div>
              </div>
              <AutomationPanel />
              <div style={{ marginTop: "16px" }}>
                <FallbackPanel />
              </div>
              <div className="health" style={{ marginTop: "16px" }}>
                <LockKeyhole size={17} />
                <span>
                  Bot Altyapısı
                  <b>Doğal gecikme & anti-spam devrede</b>
                </span>
                <i />
              </div>
            </section>
          </div>
        ) : null}
      </section>

      {creating ? (
        <BotModal onClose={() => setCreating(false)} onSaved={loadBots} />
      ) : null}
      {quickEditId ? <QuickBotEdit profileId={quickEditId} onClose={() => setQuickEditId(null)} onSaved={loadBots} /> : null}
    </main>
  );
}

function chunkIds<T>(ids: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < ids.length; index += size) {
    chunks.push(ids.slice(index, index + size));
  }
  return chunks;
}

type QuickBotPayload = { name: string; birthDate: string; gender: string; city: string; badges: string[]; prompt: string; answer: string; discoverable: boolean };

function QuickBotEdit({ profileId, onClose, onSaved }: { profileId: string; onClose: () => void; onSaved: () => Promise<void> }) {
  const [profile, setProfile] = useState<QuickBotPayload | null>(null);
  const [status, setStatus] = useState("Bot bilgileri yükleniyor…");
  const [saving, setSaving] = useState(false);
  useEffect(() => { void fetch(`/api/admin/bots/${profileId}/profile`, { cache: "no-store" }).then(async (response) => { const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error ?? "Bot yüklenemedi."); setProfile(body.profile); setStatus(""); }).catch((error) => setStatus(error instanceof Error ? error.message : "Bot yüklenemedi.")); }, [profileId]);
  const save = async (event: FormEvent) => {
    event.preventDefault(); if (!profile) return; setSaving(true); setStatus("Kaydediliyor…");
    const response = await fetch(`/api/admin/bots/${profileId}/profile`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profile) });
    const body = await response.json().catch(() => ({})); setSaving(false);
    if (!response.ok) return setStatus(body.error ?? "Kaydedilemedi.");
    await onSaved(); onClose();
  };
  return <div className="admin-modal-backdrop" onClick={onClose}><div className="bot-modal quick-edit-modal" onClick={(event) => event.stopPropagation()}><header><div><small>Hızlı düzenleme</small><h2>Bot profilini güncelle</h2></div><button type="button" onClick={onClose}>×</button></header>{profile ? <form onSubmit={save} className="quick-edit-form"><label>Ad<input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} required /></label><label>Şehir<input value={profile.city} onChange={(event) => setProfile({ ...profile, city: event.target.value })} /></label><label>Cinsiyet<input value={profile.gender} onChange={(event) => setProfile({ ...profile, gender: event.target.value })} required /></label><label className="quick-edit-check"><input type="checkbox" checked={profile.discoverable} onChange={(event) => setProfile({ ...profile, discoverable: event.target.checked })} /> Keşfette göster</label><footer><button type="button" onClick={onClose}>İptal</button><button className="admin-primary" disabled={saving}>{saving ? "Kaydediliyor…" : "Kaydet"}</button></footer></form> : <p>{status}</p>}{status && profile ? <p className="admin-data-status">{status}</p> : null}</div></div>;
}

type AutomationForm = {
  automationEnabled: boolean;
  minReplyDelaySeconds: number;
  maxReplyDelaySeconds: number;
  typingMinSeconds: number;
  typingMaxSeconds: number;
  bundleWindowSeconds: number;
  bundleMaxSeconds: number;
  firstMessageEnabled: boolean;
  firstMessageMinSeconds: number;
  firstMessageMaxSeconds: number;
  followUpEnabled: boolean;
  followUpMinSeconds: number;
  followUpMaxSeconds: number;
  phase1TimingEnabled: boolean;
  phase2BehaviorEnabled: boolean;
  phase3SafetyEnabled: boolean;
  memoryEnabled: boolean;
  dailyStateEnabled: boolean;
};

const automationDefaults: AutomationForm = {
  automationEnabled: true,
  minReplyDelaySeconds: 20,
  maxReplyDelaySeconds: 90,
  typingMinSeconds: 3,
  typingMaxSeconds: 12,
  bundleWindowSeconds: 12,
  bundleMaxSeconds: 45,
  firstMessageEnabled: true,
  firstMessageMinSeconds: 120,
  firstMessageMaxSeconds: 900,
  followUpEnabled: true,
  followUpMinSeconds: 43200,
  followUpMaxSeconds: 129600,
  phase1TimingEnabled: true,
  phase2BehaviorEnabled: true,
  phase3SafetyEnabled: true,
  memoryEnabled: true,
  dailyStateEnabled: true,
};

function AutomationPanel() {
  const [values, setValues] = useState(automationDefaults);
  const [status, setStatus] = useState("Yükleniyor…");

  useEffect(() => {
    let active = true;
    void fetch("/api/admin/bot-automation", { cache: "no-store" }).then(
      async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!active) return;
        if (!response.ok) return setStatus(data.error ?? "Ayarlar yüklenemedi.");
        const row = data.settings;
        setValues({
          automationEnabled: row.automation_enabled,
          minReplyDelaySeconds: row.min_reply_delay_seconds,
          maxReplyDelaySeconds: row.max_reply_delay_seconds,
          typingMinSeconds: row.typing_min_seconds,
          typingMaxSeconds: row.typing_max_seconds,
          bundleWindowSeconds: row.bundle_window_seconds,
          bundleMaxSeconds: row.bundle_max_seconds,
          firstMessageEnabled: row.first_message_enabled,
          firstMessageMinSeconds: row.first_message_min_seconds,
          firstMessageMaxSeconds: row.first_message_max_seconds,
          followUpEnabled: row.follow_up_enabled,
          followUpMinSeconds: row.follow_up_min_seconds,
          followUpMaxSeconds: row.follow_up_max_seconds,
          phase1TimingEnabled: row.phase1_timing_enabled,
          phase2BehaviorEnabled: row.phase2_behavior_enabled,
          phase3SafetyEnabled: row.phase3_safety_enabled,
          memoryEnabled: row.memory_enabled,
          dailyStateEnabled: row.daily_state_enabled,
        });
        setStatus("");
      },
    );
    return () => {
      active = false;
    };
  }, []);

  const number =
    (key: keyof AutomationForm) => (event: ChangeEvent<HTMLInputElement>) => {
      setValues((current) => ({
        ...current,
        [key]: Number(event.target.value),
      }));
    };

  const save = async () => {
    setStatus("Kaydediliyor…");
    const response = await fetch("/api/admin/bot-automation", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = await response.json().catch(() => ({}));
    setStatus(
      response.ok
        ? "Zamanlama ayarları kaydedildi."
        : data.error ?? "Ayarlar kaydedilemedi.",
    );
  };

  return (
    <section className="automation-panel">
      <header>
        <span>
          <Clock3 size={15} />
        </span>
        <div>
          <small>Doğal tempo</small>
          <strong>Bot zamanlaması</strong>
        </div>
        <button
          type="button"
          className={values.automationEnabled ? "mini-switch active" : "mini-switch"}
          onClick={() =>
            setValues((current) => ({
              ...current,
              automationEnabled: !current.automationEnabled,
            }))
          }
          aria-label="Bot otomasyonunu aç veya kapat"
        >
          <i />
        </button>
      </header>
      <div className="automation-pairs">
        <div className="phase-flags">
          <PhaseFlag
            label="Faz 1 · Zamanlama"
            active={values.phase1TimingEnabled}
            onChange={() =>
              setValues((current) => ({
                ...current,
                phase1TimingEnabled: !current.phase1TimingEnabled,
              }))
            }
          />
          <PhaseFlag
            label="Faz 2 · Davranış"
            active={values.phase2BehaviorEnabled}
            onChange={() =>
              setValues((current) => ({
                ...current,
                phase2BehaviorEnabled: !current.phase2BehaviorEnabled,
              }))
            }
          />
          <PhaseFlag
            label="Faz 3 · Güvenlik"
            active={values.phase3SafetyEnabled}
            onChange={() =>
              setValues((current) => ({
                ...current,
                phase3SafetyEnabled: !current.phase3SafetyEnabled,
              }))
            }
          />
          <PhaseFlag
            label="Hafıza"
            active={values.memoryEnabled}
            onChange={() => setValues((current) => ({ ...current, memoryEnabled: !current.memoryEnabled }))}
          />
          <PhaseFlag
            label="Günlük durum"
            active={values.dailyStateEnabled}
            onChange={() => setValues((current) => ({ ...current, dailyStateEnabled: !current.dailyStateEnabled }))}
          />
        </div>
        <label>
          <span>Yanıt gecikmesi</span>
          <div>
            <input
              type="number"
              min="3"
              value={values.minReplyDelaySeconds}
              onChange={number("minReplyDelaySeconds")}
            />
            <b>–</b>
            <input
              type="number"
              min="3"
              value={values.maxReplyDelaySeconds}
              onChange={number("maxReplyDelaySeconds")}
            />
            <em>sn</em>
          </div>
        </label>
        <label>
          <span>Yazıyor görünümü</span>
          <div>
            <input
              type="number"
              min="1"
              value={values.typingMinSeconds}
              onChange={number("typingMinSeconds")}
            />
            <b>–</b>
            <input
              type="number"
              min="1"
              value={values.typingMaxSeconds}
              onChange={number("typingMaxSeconds")}
            />
            <em>sn</em>
          </div>
        </label>
        <label>
          <span>Mesaj birleştirme</span>
          <div>
            <input
              type="number"
              min="1"
              value={values.bundleWindowSeconds}
              onChange={number("bundleWindowSeconds")}
            />
            <b>/</b>
            <input
              type="number"
              min="5"
              value={values.bundleMaxSeconds}
              onChange={number("bundleMaxSeconds")}
            />
            <em>sn</em>
          </div>
        </label>
        <label>
          <span>
            <input
              className="inline-check"
              type="checkbox"
              checked={values.firstMessageEnabled}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  firstMessageEnabled: event.target.checked,
                }))
              }
            />{" "}
            İlk mesaj
          </span>
          <div>
            <input
              type="number"
              min="15"
              value={values.firstMessageMinSeconds}
              onChange={number("firstMessageMinSeconds")}
            />
            <b>–</b>
            <input
              type="number"
              min="15"
              value={values.firstMessageMaxSeconds}
              onChange={number("firstMessageMaxSeconds")}
            />
            <em>sn</em>
          </div>
        </label>
        <label>
          <span>
            <input
              className="inline-check"
              type="checkbox"
              checked={values.followUpEnabled}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  followUpEnabled: event.target.checked,
                }))
              }
            />{" "}
            Tek takip
          </span>
          <div>
            <input
              type="number"
              min="3600"
              step="3600"
              value={values.followUpMinSeconds}
              onChange={number("followUpMinSeconds")}
            />
            <b>–</b>
            <input
              type="number"
              min="3600"
              step="3600"
              value={values.followUpMaxSeconds}
              onChange={number("followUpMaxSeconds")}
            />
            <em>sn</em>
          </div>
        </label>
      </div>
      <footer>
        <small>{status || "Tüm botlar bu varsayılanları kullanır."}</small>
        <button onClick={save}>Kaydet</button>
      </footer>
    </section>
  );
}

function PhaseFlag({
  label,
  active,
  onChange,
}: {
  label: string;
  active: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      className={active ? "phase-flag active" : "phase-flag"}
      onClick={onChange}
    >
      <i />
      {label}
      <b>{active ? "Açık" : "Kapalı"}</b>
    </button>
  );
}

type FallbackTemplate = { id: string; body: string; is_active: boolean };

function FallbackPanel() {
  const [templates, setTemplates] = useState<FallbackTemplate[]>([]);
  const [body, setBody] = useState("");
  const [status, setStatus] = useState("Fallback metinleri yükleniyor…");

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/bot-fallbacks", {
      cache: "no-store",
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok)
      return setStatus(data.error ?? "Fallback metinleri yüklenemedi.");
    setTemplates(data.templates ?? []);
    setStatus("");
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const add = async (event: FormEvent) => {
    event.preventDefault();
    const response = await fetch("/api/admin/bot-fallbacks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setStatus(data.error ?? "Fallback eklenemedi.");
    setBody("");
    await load();
    setStatus("Fallback eklendi.");
  };

  const toggle = async (template: FallbackTemplate) => {
    const response = await fetch("/api/admin/bot-fallbacks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: template.id, isActive: !template.is_active }),
    });
    if (response.ok) await load();
    else setStatus("Fallback güncellenemedi.");
  };

  const remove = async (id: string) => {
    const response = await fetch(
      `/api/admin/bot-fallbacks?id=${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
    if (response.ok) await load();
    else setStatus("Fallback silinemedi.");
  };

  return (
    <section className="fallback-panel">
      <header>
        <small>Kesinti anı</small>
        <strong>Doğal fallback metinleri</strong>
      </header>
      <div>
        {templates.map((template) => (
          <article
            key={template.id}
            className={template.is_active ? "active" : ""}
          >
            <button type="button" onClick={() => void toggle(template)}>
              <i />
              {template.body}
            </button>
            <button
              type="button"
              aria-label="Fallback metnini sil"
              onClick={() => void remove(template.id)}
            >
              <Trash2 size={12} />
            </button>
          </article>
        ))}
      </div>
      <form onSubmit={add}>
        <input
          value={body}
          onChange={(event) => setBody(event.target.value)}
          minLength={3}
          maxLength={240}
          placeholder="Örn. Bir işim çıktı, birazdan döneceğim."
          required
        />
        <button>Ekle</button>
      </form>
      <small>
        {status ||
          `${templates.filter((item) => item.is_active).length} aktif metin`}
      </small>
    </section>
  );
}

function AiProviderPanel() {
  const [provider, setProvider] = useState("gemini");
  const [status, setStatus] = useState("");
  const [tests, setTests] = useState<
    Array<{
      provider: string;
      ok: boolean;
      latencyMs: number;
      model?: string;
      sample?: string;
      error?: string;
    }>
  >([]);
  const [configured, setConfigured] = useState<Record<string, boolean>>({});
  const [models] = useState({
    openai: "gpt-4o-mini",
    openrouter: "anthropic/claude-3.5-haiku",
    deepseek: "deepseek-chat",
    gemini: "gemini-2.5-flash",
  });
  const [globalPrompt, setGlobalPrompt] = useState("");
  const [knowledge, setKnowledge] = useState("");
  const [toneGuide, setToneGuide] = useState<{
    source: string;
    categoryCount: number;
    mode: string;
  } | null>(null);

  useEffect(() => {
    void fetch("/api/admin/ai-settings", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => {
        if (data.settings?.default_provider) {
          setProvider(data.settings.default_provider);
          setGlobalPrompt(
            data.settings.global_system_prompt ??
              "Türkçe konuşma dilini kullan. Resmî ve robotik cümlelerden kaçın; bağlama göre sıcak, kısa ve doğal cevap ver.",
          );
          setKnowledge(data.settings.global_knowledge ?? "");
          setConfigured(data.configured ?? {});
          setToneGuide(data.toneGuide ?? null);
        }
      });
  }, []);

  const save = async () => {
    setStatus("Kaydediliyor…");
    const response = await fetch("/api/admin/ai-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        defaultProvider: provider,
        fallbackOrder: ["gemini", "deepseek", "openrouter", "openai"].filter(
          (item) => item !== provider,
        ),
        openaiModel: models.openai,
        openrouterModel: models.openrouter,
        deepseekModel: models.deepseek,
        geminiModel: models.gemini,
        globalSystemPrompt: globalPrompt,
        globalKnowledge: knowledge,
      }),
    });
    setStatus(response.ok ? "Kaydedildi" : "Ayar kaydedilemedi");
  };

  const testProviders = async () => {
    setStatus("Sağlayıcılar test ediliyor…");
    setTests([]);
    const response = await fetch("/api/admin/ai-settings", { method: "POST" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return setStatus(body.error ?? "Bağlantı testi yapılamadı.");
    setTests(body.tests ?? []);
    setConfigured(body.configured ?? configured);
    setStatus("Canlı bağlantı testi tamamlandı.");
  };

  return (
    <div className="ai-provider-panel">
      <small>AI yönlendirme ve genel bot aklı</small>
      <div className="provider-health">
        {["openai", "openrouter", "deepseek", "gemini"].map((item) => (
          <i className={configured[item] ? "configured" : ""} key={item}>
            {item}
            <b>{configured[item] ? "Anahtar var" : "Eksik"}</b>
          </i>
        ))}
      </div>
      <div>
        <select
          value={provider}
          onChange={(event) => setProvider(event.target.value)}
        >
          <option value="openai">OpenAI</option>
          <option value="openrouter">OpenRouter</option>
          <option value="deepseek">DeepSeek</option>
          <option value="gemini">Gemini</option>
        </select>
        <button type="button" onClick={save}>
          Uygula
        </button>
      </div>
      <label className="global-ai-field">
        Genel prompt
        <textarea
          value={globalPrompt}
          onChange={(event) => setGlobalPrompt(event.target.value)}
          minLength={20}
          maxLength={12000}
        />
        <small>
          Tüm bot personalarının üstüne uygulanır. Türkçe ağız, ton ve ortak
          davranışları burada belirle.
        </small>
      </label>
      <label className="global-ai-field">
        Ortak bilgi tabanı / RAG bağlamı
        <textarea
          value={knowledge}
          onChange={(event) => setKnowledge(event.target.value)}
          maxLength={20000}
          placeholder="Lovask kuralları, üyelik bilgileri, cevaplanabilecek ortak bilgiler…"
        />
        <small>
          Bot yalnızca gerektiğinde bu bilgiyi kullanır; bilmediğini uydurmaması
          istenir.
        </small>
      </label>
      {toneGuide ? (
        <p className="tone-guide-status">
          <strong>Akıllı konuşma rehberi aktif</strong>
          <small>
            {toneGuide.source} · {toneGuide.categoryCount} duygu tonu ·{" "}
            {toneGuide.mode}
          </small>
        </p>
      ) : null}
      <button className="provider-test" type="button" onClick={testProviders}>
        Dört sağlayıcıyı canlı test et
      </button>
      {tests.length ? (
        <div className="provider-test-results">
          {tests.map((test) => (
            <p className={test.ok ? "ok" : "failed"} key={test.provider}>
              <strong>
                {test.provider} · {test.ok ? "Çalışıyor" : "Hata"}
              </strong>
              <small>
                {test.latencyMs} ms · {test.model ?? test.error}
              </small>
              {test.sample ? <em>&ldquo;{test.sample}&rdquo;</em> : null}
            </p>
          ))}
        </div>
      ) : null}
      <span>{status || "Birincil sağlayıcı · otomatik yedekli"}</span>
    </div>
  );
}

function BotModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [cropSource, setCropSource] = useState<File | null>(null);
  const [error, setError] = useState("");
  const photoRef = useRef<HTMLInputElement>(null);

  const setCroppedPhoto = (file: File) => {
    setPhoto(file);
    setCropSource(null);
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") setPreview(reader.result);
    });
    reader.readAsDataURL(file);
  };

  const handlePhotoSelect = (file: File) => {
    const isHeic =
      file.type === "image/heic" ||
      file.name.toLowerCase().endsWith(".heic") ||
      file.name.toLowerCase().endsWith(".heif");
    if (isHeic) {
      setPhoto(file);
      setPreview("");
      return;
    }
    setCropSource(file);
  };

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setError("");
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const age = Number(form.get("age") ?? 0);
    const gender = String(form.get("gender") ?? "kadın");
    const city = String(form.get("city") ?? "İstanbul").trim();
    const bio = String(form.get("bio") ?? "").trim();
    const occupation = String(form.get("occupation") ?? "").trim();
    const badges = String(form.get("badges") ?? "")
      .split(",")
      .map((b) => b.trim())
      .filter(Boolean);
    const prompt = String(form.get("prompt") ?? "").trim();

    if (!photo) return setError("Lütfen bir profil fotoğrafı seçin.");
    if (!name || !age || !bio || !prompt)
      return setError("Lütfen tüm zorunlu alanları doldurun.");

    setSaving(true);
    try {
      const botRes = await fetch("/api/admin/bots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          age,
          gender,
          city,
          badges,
          persona: `${bio}${occupation ? `\nMeslek: ${occupation}` : ""}\n${prompt}`,
          provider: "inherit",
          model: "gpt-5.6-luna",
        }),
      });
      const botJson = await botRes.json().catch(() => ({}));
      if (!botRes.ok) throw new Error(botJson.error ?? "Bot oluşturulamadı.");
      const profileId = botJson.created?.[0];
      if (!profileId) throw new Error("Bot kimliği alınamadı.");
      const uploadData = new FormData();
      uploadData.append("profileId", profileId);
      uploadData.append("photo", photo);
      const photoRes = await fetch("/api/admin/bots/photo", { method: "POST", body: uploadData });
      const photoJson = await photoRes.json().catch(() => ({}));
      if (!photoRes.ok) throw new Error(photoJson.error ?? "Fotoğraf yüklenemedi.");

      await onSaved();
      onClose();
      router.push(`/admin/lovask-control/bots/${profileId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bir hata oluştu.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-modal-backdrop" onClick={onClose}>
      <div className="bot-modal" onClick={(e) => e.stopPropagation()}>
        <header>
          <div>
            <small>Yeni Karakter</small>
            <h2>Bot Oluştur</h2>
          </div>
          <button onClick={onClose}>×</button>
        </header>

        {error ? <p style={{ color: "#ef4444", margin: "0 0 16px" }}>{error}</p> : null}

        <form onSubmit={save}>
          <div className="bot-form-grid">
            <div>
              <div
                className={`bot-photo ${preview ? "has-preview" : ""}`}
                onClick={() => photoRef.current?.click()}
                style={{ cursor: "pointer" }}
              >
                {preview ? (
                  <Image src={preview} alt="Önizleme" fill sizes="180px" />
                ) : (
                  <>
                    <span>Fotoğraf Seç</span>
                    <small>1:1 Kare veya dikey</small>
                  </>
                )}
              </div>
              <input
                ref={photoRef}
                type="file"
                accept="image/*,.heic,.heif"
                className="visually-hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handlePhotoSelect(file);
                }}
              />
            </div>

            <div style={{ display: "grid", gap: "10px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "8px" }}>
                <input name="name" placeholder="İsim *" required style={{ height: "36px", padding: "0 10px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.1)", background: "#0d0e12", color: "#fff" }} />
                <input name="age" type="number" min="18" max="99" placeholder="Yaş *" required style={{ height: "36px", padding: "0 10px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.1)", background: "#0d0e12", color: "#fff" }} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <select name="gender" defaultValue="kadın" style={{ height: "36px", padding: "0 10px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.1)", background: "#0d0e12", color: "#fff" }}>
                  <option value="kadın">Kadın</option>
                  <option value="erkek">Erkek</option>
                </select>
                <input name="city" defaultValue="İstanbul" placeholder="Şehir *" required style={{ height: "36px", padding: "0 10px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.1)", background: "#0d0e12", color: "#fff" }} />
              </div>

              <input name="occupation" placeholder="Meslek" style={{ height: "36px", padding: "0 10px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.1)", background: "#0d0e12", color: "#fff" }} />
              <input name="badges" placeholder="Rozetler (virgülle ayırın: Spor, Kahve, Sinema)" style={{ height: "36px", padding: "0 10px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.1)", background: "#0d0e12", color: "#fff" }} />
              <textarea name="bio" placeholder="Biyografi *" required rows={3} style={{ padding: "8px 10px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.1)", background: "#0d0e12", color: "#fff", resize: "vertical" }} />
              
              <div className="persona-field">
                <textarea name="prompt" placeholder="Karakter Persona Promptu (nasıl konuşur, ilgi alanları, tavrı) *" required rows={4} style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.1)", background: "#0d0e12", color: "#fff", resize: "vertical" }} />
              </div>
            </div>
          </div>

          <footer style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "16px" }}>
            <button type="button" onClick={onClose} style={{ height: "36px", padding: "0 14px", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.1)", background: "#1c1e24", color: "#d1d5db", cursor: "pointer" }}>İptal</button>
            <button type="submit" disabled={saving} style={{ height: "36px", padding: "0 16px", borderRadius: "6px", border: "1px solid #991b1b", background: "#991b1b", color: "#fff", cursor: "pointer" }}>{saving ? "Kaydediliyor…" : "Karakteri Oluştur"}</button>
          </footer>
        </form>

        {cropSource ? (
          <PhotoCropper
            file={cropSource}
            remaining={1}
            onConfirm={setCroppedPhoto}
            onCancel={() => setCropSource(null)}
          />
        ) : null}
      </div>
    </div>
  );
}
