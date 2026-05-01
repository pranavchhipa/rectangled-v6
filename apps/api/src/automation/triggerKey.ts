/**
 * Deterministic trigger keys for automation_queue idempotency (Phase 0 Fix 1).
 *
 * Same trigger event for the same source must produce the SAME key, so the
 * unique index (rule_id, trigger_key) catches duplicate enqueues. Different
 * sources or different events produce different keys.
 *
 * Key format is short and human-readable so debugging the queue table is easy.
 *   journey_completed_positive  jcp:{journeyResponseId}
 *   journey_completed_negative  jcn:{journeyResponseId}
 *   journey_abandoned           ja:{journeyResponseId}
 *   review_posted               rp:{reviewId}
 *   review_posted_google        rpg:{reviewId}
 *   customer_dormant            cd:{customerId}:{YYYY-MM-DD}
 *   custom                      c:{eventName}:{idempotencyKey ?? hash(payload)}
 *
 * If we cannot construct a meaningful key from the context (e.g. an event
 * fires with no source ids), we return null and the caller does NOT pass
 * trigger_key — the row is inserted without idempotency protection. This is
 * a deliberate fallback: better to enqueue twice than to silently swallow.
 */
import { createHash } from 'node:crypto'

export type TriggerContext = {
  workspaceId: string
  event: string
  journeyId?: string
  customerId?: string
  journeyResponseId?: string
  reviewId?: string
  metadata?: Record<string, unknown>
}

export function buildTriggerKey(ctx: TriggerContext): string | null {
  switch (ctx.event) {
    case 'journey_completed_positive':
      return ctx.journeyResponseId ? `jcp:${ctx.journeyResponseId}` : null
    case 'journey_completed_negative':
      return ctx.journeyResponseId ? `jcn:${ctx.journeyResponseId}` : null
    case 'journey_abandoned':
      return ctx.journeyResponseId ? `ja:${ctx.journeyResponseId}` : null
    case 'review_posted':
      return ctx.reviewId ? `rp:${ctx.reviewId}` : null
    case 'review_posted_google':
      return ctx.reviewId ? `rpg:${ctx.reviewId}` : null
    case 'customer_dormant': {
      if (!ctx.customerId) return null
      // Per-day key so the same customer can re-trigger after a fresh dormancy
      // sweep on a later day, but not multiple times in one day.
      const today = new Date().toISOString().slice(0, 10)
      return `cd:${ctx.customerId}:${today}`
    }
    case 'custom': {
      const md = ctx.metadata ?? {}
      const eventName = (md.eventName as string | undefined) ?? 'unknown'
      const idem = (md.idempotencyKey as string | undefined)
      if (idem) return `c:${eventName}:${idem}`
      // Fall back to a hash of the payload so two identical custom payloads
      // dedupe but different ones don't.
      const payloadHash = createHash('sha1')
        .update(JSON.stringify(md))
        .digest('hex')
        .slice(0, 16)
      return `c:${eventName}:${payloadHash}`
    }
    default:
      return null
  }
}
