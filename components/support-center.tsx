"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  ChevronDown,
  CircleHelp,
  LoaderCircle,
  MessageCircleMore,
  Plus,
  Send,
  X,
} from "lucide-react";
import "./support-center.css";

type TicketMessage = {
  id?: string;
  body: string;
  sender_admin_id: string | null;
  created_at: string;
};
type Ticket = {
  id: string;
  subject: string;
  category: string;
  status: string;
  priority: string;
  last_message_at: string;
  created_at: string;
  support_ticket_messages: TicketMessage[];
};

export function SupportCenter({ liveMode }: { liveMode: boolean }) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!liveMode) return;
    setLoading(true);
    try {
      const response = await fetch("/api/profile/support", {
        cache: "no-store",
      });
      const body = await response.json().catch(() => ({}));
      if (response.ok) setTickets(body.tickets ?? []);
      else setNotice(body.error ?? "Destek talepleri yüklenemedi.");
    } catch {
      setNotice("Bağlantı kurulamadı. Taleplerini görmek için tekrar dene.");
    } finally {
      setLoading(false);
    }
  }, [liveMode]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load, open]);

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sending) return;
    if (!liveMode) {
      setNotice(
        "Destek talebi göndermek için hesabına giriş yap. Demo formundaki bilgiler gönderilmez.",
      );
      return;
    }
    const element = event.currentTarget;
    const form = new FormData(element);
    setSending(true);
    try {
      setNotice("Talebin gönderiliyor…");
      const response = await fetch("/api/profile/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: form.get("subject"),
          category: form.get("category"),
          message: form.get("message"),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) return setNotice(body.error ?? "Talep açılamadı.");
      element.reset();
      setCreating(false);
      setNotice("Talebin açıldı. Yanıt geldiğinde burada görebilirsin.");
      await load();
    } catch {
      setNotice("Talebin gönderilemedi. Yazdıkların korundu; tekrar dene.");
    } finally {
      setSending(false);
    }
  };

  const reply = async (ticketId: string, message: string) => {
    if (!message.trim() || sending) return false;
    setSending(true);
    try {
      setNotice("Yanıtın gönderiliyor…");
      const response = await fetch("/api/profile/support", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId, message }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setNotice(body.error ?? "Yanıt gönderilemedi.");
        return false;
      }
      setNotice("Yanıtın gönderildi.");
      await load();
      return true;
    } catch {
      setNotice("Yanıtın gönderilemedi. Yazdıkların korundu; tekrar dene.");
      return false;
    } finally {
      setSending(false);
    }
  };

  const activeTicketCount = tickets.filter(
    (ticket) => ticket.status !== "closed",
  ).length;

  return (
    <div className={`hub-support-wrapper ${open ? "is-open" : ""}`}>
      <button
        className="hub-row-interactive hub-support-trigger"
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="profile-support-panel"
      >
        <span className="hub-row-icon">
          <CircleHelp size={16} />
        </span>
        <div className="hub-row-text">
          <strong>Yardım ve destek</strong>
          <small>Ekibimize yaz, yanıtları buradan takip et.</small>
        </div>
        <div className="hub-row-action">
          {activeTicketCount > 0 && (
            <span
              className="hub-badge-count"
              title={`${activeTicketCount} aktif talep`}
            >
              {activeTicketCount}
            </span>
          )}
          <ChevronDown
            size={16}
            className={`hub-chevron-icon ${open ? "rotated" : ""}`}
          />
        </div>
      </button>

      {open ? (
        <div className="hub-support-drawer" id="profile-support-panel">
          <header className="hub-support-head">
            <div>
              <small>Lovask Destek</small>
              <h4>Nasıl yardımcı olabiliriz?</h4>
              <a
                className="hub-support-email"
                href="mailto:destek@lovask.com.tr"
              >
                destek@lovask.com.tr
              </a>
            </div>
            <button
              type="button"
              className="hub-ticket-btn"
              onClick={() => setCreating((v) => !v)}
            >
              {creating ? (
                <>
                  <X size={13} /> Kapat
                </>
              ) : (
                <>
                  <Plus size={13} /> Yeni talep
                </>
              )}
            </button>
          </header>

          {creating ? (
            <form className="hub-ticket-form" onSubmit={create}>
              <label>
                <span>Konu</span>
                <input
                  name="subject"
                  required
                  minLength={3}
                  maxLength={120}
                  placeholder="Kısaca ne oldu?"
                />
              </label>
              <label>
                <span>Kategori</span>
                <select name="category" defaultValue="technical">
                  <option value="account">Hesap</option>
                  <option value="payment">Ödeme</option>
                  <option value="safety">Güvenlik</option>
                  <option value="technical">Teknik sorun</option>
                  <option value="other">Diğer</option>
                </select>
              </label>
              <label className="hub-ticket-full">
                <span>Mesaj</span>
                <textarea
                  name="message"
                  required
                  minLength={5}
                  maxLength={4000}
                  placeholder="Sorunu ve gördüğün hata mesajını anlat."
                />
              </label>
              <button
                type="submit"
                className="hub-submit-ticket-btn"
                disabled={sending}
              >
                {sending ? (
                  <LoaderCircle size={14} className="spin" />
                ) : (
                  <Send size={14} />
                )}{" "}
                {sending ? "Gönderiliyor…" : "Talep gönder"}
              </button>
            </form>
          ) : null}

          {notice ? (
            <p className="hub-support-notice" role="status">
              {notice}
            </p>
          ) : null}

          {loading && !tickets.length ? (
            <p className="hub-support-empty">
              <LoaderCircle className="spin" size={15} /> Talepler yükleniyor…
            </p>
          ) : tickets.length ? (
            <div className="hub-ticket-list">
              {tickets.map((ticket) => (
                <SupportTicket
                  key={ticket.id}
                  ticket={ticket}
                  onReply={reply}
                  sending={sending}
                />
              ))}
            </div>
          ) : (
            <p className="hub-support-empty">
              Henüz aktif bir destek talebin yok.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function SupportTicket({
  ticket,
  onReply,
  sending,
}: {
  ticket: Ticket;
  onReply: (id: string, message: string) => Promise<boolean>;
  sending: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState("");
  const messages = ticket.support_ticket_messages.toSorted(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  return (
    <article className="hub-ticket-item">
      <button
        type="button"
        className="hub-ticket-summary"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <div className="hub-ticket-info">
          <strong>{ticket.subject}</strong>
          <small>
            {categoryLabel(ticket.category)} ·{" "}
            {formatDate(ticket.last_message_at)}
          </small>
        </div>
        <i className={`hub-status-tag tag-${ticket.status}`}>
          {statusLabel(ticket.status)}
        </i>
        <ChevronDown
          size={14}
          className={`hub-chevron-icon ${expanded ? "rotated" : ""}`}
        />
      </button>

      {expanded ? (
        <div className="hub-ticket-thread">
          {messages.map((message, index) => (
            <div
              className={`hub-thread-bubble ${
                message.sender_admin_id ? "from-admin" : "from-user"
              }`}
              key={message.id ?? `${message.created_at}-${index}`}
            >
              <small>{message.sender_admin_id ? "Lovask Destek" : "Sen"}</small>
              <p>{message.body}</p>
            </div>
          ))}

          {ticket.status !== "closed" ? (
            <form
              className="hub-reply-form"
              onSubmit={(event) => {
                event.preventDefault();
                void onReply(ticket.id, draft).then((sent) => {
                  if (sent) setDraft("");
                });
              }}
            >
              <input
                value={draft}
                aria-label="Destek talebine yanıt"
                disabled={sending}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Yanıtını yaz…"
                maxLength={4000}
              />
              <button
                aria-label="Yanıtı gönder"
                type="submit"
                disabled={sending || !draft.trim()}
              >
                <MessageCircleMore size={15} />
              </button>
            </form>
          ) : (
            <small className="hub-ticket-closed-note">
              Bu talep tamamlandı ve kapatıldı.
            </small>
          )}
        </div>
      ) : null}
    </article>
  );
}

function statusLabel(value: string) {
  return (
    (
      {
        open: "Açık",
        waiting: "Beklemede",
        in_progress: "İşleniyor",
        closed: "Tamamlandı",
      } as Record<string, string>
    )[value] ?? value
  );
}

function categoryLabel(value: string) {
  return (
    (
      {
        account: "Hesap",
        payment: "Ödeme",
        safety: "Güvenlik",
        technical: "Teknik",
        other: "Diğer",
      } as Record<string, string>
    )[value] ?? value
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
