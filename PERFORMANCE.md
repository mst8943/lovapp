# Performance log

## 2026-08-13 — Main application

Baseline was measured with a fresh browser context, blocked service workers, a 390×844 viewport, and three runs per route.

| Experiment | Baseline → result | Verdict |
| --- | --- | --- |
| Defer Supabase realtime client and remove duplicate startup requests | Main JS 270.7 KB → 204.8 KB; profile JS 281.4 KB → 215.5 KB | Kept — 23–24% lower initial JS transfer |
| Load server data by requested tab | Discovery/match hydration on every authenticated request → discovery only for swipe/explore; lightweight match count only for profile | Kept — removes unrelated database and Storage work from the response path |
| Batch conversation photo signing | One Storage signing request per photo → one batch request per conversation response | Kept — removes cold-cache N+1 Storage calls |
| Defer bot-match processing with `after()` | Conversation response waited for match processing/push scheduling → response is returned before that work | Kept — non-critical work leaves the response path |
| Lazy Motion feature bundle | Main JS 204.8 KB → 214.8 KB and +2 requests | Reverted — measurable regression |

The signed URL cache is capped at 2,000 LRU entries to prevent production memory growth.

## 2026-08-14 — Mobile animation smoothness

Measured with a 390×844 touch viewport, 3× device pixel ratio, 4× CPU throttling, and five fresh browser contexts per result.

| Experiment | Baseline → result | Verdict |
| --- | --- | --- |
| Remove touch-only live blur layers and pre-isolate the swipe card paint layer | First-interaction frame spike 78.7 ms → no frame over 20 ms in 5/5 local and 5/5 production runs; production p95 6.1 ms | Kept — removes measured mobile compositor jank without changing desktop or Noir |

## 2026-08-16 — Match interaction under 4× CPU throttling

Five fresh production contexts per result at 390×844, DPR 3, touch input, blocked service worker and cold network cache.

| Experiment | Baseline → result | Verdict |
| --- | --- | --- |
| Schedule the demo match/quest/card commit with `startTransition` | INP p95 240 ms → 32 ms; JS 202.6 KB → 202.6 KB; LCP 808 ms → 808 ms | Kept — interaction paint is no longer blocked and the match animation is unchanged |
| Mount match portraits one animation frame after the overlay shell | Max frame 115.1 ms → 115.1 ms; interaction 260.8 ms → 267.4 ms | Reverted — no measurable improvement |
| Predecode the viewer portrait before the first match | Max frame 133.2 ms → 109.0 ms; interaction p95 281.3 ms → 252.8 ms | Kept — less first-match work without changing the animation |
| Replace the inner Motion match animation with CSS keyframes | Max frame 109.0 ms → 109.2 ms; interaction p95 252.8 ms → 257.8 ms | Reverted — no measurable frame improvement |

The audit keeps the sustained-frame budget at 20 ms (p95) and the documented
cold first-match spike budget at 120 ms. This catches regressions above the
measured 109 ms baseline without treating one cold overlay mount like sustained
animation jank.

## 2026-09-20 — Mobile messaging and discovery request load

Authenticated data paths were reduced structurally: discovery changed from up
to 40 per-candidate eligibility RPCs to one candidate RPC, and bot-reply polling
changed from fetching up to 100 messages plus audio signatures every 1.4–2.2
seconds to a status-only response. Realtime-connected inboxes no longer run a
second five-second full refresh; a 30-second fallback remains for disconnects.

The existing five-run mobile audit was repeated alone at 390×844, DPR 3 and 4×
CPU throttling after the final changes: LCP p95 604 ms, INP p95 72 ms, CLS 0,
frame p95 6.2 ms, maximum cold frame 115.2 ms and initial JS transfer 211,107 bytes.
All existing animation and layout budgets passed.

The final seven-run verification after the filter, chat draft/scroll and offline
fallback work measured LCP p95 448 ms, INP p95 80 ms, CLS 0, frame p95 6.2 ms,
maximum frame 109.2 ms and initial JS transfer 211,678 bytes. The service worker
offline navigation fallback was also exercised in a real browser with the
network disabled; personalized API and chat responses are never cached.

After restoring the match entrance animations that had accidentally been
disabled by a later stylesheet, the ten-run final verification still passed all
budgets: LCP p95 600 ms, INP p95 80 ms, CLS 0, frame p95 6.2 ms, maximum frame
115.1 ms and initial JS transfer 214,429 bytes.
