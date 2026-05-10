---
type: domain
aliases: [Authentication, Auth Module]
---

# Auth

JWT-based authentication. 30-day access tokens. No refresh-token rotation in the hot path (refresh tokens table exists for future use).

## Surface
- API: `apps/api/src/auth/`
- Web: `apps/web/src/app/(auth)/`, `apps/web/src/app/auth/`
- DB: `packages/db/src/schema/users.ts`, `refresh-tokens.ts`, `password-reset-tokens.ts`
- Validators: `packages/shared/src/validators/auth.ts`
- Types: `packages/shared/src/types/auth.ts`, `user.ts`

## What it does
- Sign in / sign up via email + password
- Issues JWT, signed with `JWT_SECRET`, expiry `JWT_EXPIRY` (default `30d`)
- Frontend stores JWT in Zustand → `localStorage["rectangled-auth"]`
- tRPC context middleware extracts the bearer, attaches `userId`
- Password reset tokens (email-link flow via [[Resend]]/[[Email]])
- Demo login: `test@example.com` / `password123`

## Connects to
- [[Membership-RBAC]] — every authenticated procedure follows up with `requireMembership(userId, workspaceId)`
- [[Workspaces]] — login → fetch user's workspaces → set `currentWorkspaceId` in Zustand
- [[Members]] — invite acceptance flow joins users to workspaces
- [[Onboarding]] — first-login redirect

## Notes
- JWT is intentionally long-lived (30d) for SMB convenience; rotate `JWT_SECRET` to revoke en masse.
- See [[Workspace-Scoping]] for how the `currentWorkspaceId` interacts with every query.
