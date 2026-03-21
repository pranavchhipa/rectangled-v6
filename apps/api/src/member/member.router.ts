import { protectedProcedure, router } from '../trpc/middleware'
import {
  inviteMemberSchema,
  updateMemberRoleSchema,
  updateMemberLocationsSchema,
  removeMemberSchema,
} from '@rectangled/shared'
import { z } from 'zod'
import { MemberService } from './member.service'

export function createMemberRouter(memberService: MemberService) {
  return router({
    list: protectedProcedure
      .input(z.object({ workspaceId: z.string().uuid() }))
      .query(async ({ input, ctx }) => {
        return memberService.list(input.workspaceId, ctx.user.sub)
      }),

    invite: protectedProcedure.input(inviteMemberSchema).mutation(async ({ input, ctx }) => {
      return memberService.invite(
        input.workspaceId,
        input.email,
        input.role,
        input.locationIds,
        ctx.user.sub,
      )
    }),

    updateRole: protectedProcedure
      .input(updateMemberRoleSchema)
      .mutation(async ({ input, ctx }) => {
        return memberService.updateRole(input.memberId, input.workspaceId, input.role, ctx.user.sub)
      }),

    updateLocations: protectedProcedure
      .input(updateMemberLocationsSchema)
      .mutation(async ({ input, ctx }) => {
        return memberService.updateLocations(input.memberId, input.workspaceId, input.locationIds, ctx.user.sub)
      }),

    remove: protectedProcedure
      .input(removeMemberSchema)
      .mutation(async ({ input, ctx }) => {
        return memberService.remove(input.memberId, input.workspaceId, ctx.user.sub)
      }),
  })
}
