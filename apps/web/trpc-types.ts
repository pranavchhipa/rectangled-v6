// This file re-exports the AppRouter type from the API.
// In a monorepo, we can import it directly since both packages share the workspace.
export type { AppRouter } from '@rectangled/api/src/trpc/trpc.router'
