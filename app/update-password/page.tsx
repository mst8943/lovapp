"use client";

import { LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { Brand } from "@/components/brand";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const client = createClient();
    if (!client) return setNote("Demo modunda şifre değişikliği yapılmaz.");
    setBusy(true);
    const response = await fetch("/api/auth/recovery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: "change_password", password }) }).catch(() => null);
    if (!response?.ok) {
      setNote(
        "Şifre güncellenemedi. Yeni bir sıfırlama bağlantısı iste.",
      );
      setBusy(false);
      return;
    }
    await client.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <main className="login-stage">
      <section className="login-card compact-auth">
        <Brand />
        <small className="eyebrow">Güvenli hesap</small>
        <h1>
          Şifreni
          <br />
          <em>yenile.</em>
        </h1>
        <p>Yeni şifren en az 6 karakter olmalı.</p>
        <form onSubmit={submit}>
          <label className="field">
            <span>Yeni şifre</span>
            <input
              required
              minLength={6}
              maxLength={128}
              autoComplete="new-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="En az 6 karakter"
            />
          </label>
          <button className="flow-next" disabled={busy}>
            {busy ? "Kaydediliyor…" : "Şifreyi kaydet"}
            <LockKeyhole size={16} />
          </button>
        </form>
        {note ? (
          <div className="login-note" role="status">
            {note}
          </div>
        ) : null}
      </section>
    </main>
  );
}
