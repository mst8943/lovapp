"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { AdminResourceNav } from "@/components/admin-resource-nav";
import "../admin-page.css";
import "./team.css";

type Member = { userId: string; role: string; createdAt: string; email: string | null; lastSignInAt: string | null; isSelf: boolean };

const ROLE_LABELS: Record<string, { name: string; detail: string }> = {
  owner: { name: "Sahip", detail: "Her şey: ayarlar, ödemeler, ekip, bot stüdyosu." },
  moderator: { name: "Moderatör", detail: "Fotoğraf, şikâyet, sohbet denetimi, hikâyeler." },
  support: { name: "Destek", detail: "Kullanıcılar, başvurular, ödemeler, canlı destek." },
  bot_editor: { name: "Bot editörü", detail: "Bot stüdyosu ve blog." },
};

export default function TeamPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [status, setStatus] = useState("Yükleniyor…");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/team", { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) return setStatus(body.error ?? "Ekip yüklenemedi.");
      setMembers(body.members ?? []);
      setStatus("");
    } catch { setStatus("Ekip yüklenemedi. Bağlantını kontrol et."); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  const call = async (method: string, body?: Record<string, unknown>, query = "") => {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/team${query}`, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setStatus(data.error ?? "İşlem yapılamadı."); return false; }
      setStatus(""); await load(); return true;
    } catch { setStatus("Bağlantı kurulamadı."); return false; } finally { setBusy(false); }
  };

  const add = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (await call("POST", { email: data.get("email"), role: data.get("role") })) form.reset();
  };

  return (
    <main className="ops-stage">
      <AdminResourceNav />
      <section className="ops-content team-desk">
        <header><div><small>Yönetim</small><h1>Ekip ve roller</h1><p>Panele kimlerin girebileceğini ve neleri görebileceğini buradan belirle. Kişi önce siteye normal üye olarak kayıt olmalı.</p></div></header>
        {status ? <p className="team-status" role="status">{status}</p> : null}
        <form className="team-add" onSubmit={add}>
          <input name="email" type="email" required placeholder="Üyenin e-postası" aria-label="E-posta" />
          <select name="role" defaultValue="support" aria-label="Rol">{Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label.name}</option>)}</select>
          <button className="admin-primary" disabled={busy}>Yönetici ekle</button>
        </form>
        <div className="team-list">
          {members.map((member) => (
            <article key={member.userId} className="team-row">
              <div><strong>{member.email ?? member.userId.slice(0, 8)}{member.isSelf ? " (sen)" : ""}</strong><small>{ROLE_LABELS[member.role]?.detail}</small><small>Son giriş: {member.lastSignInAt ? new Date(member.lastSignInAt).toLocaleString("tr-TR") : "—"}</small></div>
              <select value={member.role} disabled={busy} aria-label="Rol" onChange={(event) => void call("PATCH", { userId: member.userId, role: event.target.value })}>
                {Object.entries(ROLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label.name}</option>)}
              </select>
              <button className="team-remove" disabled={busy || member.isSelf} onClick={() => { if (window.confirm(`${member.email ?? "Bu yönetici"} panelden kaldırılsın mı?`)) void call("DELETE", undefined, `?userId=${member.userId}`); }}>Kaldır</button>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
