import {
  pgTable,
  uuid,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core'
import { organizations } from './organizations'
import { users } from './users'
import { organizationRoleEnum } from './enums'

/**
 * Phase 1 — Organization-level membership.
 *
 * This table is distinct from `members` (which is workspace-level and not
 * deleted). Both coexist:
 *   - `organization_members` decides "is the user in this org? at what role?"
 *   - `members` continues to provide workspace-specific role + settings
 *
 * Effective role mapping (org role → workspace effective role):
 *   org_owner    → owner (everywhere)
 *   org_admin    → owner (everywhere)
 *   org_manager  → manager (in scoped workspaces)
 *   org_member   → staff (in scoped workspaces)
 *
 * `workspaceIds` scopes restricted roles. NULL = full access to every
 * workspace in the org. A non-null array = access only to listed workspace
 * IDs. Used for agency client owners (workspaceIds = [their workspace] →
 * read-only access to one workspace, can't see other clients).
 *
 * UNIQUE(organizationId, userId) — at most one membership row per (org, user).
 */
export const organizationMembers = pgTable(
  'organization_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: organizationRoleEnum('role').notNull(),
    /**
     * NULL = full access to every workspace in the org. Non-null =
     * restricted to the listed workspace IDs. Used for org_manager /
     * org_member with explicit scope or agency client owners.
     */
    workspaceIds: uuid('workspace_ids').array(),
    acceptedAt: timestamp('accepted_at'),
    invitedBy: uuid('invited_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    unique('uniq_organization_members_org_user').on(t.organizationId, t.userId),
  ],
)
