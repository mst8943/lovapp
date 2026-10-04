# Discovery correction checkpoint

Changed: components/lovask-app.tsx, lib/discovery.ts, lib/demo-data.ts, app/api/discovery/route.ts.

Confirmed original failures in a real signed-in browser: rejected card returns after switching tabs; candidates can fail with target_unavailable because candidate listing omits mutual eligibility; gender is absent from hydrated profiles and client filtering ignores gender; viewer lookup uses maybeSingle over all visible human profiles and fails.

Corrections: refetch discovery on mounting each discovery view, filter by explicit gender, scope viewer/preferences/entitlements to authenticated user, reject ineligible human candidates, serialize actions, advance cards after server confirmation, keep current card on failed decisions, guard rewind/filter races, handle discovery request failures. Demo deck no longer loops implicitly. Nearby/shared sections no longer substitute unrelated profiles.

Verification: local TypeScript and targeted ESLint passed. Browser audit is scripts/audit-discovery-flow.mjs; results are artifacts/test-audit/discovery-flow.json. It uses isolated hidden test accounts, not customer credentials. Deployment uses tmp/deploy_discovery_flow.sh with backup and rollback; actual live service is systemd lovask.service, port 3007 (old PM2/3005 instructions are stale).

Not a full application certification. Remaining audit findings: loadMatchRows still has an unscoped viewer query; referral code creation races on concurrent GET requests; get_like_allowance reports zero for an absent daily usage row; messaging/history races and end-to-end payments, notifications, moderation, account lifecycle still need investigation. Do not describe these as tested or fixed.

Candidate eligibility uses up to 40 bounded RPC checks for human candidates; move eligibility into the database candidate query to reduce requests and apply it before LIMIT. No database migration was applied in this correction.

## Live result

Deployed successfully; backup: /var/www/lovask/.deploy-backups/discovery-flow-20260917-224232. Service active. Final browser audit passed all 16 checks including login, real left/right decisions, reload persistence, duplicate decision rejection, both gender filters, tab persistence, empty-deck rewind visibility, standard-member rewind denial, and simulated 503/429/409/410 responses with rapid double clicks. Console HTTP errors in the report are deliberate error-path tests. Premium successful rewind, super-like lifecycle, real exhausted daily quotas and the broader application audit are not certified by this run.

Both hidden audit accounts were deleted after testing. The temporary local production environment copy and test credentials were removed. Recreate isolated accounts before rerunning the browser audit.
