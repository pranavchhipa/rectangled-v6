import { z } from 'zod'
import { emailSchema, uuidSchema } from './common'

export const inviteMemberSchema = z.object({
  workspaceId: uuidSchema,
  email: emailSchema,
  role: z.enum(['manager', 'staff', 'viewer']),
  locationIds: z.array(uuidSchema).optional(),
})

export const updateMemberRoleSchema = z.object({
  memberId: uuidSchema,
  workspaceId: uuidSchema,
  role: z.enum(['manager', 'staff', 'viewer']),
})

export const updateMemberLocationsSchema = z.object({
  memberId: uuidSchema,
  workspaceId: uuidSchema,
  locationIds: z.array(uuidSchema),
})

export const removeMemberSchema = z.object({
  memberId: uuidSchema,
  workspaceId: uuidSchema,
})

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>
