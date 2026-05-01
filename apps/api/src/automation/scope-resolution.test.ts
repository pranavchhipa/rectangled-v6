import { describe, it, expect } from 'vitest'
import {
  resolveRulesByScope,
  ruleAppliesToContext,
  type ScopedRule,
  type ResolutionContext,
} from './scope-resolution'

const ORG = 'org-1'
const WS = 'ws-1'
const LOC = 'loc-1'

const ctx: ResolutionContext = {
  organizationId: ORG,
  workspaceId: WS,
  locationId: LOC,
}

function rule(over: Partial<ScopedRule>): ScopedRule {
  return {
    id: 'r-' + Math.random().toString(36).slice(2, 8),
    scope: 'workspace',
    organizationId: null,
    workspaceId: WS,
    locationId: null,
    triggerEvent: 'review_posted',
    actionType: 'send_message',
    isActive: true,
    ...over,
  }
}

describe('ruleAppliesToContext', () => {
  it('matches org-scope rule by organizationId', () => {
    expect(
      ruleAppliesToContext(
        rule({ scope: 'organization', organizationId: ORG, workspaceId: null }),
        ctx,
      ),
    ).toBe(true)
    expect(
      ruleAppliesToContext(
        rule({ scope: 'organization', organizationId: 'other', workspaceId: null }),
        ctx,
      ),
    ).toBe(false)
  })

  it('matches workspace-scope rule by workspaceId', () => {
    expect(ruleAppliesToContext(rule({ scope: 'workspace', workspaceId: WS }), ctx)).toBe(true)
    expect(
      ruleAppliesToContext(rule({ scope: 'workspace', workspaceId: 'other' }), ctx),
    ).toBe(false)
  })

  it('matches location-scope rule by locationId, only when ctx has a location', () => {
    expect(
      ruleAppliesToContext(rule({ scope: 'location', locationId: LOC }), ctx),
    ).toBe(true)
    expect(
      ruleAppliesToContext(rule({ scope: 'location', locationId: 'other' }), ctx),
    ).toBe(false)
    // Context with no location: location rules can't match
    expect(
      ruleAppliesToContext(rule({ scope: 'location', locationId: LOC }), {
        ...ctx,
        locationId: null,
      }),
    ).toBe(false)
  })
})

describe('resolveRulesByScope — precedence', () => {
  it('only-workspace: fires the workspace rule', () => {
    const r = rule({ scope: 'workspace', workspaceId: WS })
    expect(resolveRulesByScope([r], ctx)).toEqual([r])
  })

  it('only-org: fires the org rule when no workspace/location rule exists', () => {
    const r = rule({ scope: 'organization', organizationId: ORG, workspaceId: null })
    expect(resolveRulesByScope([r], ctx)).toEqual([r])
  })

  it('only-location: fires the location rule', () => {
    const r = rule({ scope: 'location', locationId: LOC, workspaceId: null })
    expect(resolveRulesByScope([r], ctx)).toEqual([r])
  })

  it('location overrides workspace for the same actionType', () => {
    const ws = rule({ scope: 'workspace', workspaceId: WS })
    const loc = rule({ scope: 'location', locationId: LOC, workspaceId: null })
    const winners = resolveRulesByScope([ws, loc], ctx)
    expect(winners).toEqual([loc])
  })

  it('workspace overrides organization for the same actionType', () => {
    const org = rule({ scope: 'organization', organizationId: ORG, workspaceId: null })
    const ws = rule({ scope: 'workspace', workspaceId: WS })
    expect(resolveRulesByScope([org, ws], ctx)).toEqual([ws])
  })

  it('different action types resolve independently — org for one, location for another', () => {
    const orgRule = rule({
      scope: 'organization',
      organizationId: ORG,
      workspaceId: null,
      actionType: 'send_coupon',
    })
    const locRule = rule({
      scope: 'location',
      locationId: LOC,
      workspaceId: null,
      actionType: 'send_message',
    })
    const winners = resolveRulesByScope([orgRule, locRule], ctx)
    expect(winners.sort((a, b) => a.actionType.localeCompare(b.actionType))).toEqual([
      orgRule,
      locRule,
    ])
  })

  it('multiple rules at the same winning scope: all fire', () => {
    const ws1 = rule({ scope: 'workspace', workspaceId: WS, id: 'a' })
    const ws2 = rule({ scope: 'workspace', workspaceId: WS, id: 'b' })
    const winners = resolveRulesByScope([ws1, ws2], ctx)
    expect(winners.map((w) => w.id).sort()).toEqual(['a', 'b'])
  })
})

describe('resolveRulesByScope — disable blocks lower', () => {
  it('disabled location rule blocks workspace rule for the same actionType', () => {
    const ws = rule({ scope: 'workspace', workspaceId: WS, isActive: true })
    const loc = rule({
      scope: 'location',
      locationId: LOC,
      workspaceId: null,
      isActive: false,
    })
    const winners = resolveRulesByScope([ws, loc], ctx)
    expect(winners).toEqual([]) // explicit opt-out at location
  })

  it('disabled workspace rule blocks org rule', () => {
    const org = rule({
      scope: 'organization',
      organizationId: ORG,
      workspaceId: null,
      isActive: true,
    })
    const ws = rule({ scope: 'workspace', workspaceId: WS, isActive: false })
    expect(resolveRulesByScope([org, ws], ctx)).toEqual([])
  })

  it('disabled location rule does NOT block when actionType differs', () => {
    const ws = rule({
      scope: 'workspace',
      workspaceId: WS,
      isActive: true,
      actionType: 'send_coupon',
    })
    const loc = rule({
      scope: 'location',
      locationId: LOC,
      workspaceId: null,
      isActive: false,
      actionType: 'send_message',
    })
    const winners = resolveRulesByScope([ws, loc], ctx)
    expect(winners).toEqual([ws])
  })

  it('two rules at the location scope, one active one disabled: only the active fires', () => {
    const a = rule({
      scope: 'location',
      locationId: LOC,
      workspaceId: null,
      isActive: true,
      id: 'a',
    })
    const b = rule({
      scope: 'location',
      locationId: LOC,
      workspaceId: null,
      isActive: false,
      id: 'b',
    })
    const winners = resolveRulesByScope([a, b], ctx)
    expect(winners.map((w) => w.id)).toEqual(['a'])
  })
})

describe('resolveRulesByScope — context filtering', () => {
  it('drops rules whose scope-id mismatches the context', () => {
    const otherWs = rule({ scope: 'workspace', workspaceId: 'other-ws' })
    expect(resolveRulesByScope([otherWs], ctx)).toEqual([])
  })

  it('drops location rules when context has no location', () => {
    const loc = rule({ scope: 'location', locationId: LOC, workspaceId: null })
    expect(resolveRulesByScope([loc], { ...ctx, locationId: null })).toEqual([])
  })

  it('falls back to lower scope when location rule does not apply', () => {
    const ws = rule({ scope: 'workspace', workspaceId: WS })
    const otherLoc = rule({ scope: 'location', locationId: 'other-loc', workspaceId: null })
    // Location rule is for a different location — drops out at filter step.
    // Workspace rule wins because no location rule is "in the group".
    const winners = resolveRulesByScope([ws, otherLoc], ctx)
    expect(winners).toEqual([ws])
  })
})
