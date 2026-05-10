---
type: concept
aliases: [Workspace Scoping, Tenant Scoping]
---

# Workspace Scoping

Every domain query is scoped to a workspace. This is the multi-tenant boundary.

## Frontend pattern
```ts
const { data } = trpc.review.list.useQuery(
  { workspaceId: currentWorkspaceId! },
  { enabled: !!currentWorkspaceId }   // ← prevent firing before workspace is selected
);
```
- `currentWorkspaceId` lives in Zustand auth store (`rectangled-auth` key in localStorage).
- Switching workspaces flips the value → all `useQuery` hooks refetch.

## Backend pattern
Every workspace-scoped service method:
1. Takes `workspaceId` (and `userId` from tRPC context)
2. Calls `requireMembership(userId, workspaceId)` — see [[Membership-RBAC]]
3. Adds `where workspace_id = $workspaceId` to every Drizzle query

## Per-page location filter (Hotfix-5)
On top of workspace scoping, several pages added per-page **location** filters in Hotfix-5: Customer Journeys, Responses, Customers, Dashboard rollups, custom journey wizard. Threshold relaxed to `>= 1` location in Hotfix-6 ([[Hotfix-Trail]]).

## Connects to
- [[Auth]] — JWT → userId
- [[Membership-RBAC]] — gate on (userId, workspaceId)
- [[Workspaces]] — the tenant unit
- [[tRPC-Pattern]] — where the pattern is enforced
- [[Locations]] — per-page filter on top
