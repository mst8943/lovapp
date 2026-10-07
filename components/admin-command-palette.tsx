"use client";

import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ADMIN_PAGES } from "@/lib/admin-pages";
import "./admin-command-palette.css";

type UserHit = { id: string; display_name: string; email?: string | null };
const fold = (value: string) => value.toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ı/g, "i");

export function AdminCommandPalette({ role }: { role: string }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<UserHit[]>([]);
  const [cursor, setCursor] = useState(0);
  const canSearchUsers = ["owner", "support", "moderator"].includes(role);

  const show = () => { setQuery(""); setUsers([]); setCursor(0); dialog.current?.showModal(); window.setTimeout(() => input.current?.focus(), 0); };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); show(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const term = query.trim();
    if (!canSearchUsers || term.length < 2) { const reset = window.setTimeout(() => setUsers([]), 0); return () => window.clearTimeout(reset); }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/admin/users?q=${encodeURIComponent(term)}`, { cache: "no-store" });
        const body = await response.json().catch(() => ({}));
        if (!cancelled && response.ok) setUsers((body.users ?? []).slice(0, 5));
      } catch { if (!cancelled) setUsers([]); }
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [query, canSearchUsers]);

  const items = useMemo(() => {
    const term = fold(query.trim());
    const pages = ADMIN_PAGES.filter((page) => page.roles.includes(role) && (!term || fold(`${page.label} ${page.keywords ?? ""}`).includes(term)))
      .map((page) => ({ key: page.key, label: page.label, hint: "Sayfa", href: page.href }));
    const people = users.map((user) => ({ key: `u-${user.id}`, label: user.display_name, hint: user.email ?? "Kullanıcı", href: `/admin/lovask-control/users?q=${encodeURIComponent(user.display_name)}` }));
    return [...pages, ...people];
  }, [query, role, users]);

  const go = (href: string) => { dialog.current?.close(); router.push(href); };
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") { event.preventDefault(); setCursor((value) => Math.min(value + 1, items.length - 1)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setCursor((value) => Math.max(value - 1, 0)); }
    else if (event.key === "Enter" && items[cursor]) { event.preventDefault(); go(items[cursor].href); }
  };

  return <>
    <button type="button" className="palette-trigger" onClick={show} aria-label="Hızlı arama"><Search size={15} /> Ara… <kbd>Ctrl K</kbd></button>
    <dialog ref={dialog} className="palette-dialog" aria-label="Hızlı arama" onClick={(event) => { if (event.target === dialog.current) dialog.current?.close(); }}>
      <div className="palette-box" onKeyDown={onKeyDown}>
        <label className="palette-input"><Search size={16} /><input ref={input} value={query} onChange={(event) => { setQuery(event.target.value); setCursor(0); }} placeholder="Sayfa veya kullanıcı ara…" /></label>
        <ul role="listbox">
          {items.map((item, index) => <li key={item.key} role="option" aria-selected={index === cursor}><button type="button" className={index === cursor ? "active" : ""} onMouseEnter={() => setCursor(index)} onClick={() => go(item.href)}><span>{item.label}</span><small>{item.hint}</small></button></li>)}
          {!items.length ? <li className="palette-empty">Sonuç bulunamadı.</li> : null}
        </ul>
      </div>
    </dialog>
  </>;
}
