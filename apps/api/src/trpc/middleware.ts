import { initTRPC, TRPCError } from '@trpc/server'
import { eq, and } from 'drizzle-orm'
import type { TrpcContext } from './context'

const t = initTRPC.context<TrpcContext>().create()

export const router = t.router
export const publicProcedure = t.procedure

// Middleware: require authenticated user
const isAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not authenticated' })
  }
  return next({ ctx: { ...ctx, user: ctx.user } })
})

export const protectedProcedure = t.procedure.use(isAuthed)

/**
 * Helper to verify workspace membership — call this in services.
 * Throws FORBIDDEN if the user is not an accepted member of the workspace.
 */
export async function verifyWorkspaceMembership(
  db: any,
  userId: string,
  workspaceId: string,
): Promise<void> {
  // Import at runtime to avoid circular deps
  const { members } = await import('@rectangled/db')
  const membership = await db.query.members.findFirst({
    where: and(
      eq(members.userId, userId),
      eq(members.workspaceId, workspaceId),
    ),
  })
  if (!membership || !membership.acceptedAt) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Not a member of this workspace' })
  }
}
