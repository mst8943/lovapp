"use client";

import Link from "next/link";
import Image from "next/image";
import { AlertTriangle, Bot, ChevronLeft, LoaderCircle, MessageSquareText, Pause, Play, Send, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { Brand } from "@/components/brand";
import "./conversation-controls.css";

type ConversationMode = "ai" | "admin" | "paused";
type Conversation = { id: string; a: { display_name: string; kind: string }; b: { display_name: string; kind: string }; preview: string; updatedAt: string; mode: ConversationMode; hasBot: boolean; hasRisk: boolean; riskSeverity: string | null; takeoverExpiresAt: string | null; hiddenFor?: { profileId: string; name: string; hiddenAt: string }[] };
type GrantData = { reviewers: { user_id: string; role: string; email: string }[]; grants: { id: string; admin_user_id: string; reason: string; expires_at: string; revoked_at: string | null }[] };
type RelationshipStage = "new_match" | "getting_to_know" | "comfortable" | "closer" | "distant" | "reconnecting";
type Thread = {
  profiles: { id: string; display_name: string; kind: string }[];
  mode: ConversationMode;
  control?: { takeover_expires_at?: string | null; auto_return_to_ai?: boolean };
  risks?: { id: string; category: string; severity: string; status: string; created_at: string; resolution?: string | null }[];
  memory?: { summary: string; facts: unknown[] } | null;
  relationship?: { stage: RelationshipStage; score: number; admin_override?: boolean } | null;
  dailyState?: { energy: "low" | "normal" | "high"; availability: "busy" | "relaxed" | "brief"; mood: "cheerful" | "calm" | "thoughtful" | "stressed"; context: string } | null;
  messages: { id: string; sender_id: string; body: string | null; imageUrl: string | null; kind: string; created_at: string; sent_by_admin: string | null }[];
};

const relationshipLabels: Record<RelationshipStage, string> = {
  new_match: "Yeni eşleşme",
  getting_to_know: "Tanışıyor",
  comfortable: "Rahat",
  closer: "Yakınlaşıyor",
  distant: "Mesafeli",
  reconnecting: "Yeniden bağlanıyor",
};

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [thread, setThread] = useState<Thread | null>(null);
  const [grantData, setGrantData] = useState<GrantData | null>(null);
  const [takeoverDuration, setTakeoverDuration] = useState("60");
  const [status, setStatus] = useState("Sohbetler yükleniyor…");
  const [filter, setFilter] = useState<"attention" | "risk" | "admin" | "paused" | "all">("attention");
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch("/api/admin/conversations").then(async (response) => ({ ok: response.ok, data: await response.json().catch(() => ({})) })).then(({ ok, data }) => {
      if (!ok) return setStatus(data.error);
      setConversations(data.conversations);
      setStatus(data.conversations.length ? "" : "Henüz sohbet yok.");
    });
  }, []);
  const refresh = useCallback(async (matchId: string) => {
    const response = await fetch(`/api/admin/conversations/${matchId}`, { cache: "no-store" });
    const data = await response.json().catch(() => ({}));
    if (response.ok) { setThread(data); setStatus(""); } else setStatus(data.error);
  }, []);
  const loadGrants = useCallback(async (matchId: string) => {
    const response = await fetch(`/api/admin/conversation-grants?matchId=${encodeURIComponent(matchId)}`, { cache: "no-store" });
    if (!response.ok) return setGrantData(null);
    setGrantData(await response.json().catch(() => ({})));
  }, []);
  const chooseConversation = (conversation: Conversation) => { setThread(null); setSelected(conversation); void refresh(conversation.id); void loadGrants(conversation.id); };
  const patch = async (body: Record<string, unknown>) => {
    if (!selected) return false;
    const response = await fetch(`/api/admin/conversations/${selected.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { setStatus(data.error ?? "Değişiklik kaydedilemedi."); return false; }
    await refresh(selected.id);
    return true;
  };
  const setMode = async (mode: ConversationMode) => {
    const permanent = takeoverDuration === "permanent";
    let reason: string | undefined;
    if (mode === "paused" || (mode === "admin" && permanent)) {
      reason = window.prompt(mode === "paused" ? "Sohbeti duraklatma nedenini yaz." : "Süresiz devralma nedenini yaz.")?.trim();
      if (!reason || reason.length < 5) return setStatus("Bu işlem için kısa bir neden gerekli.");
      if (!window.confirm(mode === "paused" ? "Sohbet duraklatılsın mı? Bekleyen yanıtlar iptal edilir." : "Sohbet süresiz olarak admin kontrolüne alınsın mı?")) return;
    }
    await patch({ action: "mode", mode, durationMinutes: permanent ? undefined : Number(takeoverDuration), autoReturn: mode === "admin" ? !permanent : true, reason });
  };
  const updateRelationship = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await patch({ action: "relationship", stage: form.get("stage"), score: Number(form.get("score")) });
  };
  const updateDailyState = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await patch({ action: "daily_state", energy: form.get("energy"), availability: form.get("availability"), mood: form.get("mood"), context: form.get("context") });
  };
  const grantAccess = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!selected) return;
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/conversation-grants", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ matchId: selected.id, adminUserId: form.get("reviewer"), durationMinutes: Number(form.get("duration")), reason: form.get("reason") }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setStatus(data.error ?? "Vaka erişimi verilemedi.");
    await loadGrants(selected.id); setStatus("Süreli vaka erişimi verildi.");
  };
  const revokeGrant = async (id: string) => {
    if (!selected) return;
    const response = await fetch(`/api/admin/conversation-grants?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (response.ok) await loadGrants(selected.id); else setStatus("Erişim kaldırılamadı.");
  };
  const send = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    const formElement = event.currentTarget;
    const message = String(new FormData(formElement).get("message") ?? "").trim();
    if (!message) return;
    const response = await fetch(`/api/admin/conversations/${selected.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setStatus(data.error ?? "Mesaj gönderilemedi.");
    formElement.reset();
    await refresh(selected.id);
  };

  const names = selected ? `${selected.a.display_name} × ${selected.b.display_name}` : "Bir sohbet seç";
  const botId = thread?.profiles.find((profile) => profile.kind === "bot")?.id;
  const openRisk = thread?.risks?.find((risk) => ["open", "reviewing"].includes(risk.status));
  const visibleConversations = conversations.filter((conversation) => {
    const queryMatch = `${conversation.a.display_name} ${conversation.b.display_name}`.toLocaleLowerCase("tr-TR").includes(query.toLocaleLowerCase("tr-TR"));
    const filterMatch = filter === "all" || (filter === "attention" && (conversation.hasRisk || conversation.mode !== "ai")) || (filter === "risk" && conversation.hasRisk) || (filter === "admin" && conversation.mode === "admin") || (filter === "paused" && conversation.mode === "paused");
    return queryMatch && filterMatch;
  }).toSorted((a,b) => Number(b.hasRisk) - Number(a.hasRisk) || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  return <main className="conversation-admin">
    <aside><header><Brand compact /><Link href="/admin/lovask-control"><ChevronLeft size={16} /> Panele dön</Link></header><small>Denetimli erişim</small><h1>Sohbetler</h1>
      <input className="conversation-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Kullanıcı veya profil ara"/><div className="conversation-filter">{([['attention','İlgi bekleyen'],['risk','Riskli'],['admin','Admin'],['paused','Duraklatılmış'],['all','Tümü']] as const).map(([value,label]) => <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{label}</button>)}</div><div className="admin-conversation-list">{visibleConversations.map((conversation) => <button key={conversation.id} className={`${selected?.id === conversation.id ? "active" : ""} ${conversation.hasRisk ? "has-risk" : ""}`} onClick={() => chooseConversation(conversation)}><span>{conversation.hasRisk ? <AlertTriangle size={15}/> : conversation.hasBot ? <Bot size={15} /> : <MessageSquareText size={15} />}</span><div><strong>{conversation.a.display_name} × {conversation.b.display_name}</strong><small>{conversation.preview}</small><time>{new Date(conversation.updatedAt).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })}</time>{conversation.hiddenFor?.length ? <span style={{ color: "#ef4444", fontSize: 11, display: "block", marginTop: 2 }}>🗑️ {conversation.hiddenFor.map((h) => h.name).join(", ")} sildi</span> : null}</div><i>{conversation.hasRisk ? conversation.riskSeverity : conversation.mode === "admin" ? "Admin" : conversation.mode === "paused" ? "Duraklatıldı" : "AI"}</i></button>)}</div>
      {status ? <p className="admin-thread-status">{status}</p> : null}
    </aside>
    <section className="admin-thread">
      <header><div><small>{selected ? selected.hasBot ? "Bot sohbeti" : "İnsan sohbeti · kayıtlı erişim" : "Sohbet denetimi"}</small><h2>{names}</h2>{selected?.hiddenFor?.length ? <p style={{ color: "#f87171", fontSize: 12, margin: "4px 0 0" }}>⚠️ Bu sohbet şu kullanıcılar tarafından listesinden silindi / gizlendi: {selected.hiddenFor.map((h) => `${h.name} (${new Date(h.hiddenAt).toLocaleString("tr-TR")})`).join(", ")}</p> : null}</div>
        {selected?.hasBot && thread ? <div className="conversation-modes"><button className={thread.mode === "ai" ? "active" : ""} onClick={() => setMode("ai")}><Play size={14} /> AI</button><select aria-label="Admin devralma süresi" value={takeoverDuration} onChange={(event) => setTakeoverDuration(event.target.value)}><option value="15">15 dk</option><option value="60">1 saat</option><option value="480">8 saat</option><option value="permanent">Süresiz</option></select><button className={thread.mode === "admin" ? "active" : ""} onClick={() => setMode("admin")}><ShieldCheck size={14} /> Devral</button><button className={thread.mode === "paused" ? "active danger" : "danger"} onClick={() => setMode("paused")}><Pause size={14} /> Duraklat</button></div> : null}
      </header>
      {openRisk ? <div className="risk-strip"><AlertTriangle size={15} /><span><strong>İnceleme gerekli</strong>{openRisk.category} · {openRisk.severity}</span><div><button onClick={() => patch({ action: "risk", riskId: openRisk.id, status: "reviewing" })}>İncelemede</button><button onClick={() => patch({ action: "risk", riskId: openRisk.id, status: "resolved", resolution: "Admin tarafından incelendi." })}>Çözüldü</button><button onClick={() => patch({ action: "risk", riskId: openRisk.id, status: "dismissed", resolution: "Yanlış pozitif." })}>Yoksay</button></div></div> : null}
      {thread?.memory?.summary || thread?.relationship ? <div className="thread-context"><form onSubmit={updateRelationship}><small>İlişki aşaması</small><select name="stage" defaultValue={thread.relationship?.stage ?? "new_match"}>{Object.entries(relationshipLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><input name="score" type="number" min="-100" max="100" defaultValue={thread.relationship?.score ?? 0} /><button>Uygula</button></form><span><small>Bot hafızası</small><b>{thread.memory?.summary || "Henüz özet oluşmadı."}</b>{thread.memory ? <button className="memory-delete" onClick={() => { if (window.confirm("Bot hafızası kalıcı olarak silinsin mi? Bu işlem geri alınamaz.")) void patch({ action: "memory.delete" }); }}><Trash2 size={12} /> Sil</button> : null}</span></div> : null}
      {selected?.hasBot && thread ? <details className="daily-state"><summary>Bugünün bot durumu{thread.dailyState ? ` · ${thread.dailyState.context}` : ""}</summary><form onSubmit={updateDailyState}><select name="energy" defaultValue={thread.dailyState?.energy ?? "normal"}><option value="low">Düşük enerji</option><option value="normal">Normal enerji</option><option value="high">Yüksek enerji</option></select><select name="availability" defaultValue={thread.dailyState?.availability ?? "relaxed"}><option value="busy">Meşgul</option><option value="relaxed">Rahat</option><option value="brief">Kısa yazıyor</option></select><select name="mood" defaultValue={thread.dailyState?.mood ?? "calm"}><option value="cheerful">Neşeli</option><option value="calm">Sakin</option><option value="thoughtful">Düşünceli</option><option value="stressed">Stresli</option></select><input name="context" maxLength={240} required defaultValue={thread.dailyState?.context ?? "Bugün sakin ve doğal bir tempoda."} /><button>Bugün için uygula</button></form></details> : null}
      {selected && grantData ? <details className="case-access"><summary>Vaka erişimi · {grantData.grants.filter((grant) => !grant.revoked_at && new Date(grant.expires_at) > new Date()).length} aktif</summary><form onSubmit={grantAccess}><select name="reviewer" required defaultValue=""><option value="" disabled>İnceleyici seç</option>{grantData.reviewers.map((reviewer) => <option key={reviewer.user_id} value={reviewer.user_id}>{reviewer.email} · {reviewer.role}</option>)}</select><select name="duration" defaultValue="60"><option value="15">15 dakika</option><option value="60">1 saat</option><option value="480">8 saat</option><option value="1440">24 saat</option></select><input name="reason" minLength={10} maxLength={500} required placeholder="Erişim nedeni" /><button>Erişim ver</button></form><div>{grantData.grants.filter((grant) => !grant.revoked_at && new Date(grant.expires_at) > new Date()).map((grant) => <span key={grant.id}><small>{grantData.reviewers.find((reviewer) => reviewer.user_id === grant.admin_user_id)?.email ?? grant.admin_user_id}</small><b>{new Date(grant.expires_at).toLocaleString("tr-TR")}</b><button onClick={() => void revokeGrant(grant.id)}>Kaldır</button></span>)}</div></details> : null}
      <div className="admin-thread-body">{selected && !thread ? <LoaderCircle className="spin" /> : null}{thread?.messages.map((message) => <div key={message.id} className={message.sender_id === botId ? "admin-bubble bot-side" : "admin-bubble human-side"}><small>{thread.profiles.find((profile) => profile.id === message.sender_id)?.display_name}{message.sent_by_admin ? " · admin yazdı" : ""}</small>{message.imageUrl ? <Image src={message.imageUrl} alt="Şikâyet incelemesindeki sohbet fotoğrafı" width={220} height={260} unoptimized style={{ objectFit: "contain" }} /> : <p>{message.kind === "audio" ? "Sesli mesaj" : message.body}</p>}<time>{new Date(message.created_at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</time></div>)}{!selected ? <div className="thread-empty"><Sparkles size={22} /><p>İncelemek veya devralmak için soldan bir sohbet seç.</p></div> : null}</div>
      {selected?.hasBot && thread?.mode === "admin" ? <form className="admin-composer" onSubmit={send}><input name="message" maxLength={1200} placeholder="Botun ağzından yaz…" /><button aria-label="Bot olarak gönder"><Send size={16} /></button></form> : null}
    </section>
  </main>;
}
