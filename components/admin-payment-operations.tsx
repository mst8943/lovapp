"use client";

import { waitingBadge } from "@/lib/waiting";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, ExternalLink, LoaderCircle, RefreshCw, Search, ShieldCheck, X } from "lucide-react";

type PaymentOrder = {
  id: string;
  profile_id: string;
  amount: number;
  currency: string;
  status: string;
  provider: string;
  payment_reference: string;
  sender_full_name?: string | null;
  payment_date?: string | null;
  external_reference?: string | null;
  submitted_at?: string | null;
  rejection_reason?: string | null;
  created_at: string;
  reviewed_at?: string | null;
  proofUrl?: string | null;
  phone?: string | null;
  email?: string | null;
  premium_plans?: { name: string; duration_days: number } | null;
  profiles?: { display_name: string; user_id: string | null } | null;
};

type Filter = "queue" | "approved" | "rejected" | "shopier" | "all";
type Counts = Record<Filter, number>;

const tabs: Array<{ id: Filter; label: string }> = [
  { id: "queue", label: "İnceleme Bekleyen" },
  { id: "approved", label: "Onaylanan" },
  { id: "rejected", label: "Reddedilen" },
  { id: "shopier", label: "Kart Ödemeleri" },
  { id: "all", label: "Tümü" },
];

export function AdminPaymentOperations() {
  const [orders, setOrders] = useState<PaymentOrder[]>([]);
  const [counts, setCounts] = useState<Counts>({ queue: 0, approved: 0, rejected: 0, shopier: 0, all: 0 });
  const [filter, setFilter] = useState<Filter>("queue");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [openedAt] = useState(() => Date.now());
  const wait = (order: PaymentOrder) => waitingBadge(order.submitted_at ?? order.created_at, openedAt);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [canApprove, setCanApprove] = useState(false);
  const [copied, setCopied] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const response = await fetch("/api/admin/payments", { cache: "no-store" });
    const body = await response.json().catch(() => ({}));
    setLoading(false);
    if (!response.ok) return setError(body.error ?? "Ödemeler yüklenemedi.");
    setOrders(body.orders ?? []);
    setCounts({ queue: 0, approved: 0, rejected: 0, shopier: 0, all: 0, ...(body.counts ?? {}) });
    setCanApprove(Boolean(body.permissions?.canApprove));
  }, []);

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  const visible = useMemo(() => orders.filter((order) => {
    const inTab = filter === "all"
      || (filter === "queue" && order.status === "under_review")
      || (filter === "approved" && order.status === "approved")
      || (filter === "rejected" && order.status === "rejected")
      || (filter === "shopier" && (order.provider === "shopier" || order.provider === "lemon_squeezy"));
    if (!inTab) return false;
    const needle = query.trim().toLocaleLowerCase("tr-TR");
    if (!needle) return true;
    return [order.payment_reference, order.profiles?.display_name, order.email, order.phone, order.sender_full_name]
      .filter(Boolean).join(" ").toLocaleLowerCase("tr-TR").includes(needle);
  }), [filter, orders, query]);

  const mutate = async (order: PaymentOrder, action: "approve" | "reject") => {
    const reason = action === "reject" ? window.prompt("Ret nedenini yazın:")?.trim() : undefined;
    if (action === "reject" && !reason) return;
    if (action === "approve" && !window.confirm(order.provider === "shopier"
      ? `Shopier satıcı panelinde ${order.external_reference || "sipariş numarası yok"} numaralı siparişi, ${Number(order.amount).toLocaleString("tr-TR")} ${order.currency} tutarını ve ödenmiş durumunu doğruladınız mı? Onay Noir erişimini açar.`
      : `${order.payment_reference} kodlu ödemeyi onaylayıp Noir erişimini açmak istiyor musunuz?`)) return;
    setBusy(order.id);
    setError("");
    const response = await fetch("/api/admin/payments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, orderId: order.id, ...(reason ? { reason } : {}) }),
    });
    const body = await response.json().catch(() => ({}));
    setBusy("");
    if (!response.ok) return setError(body.error ?? "İşlem tamamlanamadı.");
    await load();
    window.dispatchEvent(new Event("lovask:admin-counts"));
  };

  const copy = async (reference: string) => {
    await navigator.clipboard.writeText(reference);
    setCopied(reference);
    window.setTimeout(() => setCopied(""), 1600);
  };

  return <section className="payment-ledger" aria-labelledby="payment-ledger-title">
    <header className="payment-ledger-head">
      <div><small>NOIR FİNANS MASASI</small><h1 id="payment-ledger-title">Ödeme hareketleri</h1><p>Bekleyen bildirimleri inceleyin; Shopier işlemlerini ve tamamlanan kayıtları tek akışta izleyin.</p></div>
      <span className="ledger-actions"><a className="export-link" href="/api/admin/export?type=payments" download>CSV indir</a>
<button className="ledger-refresh" onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? "spin" : ""}/> Yenile</button></span>
    </header>

    <nav className="payment-tabs" aria-label="Ödeme filtreleri">
      {tabs.map((tab) => <button key={tab.id} className={filter === tab.id ? "active" : ""} onClick={() => setFilter(tab.id)}>
        {tab.label}<b>{counts[tab.id] ?? 0}</b>
      </button>)}
    </nav>

    <div className="payment-search"><Search/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="LVK kodu, kullanıcı, e-posta veya telefon ara" /></div>
    {error ? <p className="payment-ledger-error" role="alert">{error}</p> : null}

    {loading ? <div className="payment-empty"><LoaderCircle className="spin"/><strong>Ödemeler yükleniyor</strong></div> : visible.length ? <div className="payment-ledger-list">
      {visible.map((order) => <article className={`payment-slip status-${order.status}`} key={order.id}>
        <div className="payment-slip-rail"><small>ÖDEME KODU</small><button onClick={() => void copy(order.payment_reference)}><code>{order.payment_reference}</code><Copy/>{copied === order.payment_reference ? <span>Kopyalandı</span> : null}</button></div>
        <div className="payment-slip-main">
          <header><div><small>{providerLabel(order.provider)}</small><h2>{order.profiles?.display_name ?? "İsimsiz kullanıcı"}</h2></div><span className={`payment-state state-${order.status}`}>{statusLabel(order)}</span>{order.status === "under_review" && wait(order) ? <em className="wait-badge" data-tone={wait(order)?.tone}>{wait(order)?.label}</em> : null}</header>
          <div className="payment-facts">
            <span><small>Paket</small><strong>{order.premium_plans?.name ?? "Noir"}</strong></span>
            <span><small>Tutar</small><strong>{Number(order.amount).toLocaleString("tr-TR")} {order.currency}</strong></span>
            <span><small>Oluşturuldu</small><strong>{formatDate(order.created_at)}</strong></span>
            <span><small>İletişim</small><strong>{order.email ?? order.phone ?? "—"}</strong></span>
          </div>
          {order.sender_full_name || order.external_reference ? <div className="payment-evidence"><span>{order.sender_full_name ?? "Gönderen belirtilmedi"}</span><span>{order.payment_date ? formatDate(order.payment_date) : "Tarih belirtilmedi"}</span><code>{order.external_reference || "İşlem numarası yok"}</code></div> : null}
          {order.rejection_reason ? <p className="payment-rejection">Ret nedeni: {order.rejection_reason}</p> : null}
          <footer>
            {order.proofUrl ? <a href={order.proofUrl} target="_blank" rel="noreferrer"><ExternalLink/> Dekontu aç</a> : <span className="no-proof">Dekont eklenmemiş</span>}
            {order.status === "under_review" && canApprove ? <div className="payment-review-actions"><button className="reject" disabled={busy === order.id} onClick={() => void mutate(order, "reject")}><X/> Reddet</button><button className="approve" disabled={busy === order.id} onClick={() => void mutate(order, "approve")}>{busy === order.id ? <LoaderCircle className="spin"/> : <Check/>} Onayla ve Noir&apos;ı aç</button></div> : null}
            {order.status === "under_review" && !canApprove ? <span className="owner-only"><ShieldCheck/> Son onay yalnızca hesap sahibinde</span> : null}
          </footer>
        </div>
      </article>)}
    </div> : <div className="payment-empty"><ShieldCheck/><strong>{filter === "queue" ? "İncelenecek ödeme yok" : "Bu görünümde kayıt yok"}</strong><p>{filter === "queue" ? "Yeni ödeme bildirimi geldiğinde burada ve menü rozetinde aynı anda görünecek." : "Farklı bir sekme veya arama deneyin."}</p></div>}
  </section>;
}

function formatDate(value: string) { return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: value.includes("T") ? "short" : undefined }).format(new Date(value)); }
function providerLabel(provider: string) { return ({ shopier: "Shopier · Panelden doğrula", lemon_squeezy: "Lemon Squeezy · Otomatik", bank_transfer: "Havale / EFT", papara: "Papara", crypto: "Kripto" } as Record<string, string>)[provider] ?? provider; }
function statusLabel(order: PaymentOrder) {
  if (order.provider === "shopier" && order.status === "approved") return "Yönetici onayladı · Shopier";
  if (order.provider === "lemon_squeezy" && order.status === "approved") return "Otomatik Onaylandı · Lemon Squeezy";
  return ({ pending: "Kart ödemesi bekleniyor", awaiting_payment: "Ödeme bekleniyor", under_review: "İnceleme bekliyor", approved: "Onaylandı", rejected: "Reddedildi", cancelled: "İptal edildi", expired: "Süresi doldu" } as Record<string, string>)[order.status] ?? order.status;
}
