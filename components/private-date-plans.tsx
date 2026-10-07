"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Plan = {
  id: string; venue: string; city: string; starts_at: string; expected_end_at: string;
  status: "scheduled" | "checked_in" | "completed" | "cancelled";
  checked_in_at: string | null; feedback_rating: number | null; feedback_note: string | null;
  emergency_contact_name: string | null; emergency_contact_masked: string | null;
  safety_prompted_at: string | null; safe_confirmed_at: string | null; emergency_notified_at: string | null;
};

export function PrivateDatePlans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/date-plans", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Planlar yüklenemedi.");
      setPlans(body.plans ?? []);
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "Planlar yüklenemedi."); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);
  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setNotice("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const response = await fetch("/api/date-plans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        venue: form.get("venue"), city: form.get("city"),
        startsAt: new Date(String(form.get("startsAt"))).toISOString(),
        expectedEndAt: new Date(String(form.get("expectedEndAt"))).toISOString(),
        emergencyContactName: String(form.get("contactName") ?? "").trim() || undefined,
        emergencyContactPhone: String(form.get("contactPhone") ?? "").trim() || undefined,
      }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Plan kaydedilemedi.");
      formElement.reset(); await load(); setNotice(form.get("contactPhone") ? "Plan kaydedildi. Bitişten sonra güvende olduğunu onaylamazsan acil durum kişine SMS gönderilir." : "Plan yalnızca hesabında kaydedildi.");
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "Plan kaydedilemedi."); }
    finally { setBusy(false); }
  };
  const update = async (id: string, action: "checkin" | "safe" | "complete" | "cancel", rating?: number, note?: string) => {
    setBusy(true); setNotice("");
    try {
      const response = await fetch("/api/date-plans", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, action, ...(rating ? { rating, note } : {}) }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Plan güncellenemedi.");
      await load(); setNotice(action === "safe" ? "Güvende olduğun kaydedildi. İyi ki yazdın!" : action === "checkin" ? "Durumun hesabına kaydedildi." : action === "complete" ? "Geri bildirimin kaydedildi." : "Plan iptal edildi.");
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "Plan güncellenemedi."); }
    finally { setBusy(false); }
  };
  const share = async (plan: Plan) => {
    const message = `Buluşma planım: ${plan.venue}, ${plan.city}. Başlangıç: ${new Date(plan.starts_at).toLocaleString("tr-TR")}. Tahmini bitiş: ${new Date(plan.expected_end_at).toLocaleString("tr-TR")}.`;
    try {
      if (navigator.share) await navigator.share({ title: "Buluşma planım", text: message });
      else { await navigator.clipboard.writeText(message); setNotice("Plan metni kopyalandı; güvendiğin kişiye sen gönderebilirsin."); }
    } catch { /* The member cancelled the share sheet. */ }
  };
  return <section className="private-date-plans" aria-labelledby="private-date-plans-title">
    <div><small>SADECE SANA ÖZEL</small><h2 id="private-date-plans-title">Buluşma planım</h2><p>Yer ve zamanı kaydet; istersen paylaş düğmesiyle güvendiğin kişiye kendin gönder. Acil durum kişisi eklemezsen uygulama kimseye bildirim göndermez.</p></div>
    <form onSubmit={(event) => void create(event)}>
      <label>Şehir<input name="city" required minLength={2} maxLength={80}/></label><label>Mekân<input name="venue" required minLength={2} maxLength={160}/></label>
      <label>Başlangıç<input name="startsAt" type="datetime-local" required/></label><label>Tahmini bitiş<input name="expectedEndAt" type="datetime-local" required/></label>
      <label>Acil durum kişisi (isteğe bağlı)<input name="contactName" maxLength={80} placeholder="Ad"/></label><label>Cep telefonu<input name="contactPhone" type="tel" inputMode="tel" placeholder="05xx xxx xx xx"/></label>
      <p className="private-date-hint">Bitiş saatinde sana &quot;Her şey yolunda mı?&quot; bildirimi gelir. 30 dakika içinde onaylamazsan bu kişiye adın ve mekânınla kısa bir SMS gönderilir. Kişiyi önceden bilgilendirmeni öneririz.</p>
      <button disabled={busy}>Planı kaydet</button>
    </form>
    {notice ? <p role="status">{notice}</p> : null}
    <div className="private-date-plan-list">{plans.map((plan) => <article key={plan.id}>
      <strong>{plan.venue} · {plan.city}</strong><span>{new Date(plan.starts_at).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" })}</span>
      {plan.emergency_contact_masked ? <small>Acil durum kişisi: {plan.emergency_contact_name} · {plan.emergency_contact_masked}</small> : null}
      {plan.safe_confirmed_at ? <small>Güvende olduğun {new Date(plan.safe_confirmed_at).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })} tarihinde onaylandı.</small> : plan.emergency_notified_at ? <small>Onay gelmediği için acil durum kişin bilgilendirildi.</small> : plan.safety_prompted_at && (plan.status === "scheduled" || plan.status === "checked_in") ? <small><strong>Her şey yolunda mı? Güvende olduğunu onayla.</strong></small> : null}
      <small>{plan.status === "scheduled" ? "Planlandı" : plan.status === "checked_in" ? "Güvendeyim kaydı alındı" : plan.status === "completed" ? `Tamamlandı · ${plan.feedback_rating}/5` : "İptal edildi"}</small>
      {plan.status === "scheduled" || plan.status === "checked_in" ? <div className="private-date-actions">
        <button disabled={busy} onClick={() => void share(plan)}>Planı paylaş</button>
        {plan.status === "scheduled" ? <button disabled={busy} onClick={() => void update(plan.id, "checkin")}>Güvendeyim</button> : null}
        {!plan.safe_confirmed_at && plan.safety_prompted_at ? <button disabled={busy} onClick={() => void update(plan.id, "safe")}>Güvende olduğumu onayla</button> : null}
        <button disabled={busy} onClick={() => void update(plan.id, "cancel")}>İptal et</button>
        <form onSubmit={(event) => { event.preventDefault(); const values = new FormData(event.currentTarget); void update(plan.id, "complete", Number(values.get("rating")), String(values.get("note") ?? "")); }}><label>Deneyimini değerlendir<select name="rating" required><option value="">Puan seç</option>{[1,2,3,4,5].map((rating) => <option key={rating} value={rating}>{rating}/5</option>)}</select></label><label>Not (isteğe bağlı)<input name="note" maxLength={500}/></label><button disabled={busy}>Buluşmayı tamamla</button></form>
      </div> : null}
    </article>)}</div>
  </section>;
}
