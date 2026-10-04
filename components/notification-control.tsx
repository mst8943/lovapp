"use client";

import { Bell, BellOff, LoaderCircle, Moon } from "lucide-react";
import { useEffect, useState } from "react";
import "./notification-control.css";

type NotificationState = "checking" | "off" | "on" | "busy" | "unsupported" | "denied";

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(window.atob(base64), (character) => character.charCodeAt(0));
}

export function NotificationControl({ liveMode }: { liveMode: boolean }) {
  const [state, setState] = useState<NotificationState>("checking");
  const [notice, setNotice] = useState("");
  const [quietEnabled, setQuietEnabled] = useState(true);
  const [quietStart, setQuietStart] = useState("23:00");
  const [quietEnd, setQuietEnd] = useState("09:00");
  const [showQuietSettings, setShowQuietSettings] = useState(false);
  const [savingQuiet, setSavingQuiet] = useState(false);

  useEffect(() => {
    const inspect = async () => {
      await Promise.resolve();
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setState("unsupported");
        return;
      }
      if (!liveMode) { setState("off"); return; }
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        setState(subscription ? "on" : Notification.permission === "denied" ? "denied" : "off");
      } catch { setState("off"); }
    };
    void inspect();
    if (liveMode) void fetch("/api/push/preferences", { cache: "no-store" }).then(async (response) => {
      if (!response.ok) return;
      const data = await response.json().catch(() => ({})); const preferences = data.preferences;
      if (preferences) {
        setQuietEnabled(Boolean(preferences.quiet_hours_enabled));
        if (preferences.quiet_start) setQuietStart(String(preferences.quiet_start).slice(0, 5));
        if (preferences.quiet_end) setQuietEnd(String(preferences.quiet_end).slice(0, 5));
      }
    }).catch(() => setNotice("Bildirim tercihleri yüklenemedi. Bağlantını kontrol et."));
  }, [liveMode]);

  const saveQuietHours = async () => {
    if (savingQuiet) return;
    if (!liveMode) { setNotice("Sessiz saatler demo için kaydedildi."); return; }
    if (!quietStart || !quietEnd) { setNotice("Başlangıç ve bitiş saatlerini seç."); return; }
    setSavingQuiet(true);
    try {
    const response = await fetch("/api/push/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quietHoursEnabled: quietEnabled,
        quietStart,
        quietEnd,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Istanbul",
      }),
    });
    const data = await response.json().catch(() => ({}));
    setNotice(response.ok ? "Sessiz saatler kaydedildi." : data.error ?? "Sessiz saatler kaydedilemedi.");
    } catch { setNotice("Saatler kaydedilemedi. Bağlantını kontrol edip tekrar dene."); }
    finally { setSavingQuiet(false); }
  };

  const toggle = async () => {
    if (state === "busy" || state === "checking" || state === "unsupported") return;
    if (!liveMode) {
      setState(state === "on" ? "off" : "on");
      setNotice(state === "on" ? "Bildirimler kapatıldı." : "Demo bildirimleri açıldı.");
      return;
    }
    setState("busy");
    setNotice("");
    try {
      const registration = await navigator.serviceWorker.ready;
      const current = await registration.pushManager.getSubscription();
      if (current) {
        const endpoint = current.endpoint;
        await current.unsubscribe();
        await fetch("/api/push/subscriptions", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint }),
        });
        setState("off");
        setNotice("Mesaj bildirimleri kapatıldı.");
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("denied");
        setNotice("Bildirim izni tarayıcı ayarlarından açılabilir.");
        return;
      }
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) throw new Error("push_not_configured");
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const payload = subscription.toJSON();
      const response = await fetch("/api/push/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        await subscription.unsubscribe();
        throw new Error("subscription_not_saved");
      }
      setState("on");
      setNotice("Yeni mesaj bildirimleri açık.");
    } catch {
      setState("off");
      setNotice("Bildirimler şu anda etkinleştirilemedi.");
    }
  };

  const enabled = state === "on";

  return (
    <div className={`hub-notification-wrapper ${enabled ? "is-enabled" : ""}`}>
      <div className="hub-row-interactive">
        <span className="hub-row-icon">
          {enabled ? <Bell size={16} /> : <BellOff size={16} />}
        </span>
        <div className="hub-row-text">
          <strong>Mesaj bildirimleri</strong>
          <small>
            {state === "unsupported"
              ? "Tarayıcı desteklemiyor"
              : enabled
              ? `${quietEnabled ? `Açık · Sessiz: ${quietStart} - ${quietEnd}` : "Açık · Her an iletilir"}`
              : "Yeni mesajlardan anında haberdar ol"}
          </small>
        </div>
        <div className="hub-row-action">
          {enabled && (
            <button
              type="button"
              className="hub-quiet-toggle-btn"
              onClick={() => setShowQuietSettings((v) => !v)}
              title="Sessiz saatleri ayarla"
              aria-label="Sessiz saatleri ayarla"
              aria-expanded={showQuietSettings}
            >
              <Moon size={14} />
            </button>
          )}
          <button
            type="button"
            className={`hub-pill-toggle ${enabled ? "active" : ""}`}
            onClick={toggle}
            disabled={state === "busy" || state === "checking" || state === "unsupported"}
            role="switch"
            aria-checked={enabled}
            aria-label="Mesaj bildirimleri"
          >
            {state === "busy" || state === "checking" ? (
              <LoaderCircle className="spin" size={13} />
            ) : enabled ? (
              "Açık"
            ) : (
              "Aç"
            )}
          </button>
        </div>
      </div>

      {notice ? <p className="profile-feedback" role="status">{notice}</p> : null}

      {enabled && showQuietSettings ? (
        <div className="hub-quiet-drawer">
          <div className="hub-quiet-head">
            <label className="hub-quiet-check">
              <input
                type="checkbox"
                checked={quietEnabled}
                onChange={(e) => setQuietEnabled(e.target.checked)}
              />
              <span>Sessiz saatler devrede</span>
            </label>
            <button type="button" className="hub-quiet-save" onClick={saveQuietHours} disabled={savingQuiet}>
              {savingQuiet ? "Kaydediliyor…" : "Kaydet"}
            </button>
          </div>
          <div className="hub-quiet-times">
            <div className="hub-time-field">
              <small>Başlangıç</small>
              <input
                aria-label="Sessiz saat başlangıcı"
                type="time"
                value={quietStart}
                onChange={(e) => setQuietStart(e.target.value)}
                disabled={!quietEnabled}
              />
            </div>
            <span className="hub-time-sep">—</span>
            <div className="hub-time-field">
              <small>Bitiş</small>
              <input
                aria-label="Sessiz saat bitişi"
                type="time"
                value={quietEnd}
                onChange={(e) => setQuietEnd(e.target.value)}
                disabled={!quietEnabled}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
