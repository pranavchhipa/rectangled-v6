/**
 * Phase 2 — rule scope precedence resolver.
 *
 * Pure function over a list of rules + the event's context. No DB calls.
 * Lets us unit-test precedence without standing up Postgres.
 *
 * Rules:
 *   - Each rule has scope ('organization' | 'workspace' | 'location') and
 *     a matching scope-id field (organizationId / workspaceId / locationId).
 *   - For each (triggerEvent, actionType), the most specific scope wins:
 *     location > workspace > organization.
 *   - Disabled (isActive=false) at the highest scope BLOCKS lower scopes
 *     from firing. This is the explicit-opt-out semantic from the spec
 *     ("disabled at higher specificity blocks lower specificity").
 *   - Multiple rules at the same winning scope all fire (today's behaviour
 *     when multiple workspace rules listen for the same event).
 */

export type RuleScope = 'organization' | 'workspace' | 'location'

export interface ScopedRule {
  id: string
  scope: RuleScope
  organizationId: string | null
  workspaceId: string | null
  locationId: string | null
  triggerEvent: string
  actionType: string
  isActive: boolean
  // Other fields exist on the real rules; the resolver doesn't care.
}

export interface ResolutionContext {
  organizationId: string
  workspaceId: string
  locationId: string | null
}

const SCOPE_RANK: Record<RuleScope, number> = {
  organization: 1,
  workspace: 2,
  location: 3,
}

/**
 * Whether a rule applies to the given event context. A rule applies if:
 *   - org scope: rule.organizationId === ctx.organizationId
 *   - workspace scope: rule.workspaceId === ctx.workspaceId
 *   - location scope: rule.locationId === ctx.locationId (and ctx has one)
 */
export function ruleAppliesToContext(rule: ScopedRule, ctx: ResolutionContext): boolean {
  switch (rule.scope) {
    case 'organization':
      return rule.organizationId === ctx.organizationId
    case 'workspace':
      return rule.workspaceId === ctx.workspaceId
    case 'location':
      return ctx.locationId !== null && rule.locationId === ctx.locationId
  }
}

/**
 * Resolve the set of rules that should fire for an event, across all 3
 * scopes, honouring precedence and the disable-blocks-lower semantic.
 *
 * Input: every rule that COULD apply to this event (event-type filter
 * already applied; ANY isActive). The function does the rest.
 */
export function resolveRulesByScope<R extends ScopedRule>(
  rules: R[],
  ctx: ResolutionContext,
): R[] {
  // Step 1: keep only rules whose scope-id matches the context.
  const applicable = rules.filter((r) => ruleAppliesToContext(r, ctx))

  // Step 2: group by (triggerEvent, actionType).
  const groups = new Map<string, R[]>()
  for (const r of applicable) {
    const key = `${r.triggerEvent}::${r.actionType}`
    let arr = groups.get(key)
    if (!arr) {
      arr = []
      groups.set(key, arr)
    }
    arr.push(r)
  }

  // Step 3: per group, find the highest scope present. If any rule at that
  // scope is active, fire ALL active rules at that scope. If the highest
  // scope is fully disabled, fire nothing — explicit opt-out wins.
  const winners: R[] = []
  for (const group of groups.values()) {
    let topRank = 0
    for (const r of group) {
      const rank = SCOPE_RANK[r.scope]
      if (rank > topRank) topRank = rank
    }
    const atTop = group.filter((r) => SCOPE_RANK[r.scope] === topRank)
    const activeAtTop = atTop.filter((r) => r.isActive)
    // If everything at the top scope is disabled, skip (block lower scopes).
    if (activeAtTop.length === 0) continue
    winners.push(...activeAtTop)
  }
  return winners
}
