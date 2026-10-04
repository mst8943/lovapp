"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  Bitcoin,
  Building2,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  LoaderCircle,
  Smartphone,
} from "lucide-react";
import { useAdminRole } from "@/components/admin-role-context";

type Method = "bank_transfer" | "papara" | "crypto";
type Setting = {
  method: Method;
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

const blank = (method: Method): Setting => ({
  method,
  enabled: false,
  account_name: "",
  bank_name: "",
  iban: "",
  papara_number: "",
  crypto_asset: "",
  crypto_network: "",
  wallet_address: "",
  instructions: "",
});

export function PaymentSettingsPanel() {
  const role = useAdminRole();
  const [settings, setSettings] = useState<Setting[]>([]);
  const [notice, setNotice] = useState("Ödeme kanalları yükleniyor…");
  const [saving, setSaving] = useState<Method | null>(null);
  const [openMethod, setOpenMethod] = useState<Method | null>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/payment-settings", {
      cache: "no-store",
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok)
      return setNotice(body.error ?? "Ödeme kanalları yüklenemedi.");
    const rows = (body.settings ?? []) as Setting[];
    setSettings(
      (["bank_transfer", "papara", "crypto"] as Method[]).map(
        (method) => rows.find((row) => row.method === method) ?? blank(method),
      ),
    );
    const result = new URLSearchParams(window.location.search).get("shopier");
    setNotice(
      result === "connected"
        ? "Shopier hesabı bağlandı."
        : result === "scope-error"
          ? "Shopier uygulamasında sipariş okuma ve mağaza okuma izinlerini açın."
          : result === "connection-error"
            ? "Shopier bağlantısı tamamlanamadı. Uygulama yönlendirme adresini kontrol edin."
            : "",
    );
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const update = (method: Method, patch: Partial<Setting>) =>
    setSettings((current) =>
      current.map((item) =>
        item.method === method ? { ...item, ...patch } : item,
      ),
    );
  const save = async (event: FormEvent<HTMLFormElement>, setting: Setting) => {
    event.preventDefault();
    setSaving(setting.method);
    setNotice("");
    const payload =
      setting.method === "bank_transfer"
        ? {
            method: setting.method,
            enabled: setting.enabled,
            accountName: setting.account_name ?? "",
            bankName: setting.bank_name ?? "",
            iban: setting.iban ?? "",
            instructions: setting.instructions ?? "",
          }
        : setting.method === "papara"
          ? {
              method: setting.method,
              enabled: setting.enabled,
              accountName: setting.account_name ?? "",
              paparaNumber: setting.papara_number ?? "",
              instructions: setting.instructions ?? "",
            }
          : {
              method: setting.method,
              enabled: setting.enabled,
              cryptoAsset: setting.crypto_asset ?? "",
              cryptoNetwork: setting.crypto_network ?? "",
              walletAddress: setting.wallet_address ?? "",
              instructions: setting.instructions ?? "",
            };
    const response = await fetch("/api/admin/payment-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => ({}));
    setSaving(null);
    if (!response.ok) return setNotice(body.error ?? "Ayar kaydedilemedi.");
    setNotice(`${methodLabel(setting.method)} ayarı kaydedildi.`);
    await load();
  };

  return (
    <section className="payment-settings">
      <header>
        <div>
          <small>Tahsilat kanalları</small>
          <h1>Ödeme ayarları</h1>
          <p>
            Kart sağlayıcısını seç, ihtiyaç duyduğun manuel ödeme yöntemlerini
            ayrı ayrı aç.
          </p>
        </div>
        <span>
          <CheckCircle2 size={16} /> Kart ödemeleri otomatik onaylanır
        </span>
      </header>
      {notice ? (
        <div className="payment-settings-notice" role="status">
          {notice}
        </div>
      ) : null}
      <div className="payment-card-provider">
        <div>
          <span className="provider-icon">
            <CreditCard />
          </span>
          <span>
            <small>Kart ödemeleri</small>
            <b>Shopier ürün bağlantısı</b>
          </span>
        </div>
        <div className="provider-options" aria-label="Kart ödeme sağlayıcısı">
          <button type="button" className="active" disabled>
            <span>Shopier</span>
            <small>Siparişler panelden doğrulanır</small>
          </button>
        </div>
      </div>
      <div className="manual-methods-heading">
        <div>
          <small>İncelemeli ödemeler</small>
          <h2>Manuel yöntemler</h2>
        </div>
        <p>
          Yalnızca açtığın yöntem üyeye görünür; bildirimler onay kuyruğuna
          düşer.
        </p>
      </div>
      <div className="payment-setting-grid">
        {settings.map((setting) => (
          <form
            className={openMethod === setting.method ? "open" : ""}
            key={setting.method}
            onSubmit={(event) => void save(event, setting)}
          >
            <header>
              <span className="method-identity">
                {setting.method === "bank_transfer" ? (
                  <Building2 />
                ) : setting.method === "papara" ? (
                  <Smartphone />
                ) : (
                  <Bitcoin />
                )}
                <span>
                  <b>{methodLabel(setting.method)}</b>
                  <small>{methodSummary(setting)}</small>
                </span>
              </span>
              <span className="method-actions">
                <label className="method-toggle">
                  <input
                    type="checkbox"
                    checked={setting.enabled}
                    disabled={role !== "owner"}
                    aria-label={`${methodLabel(setting.method)} yöntemini etkinleştir`}
                    onChange={(event) => {
                      update(setting.method, { enabled: event.target.checked });
                      setOpenMethod(setting.method);
                      setNotice(
                        event.target.checked
                          ? "Hesap bilgilerini tamamlayıp Değişiklikleri kaydet düğmesine basın."
                          : "Yöntemi kapatmak için Değişiklikleri kaydet düğmesine basın.",
                      );
                    }}
                  />
                  <i />
                  <em>{setting.enabled ? "Açık" : "Kapalı"}</em>
                </label>
                <button
                  className="method-disclosure"
                  type="button"
                  aria-expanded={openMethod === setting.method}
                  aria-label={`${methodLabel(setting.method)} ayarlarını ${openMethod === setting.method ? "kapat" : "aç"}`}
                  onClick={() =>
                    setOpenMethod((current) =>
                      current === setting.method ? null : setting.method,
                    )
                  }
                >
                  <ChevronDown />
                </button>
              </span>
            </header>
            <div
              className="method-fields"
              hidden={openMethod !== setting.method}
            >
              {setting.method === "bank_transfer" ? (
                <>
                  <label>
                    Hesap sahibi
                    <input
                      required={setting.enabled}
                      value={setting.account_name ?? ""}
                      onChange={(event) =>
                        update(setting.method, {
                          account_name: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Banka adı
                    <input
                      value={setting.bank_name ?? ""}
                      onChange={(event) =>
                        update(setting.method, {
                          bank_name: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    IBAN
                    <input
                      required={setting.enabled}
                      inputMode="text"
                      placeholder="TR…"
                      value={setting.iban ?? ""}
                      onChange={(event) =>
                        update(setting.method, { iban: event.target.value })
                      }
                    />
                  </label>
                </>
              ) : setting.method === "papara" ? (
                <>
                  <label>
                    Hesap sahibi
                    <input
                      required={setting.enabled}
                      value={setting.account_name ?? ""}
                      onChange={(event) =>
                        update(setting.method, {
                          account_name: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    Papara numarası
                    <input
                      required={setting.enabled}
                      inputMode="numeric"
                      value={setting.papara_number ?? ""}
                      onChange={(event) =>
                        update(setting.method, {
                          papara_number: event.target.value,
                        })
                      }
                    />
                  </label>
                </>
              ) : (
                <>
                  <div className="payment-field-pair">
                    <label>
                      Varlık
                      <input
                        required={setting.enabled}
                        placeholder="USDT"
                        value={setting.crypto_asset ?? ""}
                        onChange={(event) =>
                          update(setting.method, {
                            crypto_asset: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Ağ
                      <input
                        required={setting.enabled}
                        placeholder="TRC20"
                        value={setting.crypto_network ?? ""}
                        onChange={(event) =>
                          update(setting.method, {
                            crypto_network: event.target.value,
                          })
                        }
                      />
                    </label>
                  </div>
                  <label>
                    Cüzdan adresi
                    <input
                      required={setting.enabled}
                      value={setting.wallet_address ?? ""}
                      onChange={(event) =>
                        update(setting.method, {
                          wallet_address: event.target.value,
                        })
                      }
                    />
                  </label>
                </>
              )}
              <label>
                Ek açıklama
                <textarea
                  maxLength={500}
                  placeholder="Üyeye gösterilecek kısa talimat"
                  value={setting.instructions ?? ""}
                  onChange={(event) =>
                    update(setting.method, { instructions: event.target.value })
                  }
                />
              </label>
              <button disabled={role !== "owner" || saving === setting.method}>
                {saving === setting.method ? (
                  <LoaderCircle className="spin" size={15} />
                ) : null}
                {role === "owner"
                  ? "Değişiklikleri kaydet"
                  : "Yalnızca kurucu düzenleyebilir"}
              </button>
            </div>
          </form>
        ))}
      </div>
    </section>
  );
}

function methodLabel(method: Method) {
  return method === "bank_transfer"
    ? "Havale / EFT"
    : method === "papara"
      ? "Papara"
      : "Kripto";
}

function methodSummary(setting: Setting) {
  if (setting.method === "bank_transfer")
    return setting.iban
      ? `${setting.bank_name || "Banka"} · ${setting.iban.slice(-4)}`
      : "Banka hesabı eklenmedi";
  if (setting.method === "papara")
    return setting.papara_number
      ? `•••• ${setting.papara_number.slice(-4)}`
      : "Hesap bilgisi eklenmedi";
  return setting.wallet_address
    ? `${setting.crypto_asset || "Kripto"} · ${setting.crypto_network || "Ağ"}`
    : "Cüzdan eklenmedi";
}
