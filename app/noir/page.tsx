"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  CreditCard,
  Crown,
  LoaderCircle,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  Star,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { useDialog } from "@/lib/use-dialog";
import { Brand } from "@/components/brand";
import { HistoryBackButton } from "@/components/history-back-button";
import "./noir.css";
import "./shopier-payment.css";
import "./manual-payment.css";
import "./payment-experience.css";
import "./noir-light.css";

type Plan = {
  slug: string;
  name: string;
  duration_days: number;
  duration_minutes?: number | null;
  price_amount: number;
  currency: string;
};
type Order = {
  id: string;
  status: string;
  payment_reference: string;
  amount: number;
  currency: string;
  provider: string;
  checkout_url?: string | null;
  created_at: string;
  rejection_reason?: string | null;
  premium_plans?: { name: string } | null;
};
type ManualProvider = "bank_transfer" | "papara" | "crypto";
type PaymentMethod = {
  method: ManualProvider;
  enabled: boolean;
  account_name: string | null;
  bank_name: string | null;
  iban: string | null;
  papara_number: string | null;
  crypto_asset: string | null;
  crypto_network: string | null;
  wallet_address: string | null;
  instructions: string | null;
};
type Feedback = {
  kind: "success" | "error";
  title: string;
  message: string;
  reference?: string;
  checkoutUrl?: string;
};

export default function NoirPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [noirUntil, setNoirUntil] = useState<string | null>(null);
  const [shopierEnabled, setShopierEnabled] = useState(false);
  const [shopierPlans, setShopierPlans] = useState<string[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [busy, setBusy] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [copied, setCopied] = useState("");

  const load = useCallback(async () => {
    setLoadingPlans(true);
    try {
      const response = await fetch("/api/noir", { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        return setFeedback({
          kind: "error",
          title: "Paketler yüklenemedi",
          message: body.error ?? "Lütfen biraz sonra tekrar deneyin.",
        });
      setPlans(body.plans ?? []);
      setOrders(body.orders ?? []);
      setNoirUntil(body.noirUntil);
      setShopierEnabled(Boolean(body.shopierEnabled));
      setShopierPlans(body.shopierPlans ?? []);
      setPaymentMethods(body.paymentMethods ?? []);
    } catch {
      setFeedback({
        kind: "error",
        title: "Paketler yüklenemedi",
        message: "Bağlantını kontrol edip tekrar dene.",
      });
    } finally {
      setLoadingPlans(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    if (feedback?.kind !== "success" || feedback.checkoutUrl) return;
    const timer = window.setTimeout(() => setFeedback(null), 4000);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const createOrder = async (
    planSlug: string,
    provider: ManualProvider | "shopier",
  ) => {
    setBusy(`${planSlug}:${provider}`);
    try {
      const response = await fetch("/api/noir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planSlug, provider }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        return setFeedback({
          kind: "error",
          title: "Ödeme başlatılamadı",
          message:
            body.error ?? "Lütfen bilgileri kontrol edip tekrar deneyin.",
        });
      if (provider === "shopier" && body.checkoutUrl) {
        setFeedback({
          kind: "success",
          title: "Shopier'e geçmeden önce",
          message:
            "Ödeme sonrası Shopier sipariş numaranı bu sayfadaki ödeme bildirimi formuna yaz. Sipariş Shopier panelinde doğrulanıp yönetici onaylayınca Noir açılır. Lovask kodunu da sakla.",
          reference: body.order?.payment_reference,
          checkoutUrl: body.checkoutUrl,
        });
        await load();
        return;
      }
      if (provider === "shopier")
        return setFeedback({
          kind: "error",
          title: "Kart ekranı açılamadı",
          message:
            "Ödeme bağlantısı hazırlanamadı. Biraz sonra tekrar deneyin.",
        });
      const reference = body.order?.payment_reference as string | undefined;
      setFeedback({
        kind: "success",
        title: "Ödeme talebin hazır",
        message:
          "Havale açıklamasına LVK kodunu aynen yaz. Ardından ödeme bildirimini gönderebilirsin.",
        reference,
      });
      await load();
    } catch {
      setFeedback({
        kind: "error",
        title: "Ödeme başlatılamadı",
        message: "Bağlantını kontrol edip tekrar dene.",
      });
    } finally {
      setBusy("");
    }
  };

  const submitPayment = async (
    event: FormEvent<HTMLFormElement>,
    orderId: string,
    provider: string,
  ) => {
    event.preventDefault();
    setBusy(orderId);
    try {
      const form = new FormData(event.currentTarget);
      form.set("orderId", orderId);
      const response = await fetch("/api/noir/proof", {
        method: "POST",
        body: form,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok)
        return setFeedback({
          kind: "error",
          title: "Bildirim gönderilemedi",
          message: body.error ?? "Bilgileri kontrol edip tekrar deneyin.",
        });
      setFeedback({
        kind: "success",
        title: "Ödeme bildirimin alındı",
        message:
          provider === "shopier"
            ? "Ekibimiz siparişini Shopier panelinde doğrulayacak. Yönetici onayladığında Noir erişimin açılacak."
            : "Ekibimiz ödemeni inceleyecek. Yönetici onayladığında Noir erişimin açılacak.",
      });
      await load();
    } catch {
      setFeedback({
        kind: "error",
        title: "Bildirim gönderilemedi",
        message: "Bağlantını kontrol edip tekrar dene.",
      });
    } finally {
      setBusy("");
    }
  };

  const copyReference = async (reference: string) => {
    await navigator.clipboard.writeText(reference);
    setCopied(reference);
    window.setTimeout(() => setCopied(""), 1600);
  };

  const active = Boolean(noirUntil && new Date(noirUntil) > new Date());
  const visibleManualMethods = paymentMethods.filter(
    (method) => method.enabled,
  );
  return (
    <main className="noir-stage">
      <div className="noir-shell">
        <header>
          <HistoryBackButton
            fallback="/?tab=profile"
            label="Önceki sayfaya dön"
            style={{
              justifySelf: "start",
              padding: 0,
              border: 0,
              background: "none",
              color: "inherit",
              cursor: "pointer",
            }}
          >
            <ArrowLeft />
          </HistoryBackButton>
          <Brand />
          <span className={active ? "access active" : "access"}>
            {active ? "Noir açık" : "Ücretsiz plan"}
          </span>
        </header>

        <section className="noir-hero">
          <div className="noir-seal">
            <Crown />
          </div>
          <small>SÜRELİ ERİŞİM BİLETİ</small>
          <h1>
            Lovask <em>Noir</em>
          </h1>
          <p>
            Tek sefer öde. Seçtiğin süre boyunca Noir ayrıcalıklarını kullan;
            süre bittiğinde erişim kendiliğinden kapanır.
          </p>
          <div className="no-renew">
            <ShieldCheck />
            <span>
              <strong>Abonelik yok</strong>
              <small>Otomatik yenileme ve sonraki çekim yok.</small>
            </span>
          </div>
        </section>

        <section
          className="noir-compare"
          aria-label="Ücretsiz ve Noir karşılaştırması"
        >
          <article>
            <small>Ücretsiz</small>
            <h2>Temel deneyim</h2>
            <ul>
              <li>
                <Check /> Günlük 10 beğeni
              </li>
              <li>
                <Check /> Standart filtreler
              </li>
              <li>
                <Check /> Eşleşme ve mesajlaşma
              </li>
            </ul>
          </article>
          <article className="featured">
            <small>Noir</small>
            <h2>Daha fazla kontrol</h2>
            <ul>
              <li>
                <Check /> Sınırsız beğeni
              </li>
              <li>
                <Check /> Seni beğenenleri gör
              </li>
              <li>
                <Check /> Geri al + günlük Süper Beğeni
              </li>
              <li>
                <Check /> Haftada 1 kez 30 dakika Boost
              </li>
            </ul>
          </article>
        </section>

        <section className="plan-grid">
          {loadingPlans ? (
            <div className="noir-plan-state">
              <LoaderCircle className="spin" />
              <strong>Paketler hazırlanıyor…</strong>
            </div>
          ) : plans.length ? (
            plans.map((plan) => (
              <article key={plan.slug} className="noir-plan-ticket">
                <small>
                  {plan.duration_minutes
                    ? `${plan.duration_minutes / 60} SAATLİK ERİŞİM`
                    : `${plan.duration_days} GÜNLÜK ERİŞİM`}
                </small>
                <h2>{plan.name}</h2>
                <strong>
                  {Number(plan.price_amount).toLocaleString("tr-TR")}{" "}
                  <i>{plan.currency}</i>
                </strong>
                <ul>
                  <li>
                    <Check /> Sınırsız Beğeni
                  </li>
                  <li>
                    <Check /> Seni beğenenleri gör
                  </li>
                  <li>
                    <Check /> Okundu bilgisi
                  </li>
                  <li>
                    <Check /> Son görülme
                  </li>
                  <li>
                    <Check /> Ziyaretçi detayları
                  </li>
                  <li>
                    <RotateCcw /> Son kararı geri alma
                  </li>
                  <li>
                    <Star /> Her gün 1 Süper Beğeni
                  </li>
                  <li>
                    <Zap /> Haftada 1 kez 30 dakika Boost
                  </li>
                  <li>
                    <Clock3 /> Süre sonunda otomatik kapanış
                  </li>
                </ul>
                <details className="payment-picker">
                  <summary>
                    <span>Ödeme seçenekleri</span>
                    <small>
                      {shopierEnabled
                        ? "Kart veya alternatif yöntemler"
                        : "Alternatif ödeme yöntemleri"}
                    </small>
                  </summary>
                  <div className="noir-payment-actions">
                    {shopierEnabled && shopierPlans.includes(plan.slug) ? (
                      <button
                        className="shopier noir-card-primary"
                        disabled={Boolean(busy)}
                        onClick={() => void createOrder(plan.slug, "shopier")}
                      >
                        {busy === `${plan.slug}:shopier` ? (
                          <LoaderCircle className="spin" />
                        ) : (
                          <CreditCard />
                        )}
                        <span>
                          Kartla ödeme
                          <small>Ödeme sonrası sipariş numaranı bildir</small>
                        </span>
                      </button>
                    ) : null}
                    {visibleManualMethods.map((method) => (
                      <button
                        key={method.method}
                        className="noir-bank-secondary"
                        disabled={Boolean(busy)}
                        onClick={() =>
                          void createOrder(plan.slug, method.method)
                        }
                      >
                        {busy === `${plan.slug}:${method.method}` ? (
                          <LoaderCircle className="spin" />
                        ) : method.method === "crypto" ? (
                          <Star />
                        ) : (
                          <ReceiptText />
                        )}{" "}
                        {method.method === "bank_transfer"
                          ? "Havale ile ödeme"
                          : method.method === "papara"
                            ? "Papara ile öde"
                            : "Kripto ile öde"}
                      </button>
                    ))}
                    {!shopierEnabled && !visibleManualMethods.length ? (
                      <small className="shopier-note">
                        Aktif ödeme yöntemi bulunmuyor.
                      </small>
                    ) : null}
                  </div>
                </details>
              </article>
            ))
          ) : (
            <div className="noir-plan-state">
              <strong>Aktif Noir paketi bulunamadı.</strong>
              <button type="button" onClick={() => void load()}>
                <RotateCcw /> Yeniden dene
              </button>
            </div>
          )}
        </section>

        {visibleManualMethods.length ? (
          <details className="payment-account-details">
            <summary>Ödeme hesabı bilgileri</summary>
            <section className="payment-destinations noir-bank-destination">
              {visibleManualMethods.map((method) => (
                <article key={method.method}>
                  <small>{providerLabel(method.method)} BİLGİLERİ</small>
                  {method.account_name ? (
                    <strong>{method.account_name}</strong>
                  ) : null}
                  {method.bank_name ? <span>{method.bank_name}</span> : null}
                  <code>
                    {method.method === "bank_transfer"
                      ? method.iban
                      : method.method === "papara"
                        ? method.papara_number
                        : `${method.crypto_asset} · ${method.crypto_network}\n${method.wallet_address}`}
                  </code>
                  <p>
                    {method.instructions ||
                      "Ödeme açıklamasına siparişindeki LVK kodunu aynen yaz."}
                  </p>
                </article>
              ))}
            </section>
          </details>
        ) : null}

        {active ? (
          <section className="current-ticket">
            <span>Mevcut erişimin</span>
            <strong>
              {new Intl.DateTimeFormat("tr-TR", {
                dateStyle: "long",
                timeStyle: "short",
              }).format(new Date(noirUntil!))}
            </strong>
            <small>tarihine kadar açık.</small>
          </section>
        ) : null}

        {orders.length ? (
          <section className="order-list noir-order-ledger">
            <header>
              <small>ÖDEME GEÇMİŞİN</small>
              <h2>Talep ve ödemeler</h2>
            </header>
            {orders.map((order) => (
              <article
                className={`noir-order-ticket status-${order.status}`}
                key={order.id}
              >
                <div className="noir-order-summary">
                  <div>
                    <small>{providerLabel(order.provider)}</small>
                    <strong>{order.premium_plans?.name ?? "Noir"}</strong>
                    <span>
                      {new Intl.DateTimeFormat("tr-TR", {
                        dateStyle: "medium",
                      }).format(new Date(order.created_at))}
                    </span>
                  </div>
                  <span className="noir-order-status">
                    {orderStatus(order)}
                  </span>
                </div>
                <div className="lvk-reference">
                  <span>
                    <small>{order.provider === "shopier" ? "LOVASK KODU" : "ÖDEME AÇIKLAMASI"}</small>
                    <code>{order.payment_reference}</code>
                  </span>
                  <button
                    type="button"
                    onClick={() => void copyReference(order.payment_reference)}
                  >
                    <Copy />
                    {copied === order.payment_reference
                      ? "Kopyalandı"
                      : "Kopyala"}
                  </button>
                </div>
                {order.status === "pending" &&
                (order.provider === "shopier" ||
                  order.provider === "lemon_squeezy") &&
                order.checkout_url ? (
                  <a
                    className="shopier-payment-link"
                    href={order.checkout_url}
                    rel="noreferrer"
                  >
                    Kart ödemesine devam et
                  </a>
                ) : null}
                {((order.status === "awaiting_payment" &&
                  (["bank_transfer", "papara", "crypto"] as string[]).includes(order.provider)) ||
                  (order.status === "pending" && order.provider === "shopier")) ? (
                  <form
                    className="payment-report"
                    onSubmit={(event) => void submitPayment(event, order.id, order.provider)}
                  >
                    <header>
                      <div>
                        <small>SON ADIM</small>
                        <h3>Ödemeyi bildir</h3>
                      </div>
                      <span>{order.provider === "shopier" ? "Sipariş numarası zorunlu" : "Dekont zorunlu değil"}</span>
                    </header>
                    <div className="lvk-form-reminder">
                      <ReceiptText />
                      <span>
                        {order.provider === "shopier" ? "Lovask takip kodun" : "Ödeme açıklamasına yazılacak kod"}
                        <strong>{order.payment_reference}</strong>
                      </span>
                    </div>
                    <label>
                      {order.provider === "shopier" ? "Shopier alıcı ad soyad" : "Gönderen ad soyad"}
                      <input
                        name="senderFullName"
                        required
                        minLength={3}
                        maxLength={120}
                        autoComplete="name"
                      />
                    </label>
                    <label>
                      Ödeme tarihi
                      <input
                        name="paymentDate"
                        required
                        type="date"
                        max={new Date().toISOString().slice(0, 10)}
                      />
                    </label>
                    <label>
                      {order.provider === "shopier" ? "Shopier sipariş numarası" : "İşlem / transfer numarası"} {order.provider !== "shopier" ? <small>Varsa</small> : null}
                      <input name="externalReference" required={order.provider === "shopier"} minLength={order.provider === "shopier" ? 4 : undefined} maxLength={160} />
                    </label>
                    <label>
                      Dekont{" "}
                      <small>
                        İncelemeyi hızlandırmak için önerilir · en fazla 5 MB
                      </small>
                      <input
                        name="proof"
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                      />
                    </label>
                    <button disabled={busy === order.id}>
                      {busy === order.id ? (
                        <LoaderCircle className="spin" />
                      ) : (
                        <ShieldCheck />
                      )}{" "}
                      İncelemeye gönder
                    </button>
                  </form>
                ) : null}
                {order.rejection_reason ? (
                  <small className="reject-note">
                    {order.rejection_reason}
                  </small>
                ) : null}
              </article>
            ))}
          </section>
        ) : null}
      </div>
      {feedback ? (
        <FeedbackModal
          feedback={feedback}
          onClose={() => setFeedback(null)}
          onCopy={copyReference}
          copied={copied}
        />
      ) : null}
    </main>
  );
}

function FeedbackModal({
  feedback,
  onClose,
  onCopy,
  copied,
}: {
  feedback: Feedback;
  onClose: () => void;
  onCopy: (value: string) => Promise<void>;
  copied: string;
}) {
  const dialog = useDialog<HTMLElement>(onClose);
  return (
    <div
      className="payment-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialog}
        tabIndex={-1}
        className={`payment-feedback-modal ${feedback.kind}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="payment-feedback-title"
      >
        <button
          className="payment-modal-close"
          onClick={onClose}
          aria-label="Kapat"
        >
          <X />
        </button>
        <div className="payment-modal-icon">
          {feedback.kind === "success" ? <CheckCircle2 /> : <XCircle />}
        </div>
        <small>
          {feedback.checkoutUrl
            ? "ÖDEME HAZIR"
            : feedback.kind === "success"
              ? "İŞLEM TAMAMLANDI"
              : "BİR ŞEY TERS GİTTİ"}
        </small>
        <h2 id="payment-feedback-title">{feedback.title}</h2>
        <p>{feedback.message}</p>
        {feedback.reference ? (
          <div className="payment-modal-reference">
            <code>{feedback.reference}</code>
            <button onClick={() => void onCopy(feedback.reference!)}>
              <Copy />
              {copied === feedback.reference ? "Kopyalandı" : "Kopyala"}
            </button>
          </div>
        ) : null}
        <button
          className="payment-modal-confirm"
          onClick={
            feedback.checkoutUrl
              ? () => window.location.assign(feedback.checkoutUrl!)
              : onClose
          }
        >
          {feedback.checkoutUrl ? "Shopier'e devam et" : "Tamam"}
        </button>
        {feedback.kind === "success" && !feedback.checkoutUrl ? (
          <span className="payment-modal-timer">
            Bu pencere 4 saniye sonra kapanır.
          </span>
        ) : null}
      </section>
    </div>
  );
}

function orderStatus(order: Order) {
  if (
    (order.provider === "shopier" || order.provider === "lemon_squeezy") &&
    order.status === "approved"
  )
    return "Kart ödemesi onaylandı";
  return (
    (
      {
        pending: "Kart ödemesi bekleniyor",
        awaiting_payment: "Ödeme bekleniyor",
        under_review: "İncelemede",
        approved: "Onaylandı",
        rejected: "Reddedildi",
        cancelled: "İptal edildi",
        expired: "Süresi doldu",
      } as Record<string, string>
    )[order.status] ?? order.status
  );
}
function providerLabel(provider: string) {
  return (
    (
      {
        bank_transfer: "Havale / EFT",
        papara: "Papara",
        crypto: "Kripto",
        shopier: "Kartla ödeme",
        lemon_squeezy: "Kartla ödeme",
      } as Record<string, string>
    )[provider] ?? provider
  );
}
