import { z } from 'zod'

export const organizationTypeSchema = z.enum(['direct', 'multi_location', 'agency'])
export const organizationRoleSchema = z.enum([
  'org_owner',
  'org_admin',
  'org_manager',
  'org_member',
])

export const whiteLabelConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    logoUrl: z.string().url().or(z.literal('')).optional(),
    faviconUrl: z.string().url().or(z.literal('')).optional(),
    primaryColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, 'expected hex like #2D5BFF')
      .optional(),
    secondaryColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
    footerText: z.string().max(500).optional(),
    supportEmail: z.string().email().or(z.literal('')).optional(),
    supportPhone: z.string().max(50).optional(),
    customDomain: z.string().max(255).optional(),
  })
  .strict()

const orgSettingsSchema = z.record(z.unknown())

// ============================================================
// Organization
// ============================================================

export const listOrganizationsSchema = z.object({})

export const getOrganizationSchema = z.object({
  organizationId: z.string().uuid(),
})

export const createOrganizationSchema = z.object({
  name: z.string().min(1).max(255),
  type: organizationTypeSchema.default('direct'),
})

export const updateOrganizationSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  settings: orgSettingsSchema.optional(),
  whiteLabel: whiteLabelConfigSchema.optional(),
})

export const updateOrganizationTypeSchema = z.object({
  organizationId: z.string().uuid(),
  type: organizationTypeSchema,
})

export const deleteOrganizationSchema = z.object({
  organizationId: z.string().uuid(),
})

export const switchOrganizationSchema = z.object({
  organizationId: z.string().uuid(),
})

export const getWhiteLabelSchema = z.object({
  // Public lookup — by slug. Used by login/public pages to theme themselves.
  slug: z.string().min(1).max(100),
})

// ============================================================
// Organization member
// ============================================================

export const listOrganizationMembersSchema = z.object({
  organizationId: z.string().uuid(),
})

export const inviteOrganizationMemberSchema = z.object({
  organizationId: z.string().uuid(),
  email: z.string().email(),
  role: organizationRoleSchema,
  /**
   * Optional scope. NULL = full access to all workspaces in the org.
   * Non-null = restricted to the listed workspace IDs (used for org_manager
   * and org_member with explicit scope, and for agency client owners).
   */
  workspaceIds: z.array(z.string().uuid()).optional(),
})

export const acceptOrganizationInviteSchema = z.object({
  // The invitation token contains the userId + organizationId. Validated
  // server-side; we don't expose the org id directly to prevent leaking.
  token: z.string().min(1),
})

export const updateOrganizationMemberRoleSchema = z.object({
  organizationId: z.string().uuid(),
  memberId: z.string().uuid(),
  role: organizationRoleSchema,
  workspaceIds: z.array(z.string().uuid()).nullable().optional(),
})

export const removeOrganizationMemberSchema = z.object({
  organizationId: z.string().uuid(),
  memberId: z.string().uuid(),
})

export const assignMemberToWorkspacesSchema = z.object({
  organizationId: z.string().uuid(),
  memberId: z.string().uuid(),
  workspaceIds: z.array(z.string().uuid()),
})
