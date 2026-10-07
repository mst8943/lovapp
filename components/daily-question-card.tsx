"use client";

import { useEffect, useState } from "react";
import "./daily-question-card.css";

type State = { question: { key: string; text: string; options: string[] }; answer: number | null; sameCount: number };

export function DailyQuestionCard() {
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/daily-question", { cache: "no-store" }).then((response) => (response.ok ? response.json() : null)).then((body) => { if (!cancelled && body?.question) setState(body); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  if (!state) return null;
  const answered = state.answer !== null;
  const choose = async (optionIndex: number) => {
    if (busy || answered) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/daily-question", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ optionIndex }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) { setError(body.error ?? "Yanıt kaydedilemedi."); return; }
      setState(body); setOpen(false);
    } catch { setError("Bağlantı kurulamadı."); } finally { setBusy(false); }
  };

  return (
    <section className={`daily-question${answered ? " answered" : ""}`} aria-label="Günün sorusu">
      <button type="button" className="daily-question-head" onClick={() => !answered && setOpen((value) => !value)} aria-expanded={!answered && open}>
        <small>Günün sorusu</small>
        <strong>{state.question.text}</strong>
        {answered ? <span>Yanıtın: {state.question.options[state.answer ?? 0]}{state.sameCount ? ` · ${state.sameCount} kişi seninle aynı şıkkı seçti, kartlarında rozetle görürsün` : " · Aynı şıkkı seçenler kartlarda rozetle görünür"}</span> : <span>{open ? "Bir şık seç" : "Yanıtla, aynı şıkkı seçenleri keşfette rozetle gör"}</span>}
      </button>
      {!answered && open ? <div className="daily-question-options">{state.question.options.map((option, index) => <button key={option} type="button" disabled={busy} onClick={() => void choose(index)}>{option}</button>)}</div> : null}
      {error ? <p className="daily-question-error" role="alert">{error}</p> : null}
    </section>
  );
}
