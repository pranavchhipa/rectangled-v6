export const ROLES = {
  OWNER: 'owner',
  MANAGER: 'manager',
  STAFF: 'staff',
  VIEWER: 'viewer',
} as const

export type Role = (typeof ROLES)[keyof typeof ROLES]

/**
 * Permission matrix: which roles can do what.
 * Checked in guards/middleware on both frontend and backend.
 */
export const PERMISSIONS = {
  // Workspace management
  'workspace:update': ['owner'],
  'workspace:delete': ['owner'],
  'workspace:billing': ['owner'],

  // Location management
  'location:create': ['owner', 'manager'],
  'location:update': ['owner', 'manager'],
  'location:delete': ['owner'],

  // Members
  'member:invite': ['owner', 'manager'],
  'member:remove': ['owner'],
  'member:update_role': ['owner'],

  // Connectors
  'connector:connect': ['owner', 'manager'],
  'connector:disconnect': ['owner', 'manager'],
  'connector:configure': ['owner', 'manager'],

  // Reviews
  'review:view': ['owner', 'manager', 'staff', 'viewer'],
  'review:respond': ['owner', 'manager', 'staff'],
  'review:approve_response': ['owner', 'manager'],

  // TruForms
  'truform:create': ['owner', 'manager'],
  'truform:update': ['owner', 'manager'],
  'truform:delete': ['owner', 'manager'],
  'truform:view_responses': ['owner', 'manager', 'staff', 'viewer'],

  // Customers
  'customer:view': ['owner', 'manager', 'staff', 'viewer'],
  'customer:create': ['owner', 'manager', 'staff'],
  'customer:update': ['owner', 'manager', 'staff'],
  'customer:delete': ['owner', 'manager'],

  // Reports
  'report:view': ['owner', 'manager', 'viewer'],
  'report:export': ['owner', 'manager'],

  // Coupons
  'coupon:create': ['owner', 'manager'],
  'coupon:view': ['owner', 'manager', 'staff', 'viewer'],

  // rAIS
  'rais:generate': ['owner', 'manager'],
  'rais:view': ['owner', 'manager', 'staff', 'viewer'],

  // Settings
  'settings:view': ['owner', 'manager'],
  'settings:update': ['owner'],
} as const satisfies Record<string, readonly Role[]>

export type Permission = keyof typeof PERMISSIONS

export function hasPermission(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly string[]).includes(role)
}
