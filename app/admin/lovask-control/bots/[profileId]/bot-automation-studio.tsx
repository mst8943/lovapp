"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Bot, Check, Clock3, FlaskConical, ImagePlus, LoaderCircle, Radio, Save, Sparkles, TimerReset, UserRound } from "lucide-react";
import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { AdminResourceNav } from "@/components/admin-resource-nav";
import "./bot-automation-studio.css";

type Schedule = Record<string, [string, string][]>;
type SettingsRow = {
  automation_enabled: boolean | null;
  min_reply_delay_seconds: number | null;
  max_reply_delay_seconds: number | null;
  typing_min_seconds: number | null;
  typing_max_seconds: number | null;
  bundle_window_seconds: number | null;
  bundle_max_seconds: number | null;
  timezone: string | null;
  weekly_schedule: Schedule | null;
  presence_override: "auto" | "online" | "offline";
  first_message_enabled: boolean | null;
  first_message_min_seconds: number | null;
  first_message_max_seconds: number | null;
  follow_up_enabled: boolean | null;
  follow_up_min_seconds: number | null;
  follow_up_max_seconds: number | null;
};
type Job = { id: string; status: string; scheduled_for: string; created_at: string; last_error: string | null };
type Payload = { profile: { id: string; display_name: string; is_discoverable: boolean }; settings: SettingsRow | null; global: SettingsRow; jobs: Job[]; experiments: { id: string; name: string; status: string; traffic_percent: number; winner_variant?: string | null; published_at?: string | null }[]; experimentMetrics: { variant: string; sent: number; replied: number; replyRate: number; safetyEvents: number }[]; metrics: { queued: number; sent: number; failed: number; firstMessages: number; followUps: number; averageDelaySeconds: number } };

const days = [["1","Pzt"],["2","Sal"],["3","Çar"],["4","Per"],["5","Cum"],["6","Cmt"],["0","Paz"]] as const;

export function BotAutomationStudio({ profileId }: { profileId: string }) {
  const [activeTab, setActiveTab] = useState<"profile" | "persona" | "behavior" | "presence" | "experiments" | "jobs">("profile");
  const [dirty, setDirty] = useState(false);
  const [data, setData] = useState<Payload | null>(null);
  const [customTiming, setCustomTiming] = useState(false);
  const [customSchedule, setCustomSchedule] = useState(false);
  const [customProactive, setCustomProactive] = useState(false);
  const [values, setValues] = useState<SettingsRow | null>(null);
  const [status, setStatus] = useState("Bot davranışı yükleniyor…");
  const load = useCallback(async () => {
    const response = await fetch(`/api/admin/bots/${profileId}/automation`, { cache: "no-store" });
    const next = await response.json().catch(() => ({}));
    if (!response.ok) return setStatus(next.error ?? "Bot ayarları yüklenemedi.");
    const settings = next.settings as SettingsRow | null;
    setData(next);
    setCustomTiming(Boolean(settings && settings.min_reply_delay_seconds !== null));
    setCustomSchedule(Boolean(settings?.weekly_schedule));
    setCustomProactive(Boolean(settings && settings.first_message_enabled !== null));
    setValues(settings ?? { automation_enabled: null, min_reply_delay_seconds: null, max_reply_delay_seconds: null, typing_min_seconds: null, typing_max_seconds: null, bundle_window_seconds: null, bundle_max_seconds: null, timezone: null, weekly_schedule: null, presence_override: "auto", first_message_enabled: null, first_message_min_seconds: null, first_message_max_seconds: null, follow_up_enabled: null, follow_up_min_seconds: null, follow_up_max_seconds: null });
    setDirty(false);
    setStatus("");
  }, [profileId]);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  if (!data || !values) return <main className="ops-stage bot-stage"><AdminResourceNav /><div className="bot-studio loading"><LoaderCircle className="spin" /><p>{status}</p></div></main>;
  const effective = (key: keyof SettingsRow) => values[key] ?? data.global[key];
  const setNumber = (key: keyof SettingsRow) => (event: ChangeEvent<HTMLInputElement>) => { setDirty(true); setValues((current) => current ? { ...current, [key]: Number(event.target.value) } : current); };
  const schedule = (customSchedule ? values.weekly_schedule : data.global.weekly_schedule) ?? {};
  const updateDay = (day: string, edge: 0 | 1, value: string) => {
    const base = structuredClone(schedule);
    const range = base[day]?.[0] ?? ["09:00", "23:30"];
    range[edge] = value;
    base[day] = [range];
    setValues((current) => current ? { ...current, weekly_schedule: base } : current);
    setCustomSchedule(true);
    setDirty(true);
  };
  const save = async () => {
    setStatus("Kaydediliyor…");
    const body = {
      automationEnabled: values.automation_enabled,
      minReplyDelaySeconds: customTiming ? Number(effective("min_reply_delay_seconds")) : null,
      maxReplyDelaySeconds: customTiming ? Number(effective("max_reply_delay_seconds")) : null,
      typingMinSeconds: customTiming ? Number(effective("typing_min_seconds")) : null,
      typingMaxSeconds: customTiming ? Number(effective("typing_max_seconds")) : null,
      bundleWindowSeconds: customTiming ? Number(effective("bundle_window_seconds")) : null,
      bundleMaxSeconds: customTiming ? Number(effective("bundle_max_seconds")) : null,
      timezone: customSchedule ? values.timezone ?? String(data.global.timezone) : null,
      weeklySchedule: customSchedule ? schedule : null,
      presenceOverride: values.presence_override,
      firstMessageEnabled: customProactive ? Boolean(effective("first_message_enabled")) : null,
      firstMessageMinSeconds: customProactive ? Number(effective("first_message_min_seconds")) : null,
      firstMessageMaxSeconds: customProactive ? Number(effective("first_message_max_seconds")) : null,
      followUpEnabled: customProactive ? Boolean(effective("follow_up_enabled")) : null,
      followUpMinSeconds: customProactive ? Number(effective("follow_up_min_seconds")) : null,
      followUpMaxSeconds: customProactive ? Number(effective("follow_up_max_seconds")) : null,
    };
    const response = await fetch(`/api/admin/bots/${profileId}/automation`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json().catch(() => ({}));
    setStatus(response.ok ? "Bot davranışı kaydedildi." : result.error ?? "Ayarlar kaydedilemedi.");
    if (response.ok) await load();
  };

  return <main className="ops-stage bot-stage"><AdminResourceNav /><div className="bot-studio">
    <aside>
      <Link href="/admin/lovask-control/bots"><ArrowLeft size={15} /> Bot stüdyosu</Link>
      <span className="studio-avatar"><Bot size={25} /></span>
      <small>Davranış çalışma alanı</small>
      <h1>{data.profile.display_name}</h1>
      <p>{data.profile.is_discoverable ? "Keşfette aktif" : "Taslak profil"}</p>
      <label className="bot-automation-switch">Otomasyon
        <select value={values.automation_enabled === null ? "inherit" : values.automation_enabled ? "on" : "off"} onChange={(event) => setValues((current) => current ? { ...current, automation_enabled: event.target.value === "inherit" ? null : event.target.value === "on" } : current)}>
          <option value="inherit">Sistem ayarı</option><option value="on">Bu botta açık</option><option value="off">Bu botta kapalı</option>
        </select>
      </label>
      <nav><button className={activeTab === "profile" ? "active" : ""} onClick={() => setActiveTab("profile")}><UserRound size={15}/> Profil</button><button className={activeTab === "persona" ? "active" : ""} onClick={() => setActiveTab("persona")}><FlaskConical size={15}/> Persona</button><button className={activeTab === "behavior" ? "active" : ""} onClick={() => setActiveTab("behavior")}><Clock3 size={15} /> Davranış</button><button className={activeTab === "presence" ? "active" : ""} onClick={() => setActiveTab("presence")}><Radio size={15} /> Aktif saatler</button><button className={activeTab === "experiments" ? "active" : ""} onClick={() => setActiveTab("experiments")}><Sparkles size={15}/> Deneyler</button><button className={activeTab === "jobs" ? "active" : ""} onClick={() => setActiveTab("jobs")}><TimerReset size={15} /> İş geçmişi</button></nav>
    </aside>
    <section className={`studio-content tab-${activeTab}`}>
      <header><div><small>Doğal konuşma ritmi</small><h2>Zamanlamayı yönet</h2></div><button onClick={save}><Save size={15} /> Değişiklikleri kaydet</button></header>
      {status ? <p className="studio-notice"><Check size={14} /> {status}</p> : null}
      <BotProfileEditor profileId={profileId} />
      <PersonaLaboratory profileId={profileId} />
      <article id="timing" className="studio-card" onChange={() => setDirty(true)}>
        <div className="studio-card-head"><div><small>01 · Tepki ritmi</small><h3>Yanıt ve yazma süreleri</h3></div><label className="inherit-toggle"><input type="checkbox" checked={!customTiming} onChange={(event) => setCustomTiming(!event.target.checked)} /> Sistem ayarını kullan</label></div>
        <div className={customTiming ? "setting-grid" : "setting-grid inherited"}>
          <TimeField label="Yanıt gecikmesi" suffix="sn" min={Number(effective("min_reply_delay_seconds"))} max={Number(effective("max_reply_delay_seconds"))} onMin={setNumber("min_reply_delay_seconds")} onMax={setNumber("max_reply_delay_seconds")} disabled={!customTiming} />
          <TimeField label="Yazıyor göstergesi" suffix="sn" min={Number(effective("typing_min_seconds"))} max={Number(effective("typing_max_seconds"))} onMin={setNumber("typing_min_seconds")} onMax={setNumber("typing_max_seconds")} disabled={!customTiming} />
          <TimeField label="Birleştirme / üst sınır" suffix="sn" min={Number(effective("bundle_window_seconds"))} max={Number(effective("bundle_max_seconds"))} onMin={setNumber("bundle_window_seconds")} onMax={setNumber("bundle_max_seconds")} disabled={!customTiming} />
        </div>
      </article>
      <article id="presence" className="studio-card" onChange={() => setDirty(true)}>
        <div className="studio-card-head"><div><small>02 · Haftalık nabız</small><h3>Aktif saatler ve presence</h3></div><label className="inherit-toggle"><input type="checkbox" checked={!customSchedule} onChange={(event) => { setCustomSchedule(!event.target.checked); if (!event.target.checked) setValues((current) => current ? { ...current, weekly_schedule: structuredClone(data.global.weekly_schedule) } : current); }} /> Sistem programını kullan</label></div>
        <div className="presence-row"><label>Presence kontrolü<select value={values.presence_override} onChange={(event) => setValues((current) => current ? { ...current, presence_override: event.target.value as SettingsRow["presence_override"] } : current)}><option value="auto">Programa göre</option><option value="online">Çevrim içi tut</option><option value="offline">Çevrim dışı tut</option></select></label><label>Saat dilimi<input value={String(effective("timezone"))} disabled={!customSchedule} onChange={(event) => setValues((current) => current ? { ...current, timezone: event.target.value } : current)} /></label></div>
        <div className={customSchedule ? "week-grid" : "week-grid inherited"}>{days.map(([key,label]) => { const range = schedule[key]?.[0] ?? ["09:00","23:30"]; return <div key={key}><b>{label}</b><input type="time" disabled={!customSchedule} value={range[0]} onChange={(event) => updateDay(key,0,event.target.value)} /><span>—</span><input type="time" disabled={!customSchedule} value={range[1]} onChange={(event) => updateDay(key,1,event.target.value)} /></div>; })}</div>
      </article>
      <article className="studio-card proactive-card" onChange={() => setDirty(true)}>
        <div className="studio-card-head"><div><small>03 · Sohbeti başlat</small><h3>İlk mesaj ve tek takip</h3></div><label className="inherit-toggle"><input type="checkbox" checked={!customProactive} onChange={(event) => setCustomProactive(!event.target.checked)} /> Sistem ayarını kullan</label></div>
        <div className={customProactive ? "setting-grid proactive-grid" : "setting-grid proactive-grid inherited"}>
          <div className="proactive-setting"><label><input type="checkbox" disabled={!customProactive} checked={Boolean(effective("first_message_enabled"))} onChange={(event) => setValues((current) => current ? { ...current, first_message_enabled: event.target.checked } : current)} /> İlk mesaj açık</label><TimeField label="Eşleşmeden sonra" suffix="sn" min={Number(effective("first_message_min_seconds"))} max={Number(effective("first_message_max_seconds"))} onMin={setNumber("first_message_min_seconds")} onMax={setNumber("first_message_max_seconds")} disabled={!customProactive} /></div>
          <div className="proactive-setting"><label><input type="checkbox" disabled={!customProactive} checked={Boolean(effective("follow_up_enabled"))} onChange={(event) => setValues((current) => current ? { ...current, follow_up_enabled: event.target.checked } : current)} /> Tek takip açık</label><TimeField label="Cevapsız kaldığında" suffix="sn" min={Number(effective("follow_up_min_seconds"))} max={Number(effective("follow_up_max_seconds"))} onMin={setNumber("follow_up_min_seconds")} onMax={setNumber("follow_up_max_seconds")} disabled={!customProactive} /></div>
        </div>
      </article>
      <ExperimentPanel profileId={profileId} metrics={data.metrics} experimentMetrics={data.experimentMetrics} experiments={data.experiments} onChanged={load} />
      <article id="jobs" className="studio-card job-card">
        <div className="studio-card-head"><div><small>05 · Kuyruk izi</small><h3>Son otomasyon işleri</h3></div><span>{data.jobs.length} kayıt</span></div>
        <div className="job-timeline">{data.jobs.length ? data.jobs.map((job) => <div key={job.id} className={`job ${job.status}`}><i /><div><strong>{jobLabel(job.status)}</strong><small>{new Date(job.scheduled_for).toLocaleString("tr-TR")}</small>{job.last_error ? <p>{job.last_error}</p> : null}</div></div>) : <p className="empty-jobs">Bu bot için henüz zamanlanmış iş yok.</p>}</div>
      </article>
      {dirty ? <div className="unsaved-bar"><span>Kaydedilmemiş davranış değişiklikleri var.</span><button onClick={() => void load()}>Vazgeç</button><button onClick={() => void save()}><Save size={14}/> Değişiklikleri kaydet</button></div> : null}
    </section>
  </div></main>;
}

type BotProfilePayload = {
  name: string;
  birthDate: string;
  gender: string;
  city: string;
  discoverable: boolean;
  badges: string[];
  prompt: string;
  answer: string;
  photos: { id: string; url: string; isPrimary: boolean }[];
  personaPublished: boolean;
  ready: boolean;
};

function BotProfileEditor({ profileId }: { profileId: string }) {
  const [profile, setProfile] = useState<BotProfilePayload | null>(null);
  const [status, setStatus] = useState("Profil yükleniyor…");
  const [busy, setBusy] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => {
    const response = await fetch(`/api/admin/bots/${profileId}/profile`, { cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return setStatus(body.error ?? "Bot profili yüklenemedi.");
    setProfile(body.profile);
    setStatus("");
  }, [profileId]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  const update = <K extends keyof BotProfilePayload>(key: K, value: BotProfilePayload[K]) => setProfile((current) => current ? { ...current, [key]: value } : current);
  const save = async (event: FormEvent) => {
    event.preventDefault(); if (!profile) return;
    setBusy(true); setStatus("Profil kaydediliyor…");
    const response = await fetch(`/api/admin/bots/${profileId}/profile`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profile) });
    const body = await response.json().catch(() => ({})); setBusy(false);
    setStatus(response.ok ? "Bot profili kaydedildi." : body.error ?? "Profil kaydedilemedi.");
    if (response.ok) await load();
  };
  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).slice(0, Math.max(0, 6 - (profile?.photos.length ?? 0))); event.target.value = "";
    if (!files.length) return; setBusy(true); setStatus("Fotoğraflar yükleniyor…");
    for (const file of files) {
      const form = new FormData(); form.set("profileId", profileId); form.set("photo", file);
      const response = await fetch("/api/admin/bots/photo", { method: "POST", body: form });
      if (!response.ok) { const body = await response.json().catch(() => ({})); setBusy(false); return setStatus(body.error ?? "Fotoğraf yüklenemedi."); }
    }
    setBusy(false); setStatus("Fotoğraflar eklendi."); await load();
  };
  if (!profile) return <article className="studio-card profile-editor"><p>{status}</p></article>;
  const checklist = [
    { done: profile.photos.length >= 1, label: `${profile.photos.length}/1 fotoğraf` },
    { done: profile.personaPublished, label: "Yayınlanmış persona" },
    { done: Boolean(profile.prompt && profile.answer), label: "Profil sorusu ve yanıtı" },
  ];
  return <article className="studio-card profile-editor">
    <div className="studio-card-head"><div><small>00 · Kullanıcıya görünen yüz</small><h3>Bot profili ve yayın hazırlığı</h3></div><span className={profile.ready ? "ready" : "draft"}>{profile.ready ? "Yayına hazır" : "Taslak"}</span></div>
    <form onSubmit={save}>
      <div className="profile-photo-strip">{profile.photos.map((photo, index) => <span key={photo.id}><Image src={photo.url} alt={`${profile.name} fotoğraf ${index + 1}`} fill sizes="160px" unoptimized />{photo.isPrimary ? <b>Ana</b> : null}</span>)}{profile.photos.length < 6 ? <button type="button" onClick={() => photoRef.current?.click()}><ImagePlus/><small>Fotoğraf ekle</small></button> : null}</div>
      <input ref={photoRef} hidden multiple type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={upload} />
      <div className="profile-form-grid">
        <label>Ad<input required minLength={2} value={profile.name} onChange={(event) => update("name", event.target.value)} /></label>
        <label>Doğum tarihi<input required type="date" value={profile.birthDate} onChange={(event) => update("birthDate", event.target.value)} /></label>
        <label>Cinsiyet<input required value={profile.gender} onChange={(event) => update("gender", event.target.value)} /></label>
        <label>Şehir<input value={profile.city} onChange={(event) => update("city", event.target.value)} /></label>
        <label className="wide">Niyetler (virgülle, en fazla 3)<input value={profile.badges.join(", ")} onChange={(event) => update("badges", event.target.value.split(",").map((item) => item.trim()).filter(Boolean).slice(0, 3))} /></label>
        <label className="wide">Profil sorusu<select required value={profile.prompt} onChange={(event) => update("prompt", event.target.value)}><option>En gizli yeteneğim…</option><option>Benimle çıkmanın küçük bir lüksü…</option><option>Beni etkilemenin en kısa yolu…</option><option>Birlikte mutlaka denemeliyiz…</option></select></label>
        <label className="wide">Yanıt<textarea required value={profile.answer} onChange={(event) => update("answer", event.target.value)} /></label>
      </div>
      <div className="profile-publish-row"><div className="readiness-list">{checklist.map((item) => <span className={item.done ? "done" : ""} key={item.label}><Check size={13}/>{item.label}</span>)}</div><label><input type="checkbox" checked={profile.discoverable} onChange={(event) => update("discoverable", event.target.checked)} /> Keşfette göster</label><button disabled={busy} type="submit"><Save size={14}/>{busy ? "İşleniyor…" : "Profili kaydet"}</button></div>
      {status ? <p className="studio-notice">{status}</p> : null}
    </form>
  </article>;
}

function TimeField({ label, suffix, min, max, onMin, onMax, disabled }: { label: string; suffix: string; min: number; max: number; onMin: (event: ChangeEvent<HTMLInputElement>) => void; onMax: (event: ChangeEvent<HTMLInputElement>) => void; disabled: boolean }) {
  return <label className="time-field"><span>{label}</span><div><input type="number" disabled={disabled} value={min} onChange={onMin} /><b>—</b><input type="number" disabled={disabled} value={max} onChange={onMax} /><em>{suffix}</em></div></label>;
}
function jobLabel(status: string) { return ({ queued: "Bekliyor", typing: "Yazıyor", processing: "Üretiliyor", sent: "Gönderildi", cancelled: "İptal edildi", failed: "İnceleme gerekli" } as Record<string,string>)[status] ?? status; }

function ExperimentPanel({ profileId, metrics, experimentMetrics, experiments, onChanged }: { profileId: string; metrics: Payload["metrics"]; experimentMetrics: Payload["experimentMetrics"]; experiments: Payload["experiments"]; onChanged: () => Promise<void> }) {
  const [traffic, setTraffic] = useState(20);
  const [minDelay, setMinDelay] = useState(35);
  const [maxDelay, setMaxDelay] = useState(120);
  const [status, setStatus] = useState("");
  const activeExperiment = experiments.find((item) => ["running","paused"].includes(item.status)) ?? experiments.find((item) => item.status === "completed" && !item.published_at);
  const controlSent = experimentMetrics.find((item) => item.variant === "control")?.sent ?? 0;
  const variantSent = experimentMetrics.find((item) => item.variant === "variant")?.sent ?? 0;
  const publishReady = controlSent >= 200 && variantSent >= 200;
  const experimentCompleted = activeExperiment?.status === "completed";
  const start = async () => {
    setStatus("Deney başlatılıyor…");
    const response = await fetch(`/api/admin/bots/${profileId}/experiments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: `Yanıt ritmi ${minDelay}–${maxDelay} sn`, trafficPercent: traffic, variantConfig: { min_reply_delay_seconds: minDelay, max_reply_delay_seconds: maxDelay } }) });
    const data = await response.json().catch(() => ({})); setStatus(response.ok ? "Deney yayında." : data.error ?? "Deney başlatılamadı."); if (response.ok) await onChanged();
  };
  const act = async (action: "pause" | "resume" | "complete" | "publish", winner?: "control" | "variant") => {
    if (!activeExperiment) return;
    if (action === "publish" && !window.confirm(`${winner === "control" ? "Kontrol" : "Varyant"} ayarları bu botta yayınlansın mı?`)) return;
    const response = await fetch(`/api/admin/bots/${profileId}/experiments`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, experimentId: activeExperiment.id, winner }) });
    const body = await response.json().catch(() => ({})); setStatus(response.ok ? "Deney güncellendi." : body.error ?? "Deney güncellenemedi."); if (response.ok) await onChanged();
  };
  return <article className="studio-card experiment-card"><div className="studio-card-head"><div><small>04 · Ölç ve karşılaştır</small><h3>Performans ve A/B testi</h3></div><span>{activeExperiment?.name ?? "Aktif deney yok"}</span></div><div className="metric-ribbon"><span><small>Gönderilen</small><b>{metrics.sent}</b></span><span><small>Ort. gecikme</small><b>{metrics.averageDelaySeconds} sn</b></span><span><small>İlk / takip</small><b>{metrics.firstMessages} / {metrics.followUps}</b></span><span><small>Hata</small><b>{metrics.failed}</b></span></div><div className="experiment-results">{experimentMetrics.map((group) => <span key={group.variant}><small>{group.variant === "control" ? "Kontrol" : "Varyant"} · {group.sent}/200 gönderim</small><b>%{group.replyRate} geri dönüş</b><em>{group.safetyEvents} güvenlik olayı</em></span>)}</div>{activeExperiment ? <div className="experiment-actions">{!experimentCompleted ? <><button onClick={() => void act(activeExperiment.status === "paused" ? "resume" : "pause")}>{activeExperiment.status === "paused" ? "Devam ettir" : "Duraklat"}</button><button onClick={() => void act("complete")}>Sonlandır</button></> : null}<button disabled={!publishReady} onClick={() => void act("publish","control")}>Kontrolü yayınla</button><button disabled={!publishReady} onClick={() => void act("publish","variant")}>Varyantı yayınla</button></div> : <div className="experiment-form"><label>Trafik %<input type="number" min="1" max="100" value={traffic} onChange={(event) => setTraffic(Number(event.target.value))} /></label><label>Min sn<input type="number" min="3" value={minDelay} onChange={(event) => setMinDelay(Number(event.target.value))} /></label><label>Max sn<input type="number" min="3" value={maxDelay} onChange={(event) => setMaxDelay(Number(event.target.value))} /></label><button onClick={start}>İki varyantlı deneyi başlat</button></div>}{!publishReady && activeExperiment ? <p>Kazananı yayınlamak için her iki grupta da 200 gönderim gerekli.</p> : null}{status ? <p>{status}</p> : null}</article>;
}

type PersonaVersion = { id: string; version_number: number; status: string; persona: string; provider: string; model: string; created_at: string };
function PersonaLaboratory({ profileId }: { profileId: string }) {
  const [versions, setVersions] = useState<PersonaVersion[]>([]);
  const [persona, setPersona] = useState("");
  const [provider, setProvider] = useState("inherit");
  const [model, setModel] = useState("gpt-5.6-luna");
  const [testMessage, setTestMessage] = useState("Bugün nasıl gidiyor?");
  const [testReply, setTestReply] = useState("");
  const [status, setStatus] = useState("");
  const load = useCallback(async () => {
    const response = await fetch(`/api/admin/bots/${profileId}/persona-versions`, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setStatus(data.error ?? "Persona sürümleri yüklenemedi.");
    setVersions(data.versions ?? []);
    setPersona(data.current?.persona ?? ""); setProvider(data.current?.provider ?? "inherit"); setModel(data.current?.model ?? "gpt-5.6-luna");
  }, [profileId]);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  const draft = async () => {
    setStatus("Taslak kaydediliyor…");
    const response = await fetch(`/api/admin/bots/${profileId}/persona-versions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "draft", persona, provider, model }) });
    const data = await response.json().catch(() => ({})); setStatus(response.ok && data.version ? `v${data.version.version_number} taslağı hazır.` : data.error ?? "Taslak kaydedilemedi."); if (response.ok) await load();
  };
  const test = async () => {
    let version = versions.find((item) => item.status === "draft");
    if (!version) { await draft(); const response = await fetch(`/api/admin/bots/${profileId}/persona-versions`, { cache: "no-store" }); const data = await response.json().catch(() => ({})); version = data.versions?.find((item: PersonaVersion) => item.status === "draft"); }
    if (!version) return;
    setStatus("Test yanıtı üretiliyor…");
    const response = await fetch(`/api/admin/bots/${profileId}/persona-versions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "test", versionId: version.id, message: testMessage }) });
    const data = await response.json().catch(() => ({})); setTestReply(response.ok ? data.reply : ""); setStatus(response.ok ? `${data.provider} · ${data.model}` : data.error ?? "Test tamamlanamadı.");
  };
  const publish = async (versionId: string) => {
    const target = versions.find((item) => item.id === versionId);
    if (!window.confirm(`v${target?.version_number ?? "?"} · ${target?.provider ?? ""} · ${target?.model ?? ""} yayına alınsın mı?`)) return;
    setStatus("Yayınlanıyor…");
    const response = await fetch(`/api/admin/bots/${profileId}/persona-versions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "publish", versionId }) });
    const data = await response.json().catch(() => ({})); setStatus(response.ok ? "Persona yayınlandı." : data.error ?? "Yayınlanamadı."); if (response.ok) await load();
  };
  const duplicate = async (versionId: string) => { const response = await fetch(`/api/admin/bots/${profileId}/persona-versions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "duplicate", versionId }) }); const data = await response.json().catch(() => ({})); setStatus(response.ok && data.version ? `v${data.version.version_number} yeni taslak olarak oluşturuldu.` : data.error ?? "Sürüm kopyalanamadı."); if (response.ok) await load(); };
  const draftVersion = versions.find((item) => item.status === "draft");
  return <article className="studio-card persona-lab"><div className="studio-card-head"><div><small>Persona laboratuvarı</small><h3>Taslak → Test → Yayınla</h3></div><FlaskConical size={18} /></div><div className="persona-editor"><textarea value={persona} onChange={(event) => setPersona(event.target.value)} minLength={20} /><div><label>Sağlayıcı<select value={provider} onChange={(event) => setProvider(event.target.value)}><option value="inherit">Sistem ayarı</option><option value="openai">OpenAI</option><option value="gemini">Gemini</option><option value="deepseek">DeepSeek</option><option value="openrouter">OpenRouter</option></select></label><label>Model<input value={model} onChange={(event) => setModel(event.target.value)} /></label><button onClick={draft}><Save size={14} /> Taslak kaydet</button></div></div><div className="persona-test"><input value={testMessage} onChange={(event) => setTestMessage(event.target.value)} /><button onClick={test}><Sparkles size={14} /> Test et</button>{draftVersion ? <button className="publish" onClick={() => publish(draftVersion.id)}>v{draftVersion.version_number} yayınla</button> : null}</div>{testReply ? <blockquote>{testReply}</blockquote> : null}<footer><span>{status || `${versions.length} sürüm kayıtlı`}</span><div className="version-history">{versions.slice(0,8).map((item) => <span key={item.id}><button onClick={() => { setPersona(item.persona); setProvider(item.provider); setModel(item.model); }}>{`v${item.version_number} · ${item.status}`}</button>{item.status !== "draft" ? <button onClick={() => void duplicate(item.id)}>Taslağa kopyala</button> : null}</span>)}</div></footer></article>;
}
