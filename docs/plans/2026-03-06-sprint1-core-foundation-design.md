# Sprint 1: Core Foundation — Design Document

**Date:** 2026-03-06
**Status:** Approved
**Approach:** API-First (build each feature end-to-end)

## Scope

Sprint 1 builds the multi-tenant foundation:
1. Auth system (email/password + Google OAuth)
2. Workspace CRUD
3. Location CRUD
4. Member invite + role management
5. Dashboard shell upgrade (shadcn/ui)

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Sprint scope | Core Foundation only | Solid base before connectors/reviews |
| UI style | Clean & Minimal | Light mode, subtle borders, whitespace. Linear/Notion feel |
| Auth flow | Email/Password + Google OAuth | Standard SaaS pattern, JWT access + refresh |
| Post-login | Direct to dashboard | Auto-select last workspace, switcher in sidebar |
| Login layout | Split screen | Left: brand panel. Right: auth form |
| Build order | API-First | Backend tRPC → Frontend UI per feature |

---

## 1. Auth System

### 1.1 Backend (NestJS + tRPC)

**New files:**
- `apps/api/src/auth/auth.module.ts` — NestJS module (JWT, Passport)
- `apps/api/src/auth/auth.service.ts` — Business logic
- `apps/api/src/auth/auth.guard.ts` — JWT guard for tRPC context
- `apps/api/src/auth/auth.router.ts` — tRPC procedures
- `apps/api/src/auth/strategies/jwt.strategy.ts` — Passport JWT
- `apps/api/src/auth/strategies/google.strategy.ts` — Passport Google OAuth

**tRPC Procedures (`auth.*`):**

| Procedure | Type | Input | Output |
|-----------|------|-------|--------|
| `auth.register` | mutation | `{name, email, password}` | `{user, accessToken, refreshToken}` |
| `auth.login` | mutation | `{email, password}` | `{user, accessToken, refreshToken}` |
| `auth.googleAuthUrl` | query | `{redirectUrl}` | `{url}` |
| `auth.googleCallback` | mutation | `{code}` | `{user, accessToken, refreshToken}` |
| `auth.refresh` | mutation | `{refreshToken}` | `{accessToken, refreshToken}` |
| `auth.me` | query | (JWT in header) | `{user, memberships: [{workspace, role}]}` |
| `auth.logout` | mutation | (JWT) | `{success}` |

**Token strategy:**
- Access token: JWT, 15-minute expiry, sent via `Authorization: Bearer` header
- Refresh token: JWT, 30-day expiry, stored in localStorage (upgrade to httpOnly cookie later)
- Passwords hashed with bcryptjs (12 rounds)

**Registration flow:**
1. User submits name + email + password
2. Backend validates (Zod), checks email uniqueness
3. Hash password, create user row
4. Auto-create default workspace ("My Business") + member row (role: owner)
5. Return JWT tokens + user data

**Google OAuth flow:**
1. Frontend calls `auth.googleAuthUrl` → gets Google consent URL
2. User redirects to Google, approves
3. Google redirects back to `/auth/google/callback?code=...`
4. Frontend captures `code`, calls `auth.googleCallback`
5. Backend exchanges code for Google profile, upserts user (by googleId), returns tokens

### 1.2 Frontend

**Login page (`/login`) — Split screen layout:**
- Left panel (hidden on mobile): Brand gradient (brand-600 → brand-900), logo, tagline, social proof stats
- Right panel: Auth form with login/register toggle
- Components: shadcn `Card`, `Input`, `Button`, `Label`, `Separator`

**Auth state — Zustand store (`useAuthStore`):**
```
user: User | null
accessToken: string | null
refreshToken: string | null
currentWorkspaceId: string | null
login(email, password) → tokens
register(name, email, password) → tokens
googleLogin(code) → tokens
logout() → clear state
refresh() → new tokens
```

**tRPC client auth:**
- `httpBatchLink` sends `Authorization: Bearer <accessToken>` on every request
- On 401, attempt silent refresh; if refresh fails, redirect to `/login`

**Protected routes:**
- Middleware in `apps/web/src/middleware.ts` checks for token presence
- Redirect unauthenticated users to `/login`
- Redirect authenticated users from `/login` to `/dashboard`

---

## 2. Workspace CRUD

### 2.1 Backend

**New files:**
- `apps/api/src/workspace/workspace.module.ts`
- `apps/api/src/workspace/workspace.service.ts`
- `apps/api/src/workspace/workspace.router.ts`

**tRPC Procedures (`workspace.*`):**

| Procedure | Type | Input | Output | Permission |
|-----------|------|-------|--------|------------|
| `workspace.create` | mutation | `{name, slug, industry?}` | workspace | authenticated |
| `workspace.list` | query | — | `[{workspace, role, locationsCount}]` | authenticated |
| `workspace.getById` | query | `{id}` | workspace + locations | member |
| `workspace.update` | mutation | `{id, name?, industry?, brandColors?, tonePreset?, settings?}` | workspace | `workspace:update` |
| `workspace.delete` | mutation | `{id}` | `{success}` | `workspace:delete` |

**On workspace creation:**
- Validate slug uniqueness
- Create workspace row with defaults
- Create member row: creator = owner

### 2.2 Frontend

**Workspace Settings (`/dashboard/settings`):**
- Tab-based layout: General | Members (section 4)
- General tab: Name, slug (read-only after creation), industry dropdown, brand color pickers, tone preset radio group
- Danger zone: Delete workspace (owner only, confirmation dialog)
- Components: shadcn `Tabs`, `Input`, `Select`, `Button`, `Alert`, `Dialog`

**Workspace Switcher (sidebar bottom):**
- Shows current workspace name + avatar
- Dropdown with all workspaces
- "Create new workspace" option → Dialog with name + slug + industry form
- Components: shadcn `DropdownMenu`, `Dialog`

---

## 3. Location CRUD

### 3.1 Backend

**New files:**
- `apps/api/src/location/location.module.ts`
- `apps/api/src/location/location.service.ts`
- `apps/api/src/location/location.router.ts`

**tRPC Procedures (`location.*`):**

| Procedure | Type | Input | Output | Permission |
|-----------|------|-------|--------|------------|
| `location.create` | mutation | `{workspaceId, name, address?, city?, state?, phone?, email?}` | location | `location:create` |
| `location.list` | query | `{workspaceId}` | locations array | member |
| `location.getById` | query | `{id}` | location | member |
| `location.update` | mutation | `{id, name?, address?, city?, ...}` | location | `location:update` |
| `location.delete` | mutation | `{id}` | `{success}` | `location:delete` |
| `location.toggleActive` | mutation | `{id}` | location | `location:update` |

### 3.2 Frontend

**Locations Page (`/dashboard/locations`):**
- Card grid layout (responsive: 1 col mobile, 2 col tablet, 3 col desktop)
- Each card: location name, city, phone, active/inactive badge, edit/delete actions
- "Add Location" button → Sheet (slide-in from right) with form
- Edit location → same Sheet
- Toggle active/inactive inline via Switch
- Empty state: illustration + "Add your first location" CTA
- Components: shadcn `Card`, `Sheet`, `Input`, `Switch`, `Badge`, `Button`

---

## 4. Member Management

### 4.1 Backend

**New files:**
- `apps/api/src/member/member.module.ts`
- `apps/api/src/member/member.service.ts`
- `apps/api/src/member/member.router.ts`

**tRPC Procedures (`member.*`):**

| Procedure | Type | Input | Output | Permission |
|-----------|------|-------|--------|------------|
| `member.list` | query | `{workspaceId}` | members with user details | member |
| `member.invite` | mutation | `{workspaceId, email, role, locationIds?}` | member (pending) | `member:invite` |
| `member.updateRole` | mutation | `{memberId, role}` | member | `member:update_role` |
| `member.updateLocations` | mutation | `{memberId, locationIds}` | member | `member:update_role` |
| `member.remove` | mutation | `{memberId}` | `{success}` | `member:remove` |
| `member.acceptInvite` | mutation | `{token}` | member | (invite token) |

**Invite flow:**
1. Owner/manager calls `member.invite` with email + role
2. Backend creates member row (acceptedAt = null), generates invite token
3. Email with invite link sent (or for Sprint 1: just create the member row, email later)
4. Invited user registers/logs in, visits invite link, calls `member.acceptInvite`

### 4.2 Frontend

**Members Tab (`/dashboard/settings` → Members tab):**
- Table: Name, Email, Role (badge), Status (active/pending), Locations, Actions
- "Invite Member" button → Sheet with email input + role selector + location multi-select
- Role change: dropdown in table row (owner only)
- Remove member: confirmation dialog
- Components: shadcn `Table`, `Sheet`, `Select`, `Badge`, `Dialog`, `Button`

---

## 5. Dashboard Shell Upgrade

### 5.1 shadcn/ui Installation

Initialize shadcn/ui in `apps/web/`:
```
npx shadcn@latest init
```

Install these components:
```
button input label card dialog sheet table select switch badge
skeleton dropdown-menu separator alert avatar form sidebar tabs
toast sonner tooltip
```

### 5.2 Sidebar Upgrade

Replace current raw sidebar with shadcn `Sidebar` component:
- Collapsible (icon-only mode)
- Logo at top
- Navigation items with icons + active state
- Workspace switcher at bottom (dropdown)
- User avatar + name at very bottom with logout dropdown

### 5.3 Header Upgrade

- Breadcrumbs showing current page
- Search bar (placeholder, non-functional in Sprint 1)
- User avatar dropdown: Profile, Settings, Logout

### 5.4 Dashboard Home (`/dashboard`)

- Welcome card: "Welcome back, {name}" with workspace name
- Onboarding checklist (if workspace is new):
  - Add your first location
  - Invite team members
  - Connect a platform (preview for Sprint 2)
- Summary stats: Locations count, Team members count, (Connectors: coming soon)
- Components: shadcn `Card`, `Badge`, `Skeleton`, `Avatar`

---

## 6. tRPC Router Organization

Restructure the single `appRouter` into sub-routers:

```typescript
export const appRouter = t.router({
  auth: authRouter,       // auth.login, auth.register, ...
  workspace: workspaceRouter, // workspace.create, workspace.list, ...
  location: locationRouter,   // location.create, location.list, ...
  member: memberRouter,       // member.invite, member.list, ...
  health: t.procedure.query(() => ({ status: 'ok', version: '6.0.0' })),
})
```

Each sub-router defined in its own file, imported into the main router.

**tRPC Context:**
- Extend `createContext` to extract JWT from `Authorization` header
- Parse token → attach `user` and `memberships` to context
- Protected procedures use middleware that checks context for auth

---

## 7. Shared Package Updates

Add to `packages/shared/`:
- `src/validators/auth.ts` — Zod schemas for register, login inputs
- `src/validators/workspace.ts` — Zod schemas for workspace create/update
- `src/validators/location.ts` — Zod schemas for location create/update
- `src/validators/member.ts` — Zod schemas for member invite/update
- `src/types/auth.ts` — Token payload types, auth response types

---

## 8. Database Additions

**New table: `refresh_tokens`**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid (PK) | |
| user_id | uuid (FK → users) | |
| token_hash | varchar(255) | bcrypt hash of refresh token |
| expires_at | timestamp | 30 days from creation |
| revoked_at | timestamp | Null = active |
| created_at | timestamp | |

This supports token rotation: each refresh invalidates the old token and issues a new one.

---

## Implementation Order

| # | Task | Estimated Effort |
|---|------|-----------------|
| 1 | Install shadcn/ui + base components | Small |
| 2 | Auth backend (module, service, JWT, tRPC procedures) | Large |
| 3 | Auth frontend (login page, Zustand store, middleware) | Large |
| 4 | Google OAuth integration | Medium |
| 5 | Workspace backend (service, tRPC procedures) | Medium |
| 6 | Workspace frontend (settings page, switcher) | Medium |
| 7 | Location backend (service, tRPC procedures) | Medium |
| 8 | Location frontend (cards, sheet, CRUD) | Medium |
| 9 | Member backend (service, tRPC procedures) | Medium |
| 10 | Member frontend (table, invite sheet) | Medium |
| 11 | Dashboard shell upgrade (sidebar, header, home) | Medium |
| 12 | Integration testing + polish | Medium |

---

## What Comes Next (Sprint 2 Preview)

- Connectors Hub (marketplace UI + GBP OAuth)
- Reviews table + AI response drafts
- TruForms builder
- Email notifications for invites
