"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useAdminRole } from "@/components/admin-role-context";

type Plan = { id: string; slug: string; name: string; duration_days: number; price_amount: number; currency: string; is_active: boolean };
type Coupon = { id: string; code: string; label: string; plan_slug: string; discount_percent: number; max_redemptions: number | null; starts_at: string | null; ends_at: string | null; is_active: boolean };
type Revenue = { approvedOrders: number; approvedTry: number; last30Try: number; byMonth: Array<{ month: string; amount: number; orders: number }> };
function localDate(value: string) { const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16); }

export function AdminNoirBusiness() {
  const role = useAdminRole();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [revenue, setRevenue] = useState<Revenue | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/noir-business", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Noir iş verileri yüklenemedi.");
      setPlans(body.plans ?? []); setCoupons(body.coupons ?? []); setRevenue(body.revenue ?? null);
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "Noir iş verileri yüklenemedi."); }
  }, []);
  useEffect(() => { if (role !== "owner") return; const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load, role]);
  if (role !== "owner") return null;
  const savePlan = async (event: FormEvent<HTMLFormElement>, plan: Plan) => {
    event.preventDefault(); setBusy(true); setNotice("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/admin/noir-business", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "plan", id: plan.id, name: form.get("name"), priceAmount: Number(form.get("price")), isActive: form.get("active") === "on" }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Paket kaydedilemedi.");
      await load(); setNotice("Paket kaydedildi. Kart bağlantısındaki ürün tutarı değiştiyse Shopier eşleşmesini ayrıca güncelleyin.");
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "Paket kaydedilemedi."); }
    finally { setBusy(false); }
  };
  const createCoupon = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setNotice("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const date = (name: string) => form.get(name) ? new Date(String(form.get(name))).toISOString() : null;
      const response = await fetch("/api/admin/noir-business", { method: editingCoupon ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        ...(editingCoupon ? { action: "coupon", id: editingCoupon.id } : {}),
        code: form.get("code"), label: form.get("label"), planSlug: form.get("planSlug"),
        discountPercent: Number(form.get("discountPercent")), maxRedemptions: form.get("maxRedemptions") ? Number(form.get("maxRedemptions")) : null,
        startsAt: date("startsAt"), endsAt: date("endsAt"),
      }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Kupon taslağı kaydedilemedi.");
      formElement.reset(); setEditingCoupon(null); await load(); setNotice("Kupon taslağı kaydedildi; ödeme sağlayıcısı bağlanana kadar kullanılamaz.");
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "Kupon taslağı kaydedilemedi."); }
    finally { setBusy(false); }
  };
  return <section className="admin-noir-business" aria-labelledby="admin-noir-business-title">
    <header><div><small>NOIR İŞ MERKEZİ</small><h2 id="admin-noir-business-title">Paket ve gelir yönetimi</h2><p>Gelir, onaylanmış siparişlerin brüt tutarıdır; iade ve komisyon düşülmez.</p></div><button onClick={() => void load()}>Yenile</button></header>
    {notice ? <p role="status">{notice}</p> : null}
    <div className="noir-business-metrics"><article><small>Onaylanan sipariş</small><strong>{Number(revenue?.approvedOrders ?? 0).toLocaleString("tr-TR")}</strong></article><article><small>Onaylı brüt gelir</small><strong>{Number(revenue?.approvedTry ?? 0).toLocaleString("tr-TR")} ₺</strong></article><article><small>Son 30 gün</small><strong>{Number(revenue?.last30Try ?? 0).toLocaleString("tr-TR")} ₺</strong></article></div>
    <div className="noir-business-months">{(revenue?.byMonth ?? []).map((month) => <span key={month.month}><b>{month.month}</b><strong>{Number(month.amount).toLocaleString("tr-TR")} ₺</strong><small>{month.orders} sipariş</small></span>)}</div>
    <h3>Satış paketleri</h3><p>Fiyat değişirse sabit Shopier ürün bağlantısındaki tutar da eşitlenene kadar kart ödemesi açılamaz.</p>
    <div className="noir-business-plans">{plans.map((plan) => <form key={plan.id} onSubmit={(event) => void savePlan(event, plan)}><small>{plan.slug} · {plan.duration_days} gün</small><label>Ad<input name="name" required minLength={2} maxLength={80} defaultValue={plan.name}/></label><label>Fiyat ({plan.currency})<input name="price" type="number" min={1} max={100000} step="0.01" required defaultValue={plan.price_amount}/></label><label><input name="active" type="checkbox" defaultChecked={plan.is_active}/> Satışta</label><button disabled={busy}>Kaydet</button></form>)}</div>
    <h3>Kupon taslakları</h3><p>Kuponlar henüz ödeme akışına bağlı değildir. Sağlayıcı seçilince kullanım ve tahsilat doğrulaması eklenebilir.</p>
    <form key={editingCoupon?.id ?? "new"} className="noir-coupon-form" onSubmit={(event) => void createCoupon(event)}><label>Kod<input name="code" required minLength={4} maxLength={32} pattern="[A-Za-z0-9-]+" defaultValue={editingCoupon?.code}/></label><label>Etiket<input name="label" required minLength={2} maxLength={120} defaultValue={editingCoupon?.label}/></label><label>Paket<select name="planSlug" required defaultValue={editingCoupon?.plan_slug}>{plans.map((plan) => <option key={plan.id} value={plan.slug}>{plan.name}</option>)}</select></label><label>İndirim %<input name="discountPercent" type="number" min={1} max={90} required defaultValue={editingCoupon?.discount_percent}/></label><label>Azami kullanım<input name="maxRedemptions" type="number" min={1} max={100000} defaultValue={editingCoupon?.max_redemptions ?? undefined}/></label><label>Başlangıç<input name="startsAt" type="datetime-local" defaultValue={editingCoupon?.starts_at ? localDate(editingCoupon.starts_at) : undefined}/></label><label>Bitiş<input name="endsAt" type="datetime-local" defaultValue={editingCoupon?.ends_at ? localDate(editingCoupon.ends_at) : undefined}/></label><button disabled={busy || !plans.length}>{editingCoupon ? "Taslağı güncelle" : "Taslak oluştur"}</button>{editingCoupon ? <button type="button" onClick={() => setEditingCoupon(null)}>Vazgeç</button> : null}</form>
    <div className="noir-coupon-list">{coupons.map((coupon) => <article key={coupon.id}><code>{coupon.code}</code><span>{coupon.label} · {coupon.plan_slug} · %{coupon.discount_percent}</span><small>{coupon.max_redemptions ? `${coupon.max_redemptions} kullanım sınırı` : "Sınır yok"} · Taslak</small><button type="button" onClick={() => setEditingCoupon(coupon)}>Düzenle</button></article>)}</div>
  </section>;
}
