/**
 * Run with: npx vitest run apps/api/src/automation/triggerKey.test.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { buildTriggerKey } from './triggerKey'

describe('buildTriggerKey', () => {
  it('produces deterministic keys per event + source', () => {
    expect(
      buildTriggerKey({
        workspaceId: 'w',
        event: 'journey_completed_positive',
        journeyResponseId: 'jr1',
      }),
    ).toBe('jcp:jr1')

    expect(
      buildTriggerKey({
        workspaceId: 'w',
        event: 'journey_completed_negative',
        journeyResponseId: 'jr1',
      }),
    ).toBe('jcn:jr1')

    expect(
      buildTriggerKey({ workspaceId: 'w', event: 'review_posted', reviewId: 'r1' }),
    ).toBe('rp:r1')

    expect(
      buildTriggerKey({
        workspaceId: 'w',
        event: 'review_posted_google',
        reviewId: 'r1',
      }),
    ).toBe('rpg:r1')

    expect(
      buildTriggerKey({
        workspaceId: 'w',
        event: 'journey_abandoned',
        journeyResponseId: 'jr2',
      }),
    ).toBe('ja:jr2')
  })

  it('separates positive vs negative for the same response', () => {
    const pos = buildTriggerKey({
      workspaceId: 'w',
      event: 'journey_completed_positive',
      journeyResponseId: 'jr1',
    })
    const neg = buildTriggerKey({
      workspaceId: 'w',
      event: 'journey_completed_negative',
      journeyResponseId: 'jr1',
    })
    expect(pos).not.toBe(neg)
  })

  describe('customer_dormant', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-05-01T12:00:00Z'))
    })
    afterEach(() => vi.useRealTimers())

    it('encodes the date so re-triggering on a later day produces a new key', () => {
      const day1 = buildTriggerKey({
        workspaceId: 'w',
        event: 'customer_dormant',
        customerId: 'c1',
      })
      expect(day1).toBe('cd:c1:2026-05-01')

      vi.setSystemTime(new Date('2026-05-15T12:00:00Z'))
      const day2 = buildTriggerKey({
        workspaceId: 'w',
        event: 'customer_dormant',
        customerId: 'c1',
      })
      expect(day2).toBe('cd:c1:2026-05-15')
      expect(day1).not.toBe(day2)
    })
  })

  describe('custom event', () => {
    it('uses metadata.idempotencyKey when present', () => {
      expect(
        buildTriggerKey({
          workspaceId: 'w',
          event: 'custom',
          metadata: { eventName: 'manual_winback', idempotencyKey: 'abc-123' },
        }),
      ).toBe('c:manual_winback:abc-123')
    })

    it('falls back to a payload hash when no idempotencyKey', () => {
      const a = buildTriggerKey({
        workspaceId: 'w',
        event: 'custom',
        metadata: { eventName: 'foo', payload: { x: 1 } },
      })
      const b = buildTriggerKey({
        workspaceId: 'w',
        event: 'custom',
        metadata: { eventName: 'foo', payload: { x: 1 } },
      })
      const c = buildTriggerKey({
        workspaceId: 'w',
        event: 'custom',
        metadata: { eventName: 'foo', payload: { x: 2 } },
      })
      expect(a).toBe(b)
      expect(a).not.toBe(c)
    })
  })

  it('returns null when the event has no usable source id', () => {
    expect(
      buildTriggerKey({ workspaceId: 'w', event: 'journey_completed_positive' }),
    ).toBeNull()

    expect(
      buildTriggerKey({ workspaceId: 'w', event: 'review_posted' }),
    ).toBeNull()

    expect(
      buildTriggerKey({ workspaceId: 'w', event: 'customer_dormant' }),
    ).toBeNull()
  })

  it('returns null for unknown events', () => {
    expect(
      buildTriggerKey({ workspaceId: 'w', event: 'unknown_event_type' }),
    ).toBeNull()
  })
})
