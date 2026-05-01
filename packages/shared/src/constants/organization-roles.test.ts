import { describe, it, expect } from 'vitest'
import {
  ORG_ROLES,
  orgRoleToEffectiveRole,
  maxRole,
  computeEffectiveRole,
} from './organization-roles'

describe('orgRoleToEffectiveRole', () => {
  it('owner / admin → owner', () => {
    expect(orgRoleToEffectiveRole('org_owner')).toBe('owner')
    expect(orgRoleToEffectiveRole('org_admin')).toBe('owner')
  })
  it('manager → manager', () => {
    expect(orgRoleToEffectiveRole('org_manager')).toBe('manager')
  })
  it('member → staff', () => {
    expect(orgRoleToEffectiveRole('org_member')).toBe('staff')
  })
})

describe('maxRole', () => {
  it('picks the higher-rank role', () => {
    expect(maxRole('owner', 'staff')).toBe('owner')
    expect(maxRole('staff', 'manager')).toBe('manager')
    expect(maxRole('viewer', 'staff')).toBe('staff')
  })
  it('handles equal ranks', () => {
    expect(maxRole('owner', 'owner')).toBe('owner')
  })
})

describe('computeEffectiveRole', () => {
  const wsId = 'ws-1'

  it('org_owner has full access regardless of workspace role', () => {
    expect(
      computeEffectiveRole({
        orgRole: 'org_owner',
        workspaceRole: null,
        workspaceIds: null,
        workspaceId: wsId,
      }),
    ).toBe('owner')

    expect(
      computeEffectiveRole({
        orgRole: 'org_owner',
        workspaceRole: 'viewer', // wouldn't normally happen, but verify max picks owner
        workspaceIds: null,
        workspaceId: wsId,
      }),
    ).toBe('owner')
  })

  it('org_manager + ws owner → owner (workspace role wins via max)', () => {
    expect(
      computeEffectiveRole({
        orgRole: 'org_manager',
        workspaceRole: 'owner',
        workspaceIds: null,
        workspaceId: wsId,
      }),
    ).toBe('owner')
  })

  it('org_manager + ws viewer → manager (org-derived wins)', () => {
    expect(
      computeEffectiveRole({
        orgRole: 'org_manager',
        workspaceRole: 'viewer',
        workspaceIds: null,
        workspaceId: wsId,
      }),
    ).toBe('manager')
  })

  it('returns null when scoped workspaceIds excludes the requested workspace', () => {
    expect(
      computeEffectiveRole({
        orgRole: 'org_manager',
        workspaceRole: null,
        workspaceIds: ['other-ws'],
        workspaceId: wsId,
      }),
    ).toBeNull()
  })

  it('respects scope: org_member scoped to one workspace gets staff there', () => {
    expect(
      computeEffectiveRole({
        orgRole: 'org_member',
        workspaceRole: 'staff', // they were also added at workspace level
        workspaceIds: [wsId],
        workspaceId: wsId,
      }),
    ).toBe('staff')
  })

  it('agency client-owner pattern: org_member, single-ws scope, no workspace role → viewer', () => {
    expect(
      computeEffectiveRole({
        orgRole: 'org_member',
        workspaceRole: null,
        workspaceIds: [wsId],
        workspaceId: wsId,
      }),
    ).toBe('viewer')
  })

  it('agency client-owner pattern is NOT triggered when workspace role exists', () => {
    // If they ALSO have a workspace member row, that takes precedence.
    expect(
      computeEffectiveRole({
        orgRole: 'org_member',
        workspaceRole: 'manager',
        workspaceIds: [wsId],
        workspaceId: wsId,
      }),
    ).toBe('manager')
  })

  it('agency client-owner pattern requires workspaceIds.length === 1', () => {
    // Multi-workspace scope is not the client-owner pattern.
    expect(
      computeEffectiveRole({
        orgRole: 'org_member',
        workspaceRole: null,
        workspaceIds: [wsId, 'other-ws'],
        workspaceId: wsId,
      }),
    ).toBe('staff')
  })

  it('ORG_ROLES enum is comprehensive', () => {
    expect(Object.values(ORG_ROLES)).toEqual([
      'org_owner',
      'org_admin',
      'org_manager',
      'org_member',
    ])
  })
})
