---
type: ops
aliases: [Build, Verify, Pre-Push]
---

# Build & Verify

There's **no CI**. Verify locally before pushing — `origin/main` triggers DO redeploy in 2-5 min.

## Commands (from repo root)
```bash
cd apps/web      && npx tsc --noEmit       # web typecheck (~14 baseline errors expected)
cd apps/api      && npx nest build         # API compile (should be clean)
cd packages/shared && npx tsc -p .         # shared package (should be clean)
npx vitest run                             # 111 tests, all should pass
```

## Baseline TS errors (don't fix as part of unrelated work)
~11-14 baseline errors in `apps/web`, all from legacy modules:
- `escalations`, `listings`, `members`, `settings`, platform-icons

**New errors introduced by your changes are the only signal.** Fixing baseline drift in feature branches confuses diffs.

## Critical don'ts
- `git commit --no-verify` — don't skip the pre-commit hook. If it fails, fix the cause and create a NEW commit (never `--amend`).
- `npx vitest run` failing — don't push.
- See [[Hotfix-Trail]] don'ts for design / branding-specific rules.

## Format
```bash
npm run format     # prettier
```

## Connects to
- [[Local-Dev]] — getting set up
- [[Known-Issues]] — gotchas during builds
- [[Hotfix-Trail]] — recent feature don'ts
