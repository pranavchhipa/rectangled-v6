---
type: architecture
aliases: [tRPC, tRPC Dual Router]
---

# tRPC Dual-Router Pattern

OptimizerV6 uses tRPC as the primary RPC layer between [[apps/web]] and [[apps/api]]. The wrinkle: NestJS uses **constructor DI** (services aren't available until module init) but tRPC needs the router shape at **type-extract time**. The codebase solves this with a dual-router trick.

## The trick
- **Static router** — built at module load with `null as any` placeholders for services. Used **only** to extract `AppRouter` type for the client.
- **Runtime router** — built in NestJS `onModuleInit` with the real DI'd services. This is the one that actually serves requests.

```ts
// rough shape — apps/api/src/trpc/
export const appRouter = router({
  review: reviewRouter(null as any), // type-only
  // …
});
export type AppRouter = typeof appRouter;

@Injectable()
export class TrpcService implements OnModuleInit {
  onModuleInit() {
    this.runtimeRouter = router({
      review: reviewRouter(this.reviewService), // real DI
      // …
    });
  }
}
```

## Frontend wiring
- `apps/web/src/lib/trpc.ts` imports `AppRouter` (type-only) from API package
- React Query hooks: `trpc.<router>.<procedure>.useQuery / useMutation`
- Optional-chained mutation pattern on some pages: `trpc.xxx?.useMutation?.()` for graceful degradation when the route is gated

## Auth on tRPC
- JWT in `Authorization: Bearer <token>`, parsed in tRPC context middleware
- Each procedure that needs auth derives `userId` from context, then `requireMembership()` against the workspace — see [[Membership-RBAC]]

## Workspace scoping
- All tenant-data procedures take `workspaceId` as input and filter on it. Frontend hooks include `enabled: !!currentWorkspaceId` to avoid premature firing. See [[Workspace-Scoping]].

## Gotcha
- `trpc/(.*)` route path emits a NestJS deprecation warning. Cosmetic; works fine. (See [[Known-Issues]].)

## Related
- [[Data-Flow]] · [[Auth]] · [[Workspace-Scoping]] · [[Architecture-Overview]]
