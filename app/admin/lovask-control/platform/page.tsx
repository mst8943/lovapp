"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminResourceNav } from "@/components/admin-resource-nav";
import { PLATFORM_FEATURES } from "@/lib/platform-features";
import "../admin-page.css";
import "./platform.css";

type SetupCheck = { label: string; ready: boolean; detail: string };
type BotStats = { activeProfiles: number; todayMatches: number; botMessages: number; bots: number };

const featureTotal = PLATFORM_FEATURES.reduce((sum, group) => sum + group.features.length, 0);

export default function PlatformPage() {
  const [checks, setChecks] = useState<SetupCheck[] | null>(null);
  const [stats, setStats] = useState<BotStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/admin/setup", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : { checks: [] }))
      .then((body) => { if (!cancelled) setChecks(body.checks ?? []); })
      .catch(() => { if (!cancelled) setChecks([]); });
    void fetch("/api/admin/bots", { cache: "no-store" })
      .then((response): Promise<{ stats?: BotStats }> => (response.ok ? response.json() : Promise.resolve({})))
      .then((body) => { if (!cancelled) setStats(body.stats ?? null); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const ready = checks?.filter((check) => check.ready).length ?? 0;
  const total = checks?.length ?? 0;
  const percent = total ? Math.round((ready / total) * 100) : 0;
  const number = (value?: number) => (typeof value === "number" ? value.toLocaleString("tr-TR") : "…");

  return (
    <main className="admin-stage">
      <AdminResourceNav />
      <section className="admin-main platform-main">
        <header>
          <div>
            <small>Platform özeti</small>
            <h1>Neler hazır, <em>neler çalışıyor</em></h1>
            <p className="platform-lead">
              Web, Android uygulaması ve yönetim paneli aynı veritabanı üzerinde çalışır. Aşağıda canlı sayılar, kurulum
              hazırlığı ve platformun tüm özellikleri tek ekranda.
            </p>
          </div>
        </header>

        <div className="admin-stats">
          <div className="admin-stat"><small>Aktif profiller</small><strong>{number(stats?.activeProfiles)}</strong><span>Tamamlanmış canlı üyeler</span></div>
          <div className="admin-stat"><small>Bugünkü eşleşme</small><strong>{number(stats?.todayMatches)}</strong><span>Son 24 saat</span></div>
          <div className="admin-stat"><small>Bot ekosistemi</small><strong>{number(stats?.bots)}</strong><span>{number(stats?.botMessages)} mesaj yazıldı</span></div>
          <div className="admin-stat"><small>Özellik</small><strong>{featureTotal}</strong><span>{PLATFORM_FEATURES.length} ana başlıkta</span></div>
        </div>

        <section className="admin-panel platform-ready">
          <div className="panel-head">
            <div>
              <small>Kurulum hazırlığı</small>
              <h2>{checks === null ? "Kontrol ediliyor…" : total ? `${ready} / ${total} hazır` : "Kontrol listesi alınamadı"}</h2>
            </div>
            <Link className="admin-primary" href="/admin/lovask-control/settings">Ayarları aç</Link>
          </div>
          <div className="platform-bar" role="progressbar" aria-label="Kurulum hazırlığı" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${percent}%` }} /></div>
          <div className="platform-checks">
            {(checks ?? []).map((check) => (
              <div className={check.ready ? "platform-check ready" : "platform-check"} key={check.label}>
                <i aria-hidden="true">{check.ready ? "✓" : "!"}</i>
                <div>
                  <strong>{check.label}</strong>
                  <small>{check.ready ? "Hazır" : `Eksik: ${check.detail}`}</small>
                </div>
              </div>
            ))}
          </div>
        </section>

        <p className="platform-total">{featureTotal} özellik, {PLATFORM_FEATURES.length} başlık altında. Bağlantılı olanlar ilgili yönetim ekranını açar.</p>
        <div className="platform-groups">
          {PLATFORM_FEATURES.map((group) => (
            <section className="platform-group" key={group.title}>
              <h3>{group.title}<span>{group.features.length} özellik</span></h3>
              <ul>
                {group.features.map((feature) => (
                  <li key={feature.name}>
                    <strong>{feature.href ? <Link href={feature.href}>{feature.name}</Link> : feature.name}</strong>
                    <small>{feature.detail}</small>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </section>
    </main>
  );
}
