/**
 * Hotfix PRD §3.9 — Step graph validation for the decision-tree editor.
 *
 * Runs client-side before the owner clicks Save / Activate. Returns
 * structured issues so the editor can render a red banner + per-step
 * highlighting. Mirrors the rules in PRD §3.9:
 *
 *   - All steps reachable from step[0]
 *   - Every path ends at an end_journey step
 *   - All next pointers reference existing step IDs
 *   - Branch step has at least 1 condition + default
 *   - No cycles (custom journeys are acyclic by spec)
 *
 * Server-side enforcement of these rules can be added later (e.g. as a
 * refine() on the Step A discriminated-union schema). For now the wire
 * validator catches shape errors; this function catches graph-level
 * errors that the wizard's deterministic generator avoids by
 * construction but a free-form editor can introduce.
 */

import type { SurveyStep } from '@rectangled/shared'
import { getStepTypeLabel } from '@rectangled/shared'

export type ValidationIssueSeverity = 'error' | 'warning'

export interface ValidationIssue {
  severity: ValidationIssueSeverity
  /** Owner-facing message — short, references step labels not internal IDs. */
  message: string
  /** Internal step ID this issue belongs to, when applicable. */
  stepId?: string
}

/** Outgoing pointers per step kind. Mirrors the engine's resolveNextStepId. */
function nextStepIdsOf(s: SurveyStep): string[] {
  switch (s.type) {
    case 'ask_metric':
    case 'ask_question':
      return s.config.onComplete.nextStepId ? [s.config.onComplete.nextStepId] : []
    case 'show_message':
    case 'collect_contact':
      return s.config.nextStepId ? [s.config.nextStepId] : []
    case 'branch_by_score':
    case 'branch_by_answer':
      return [
        ...s.config.branches.map((b) => b.nextStepId),
        s.config.defaultNextStepId,
      ]
    case 'redirect':
      return [
        ...(s.config.onYesNextStepId ? [s.config.onYesNextStepId] : []),
        ...(s.config.onNoNextStepId ? [s.config.onNoNextStepId] : []),
      ]
    case 'end_journey':
      return []
  }
}

/** Friendly per-step descriptor for error messages. */
function describeStep(s: SurveyStep): string {
  return `${getStepTypeLabel(s.type).label} (${s.id})`
}

export function validateStepGraph(steps: SurveyStep[]): ValidationIssue[] {
  const issues: ValidationIssue[] = []

  if (steps.length === 0) {
    issues.push({ severity: 'error', message: 'Journey has no steps.' })
    return issues
  }

  // Build ID lookups + dedup check.
  const byId = new Map<string, SurveyStep>()
  const seenIds = new Set<string>()
  for (const s of steps) {
    if (seenIds.has(s.id)) {
      issues.push({
        severity: 'error',
        message: `Two steps share the ID "${s.id}". Step IDs must be unique.`,
        stepId: s.id,
      })
    }
    seenIds.add(s.id)
    byId.set(s.id, s)
  }

  // Missing pointer targets.
  for (const s of steps) {
    for (const target of nextStepIdsOf(s)) {
      if (!byId.has(target)) {
        issues.push({
          severity: 'error',
          message: `${describeStep(s)} points to a step that doesn't exist ("${target}").`,
          stepId: s.id,
        })
      }
    }
  }

  // Reachability from step[0].
  const reachable = new Set<string>()
  {
    const stack = [steps[0]!.id]
    while (stack.length > 0) {
      const id = stack.pop()!
      if (reachable.has(id)) continue
      reachable.add(id)
      const s = byId.get(id)
      if (!s) continue
      for (const next of nextStepIdsOf(s)) {
        if (byId.has(next)) stack.push(next)
      }
    }
  }
  for (const s of steps) {
    if (!reachable.has(s.id)) {
      issues.push({
        severity: 'error',
        message: `${describeStep(s)} can't be reached from the start of the journey.`,
        stepId: s.id,
      })
    }
  }

  // Cycle detection (DFS with recursion stack).
  {
    const visited = new Set<string>()
    const recStack = new Set<string>()
    function dfs(id: string): boolean {
      if (recStack.has(id)) return true
      if (visited.has(id)) return false
      visited.add(id)
      recStack.add(id)
      const s = byId.get(id)
      if (s) {
        for (const next of nextStepIdsOf(s)) {
          if (byId.has(next) && dfs(next)) {
            recStack.delete(id)
            return true
          }
        }
      }
      recStack.delete(id)
      return false
    }
    if (dfs(steps[0]!.id)) {
      issues.push({
        severity: 'error',
        message: 'Journey contains a loop. Custom journeys must not cycle back.',
      })
    }
  }

  // Dead-end detection (non-terminal step with no outgoing pointer).
  for (const s of steps) {
    if (s.type === 'end_journey') continue
    if (nextStepIdsOf(s).length === 0) {
      issues.push({
        severity: 'error',
        message: `${describeStep(s)} has no next step. Pick a target or remove this step.`,
        stepId: s.id,
      })
    }
  }

  // Branch step structural checks.
  for (const s of steps) {
    if (s.type === 'branch_by_score' || s.type === 'branch_by_answer') {
      if (s.config.branches.length === 0) {
        issues.push({
          severity: 'error',
          message: `${describeStep(s)} has no condition.`,
          stepId: s.id,
        })
      }
      if (!s.config.defaultNextStepId) {
        issues.push({
          severity: 'error',
          message: `${describeStep(s)} has no fallback path for scores that don't match any condition.`,
          stepId: s.id,
        })
      }
    }
  }

  return issues
}

/** True iff the graph would pass the §3.9 ship-readiness check. */
export function isShippable(steps: SurveyStep[]): boolean {
  return validateStepGraph(steps).every((i) => i.severity !== 'error')
}
