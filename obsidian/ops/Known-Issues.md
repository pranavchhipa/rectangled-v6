---
type: ops
aliases: [Known Issues, Gotchas]
---

# Known Issues / Gotchas

Drawn from `CLAUDE.md`. Read before debugging.

## Build / runtime
1. **Windows NestJS compilation is slow** — 3-5 min in watch mode. Be patient on `apps/api` hot reload.
2. **Razorpay lazy init.** `getRazorpay()` factory in `billing.service.ts` — crashes if loaded at module level without env vars. (Same pattern in [[OpenRouter]].) See [[Razorpay]].
3. **DB identifier truncation.** Postgres warns about long FK names — cosmetic only.
4. **Shared package rebuild.** After adding validators/constants, run `npm run build --workspace=packages/shared` BEFORE restarting the API. The `export *` chain in `packages/shared/src/index.ts` won't pick new exports otherwise.
5. **tRPC route path warning.** `trpc/(.*)` path emits a NestJS deprecation warning. Cosmetic; tRPC works fine.
6. **Optional mutations on frontend.** Some pages use `trpc.xxx?.useMutation?.()` for graceful degradation — a missing route doesn't crash the page.

## Port conflicts
Kill orphaned dev servers (Windows):
```powershell
powershell -Command "Get-NetTCPConnection -LocalPort 3000,3001 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }"
```
macOS:
```bash
lsof -ti :3000 :3001 | xargs kill -9
```

## Public-page design (Hotfix don'ts)
See [[Hotfix-Trail]] and [[Public-Pages]] for the full list. Top three:
- Don't use `bg-[var(--brand)]` (Tailwind arbitrary purges unreliably) — inline `style` only
- Don't use `ringColor` — use `boxShadow` for the focus ring
- Don't add the 4-style switcher back — owner rejected it; one design only

## Credentials
- **R2 leaked, NOT rotated.** User explicitly chose to leave the keys despite a screenshot leak. See [[Cloudflare-R2]].
- **Razorpay is in test mode** — `rzp_test_*` key. Live mode requires KYC + a separate key.

## Connects to
- [[Build-and-Verify]] — verification flow
- [[Hotfix-Trail]] — historical context
