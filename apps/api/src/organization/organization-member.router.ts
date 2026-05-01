import { protectedProcedure, router } from '../trpc/middleware'
import {
  listOrganizationMembersSchema,
  inviteOrganizationMemberSchema,
  acceptOrganizationInviteSchema,
  updateOrganizationMemberRoleSchema,
  removeOrganizationMemberSchema,
  assignMemberToWorkspacesSchema,
} from '@rectangled/shared'
import { OrganizationMemberService } from './organization-member.service'

export function createOrganizationMemberRouter(
  service: OrganizationMemberService,
) {
  return router({
    list: protectedProcedure
      .input(listOrganizationMembersSchema)
      .query(async ({ input, ctx }) => {
        return service.list(input.organizationId, ctx.user.sub)
      }),

    invite: protectedProcedure
      .input(inviteOrganizationMemberSchema)
      .mutation(async ({ input, ctx }) => {
        return service.invite(input, ctx.user.sub)
      }),

    acceptInvite: protectedProcedure
      .input(acceptOrganizationInviteSchema)
      .mutation(async ({ input, ctx }) => {
        return service.acceptInvite(input.token, ctx.user.sub)
      }),

    updateRole: protectedProcedure
      .input(updateOrganizationMemberRoleSchema)
      .mutation(async ({ input, ctx }) => {
        return service.updateRole(input, ctx.user.sub)
      }),

    remove: protectedProcedure
      .input(removeOrganizationMemberSchema)
      .mutation(async ({ input, ctx }) => {
        return service.remove(input, ctx.user.sub)
      }),

    assignToWorkspaces: protectedProcedure
      .input(assignMemberToWorkspacesSchema)
      .mutation(async ({ input, ctx }) => {
        return service.assignToWorkspaces(input, ctx.user.sub)
      }),
  })
}
