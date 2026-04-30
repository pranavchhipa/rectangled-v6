/**
 * Tests for the journey metric threshold helper. Pure-function tests, no DB.
 *
 * Run with: npx vitest run packages/shared/src/constants/journey-metrics.test.ts
 * (or any other test runner — the asserts are framework-agnostic if you adapt the wrapper)
 */
import { describe, it, expect } from 'vitest'
import {
  isPositive,
  isScoreInRange,
  pickRandomMetric,
  getDefaultThreshold,
  isJourneyMetric,
  JOURNEY_METRICS,
  type JourneyMetric,
} from './journey-metrics'

describe('isPositive', () => {
  it('CES is inverted — low score = positive', () => {
    expect(isPositive('ces', 2, 3)).toBe(true)
    expect(isPositive('ces', 3, 3)).toBe(true) // boundary
    expect(isPositive('ces', 5, 3)).toBe(false)
  })

  it('CSAT — high score = positive', () => {
    expect(isPositive('csat', 5, 4)).toBe(true)
    expect(isPositive('csat', 4, 4)).toBe(true) // boundary
    expect(isPositive('csat', 3, 4)).toBe(false)
  })

  it('NPS — boundary behaviour', () => {
    expect(isPositive('nps', 9, 9)).toBe(true)
    expect(isPositive('nps', 8, 9)).toBe(false)
    expect(isPositive('nps', 10, 9)).toBe(true)
  })

  it('NEV — handles negative thresholds', () => {
    expect(isPositive('nev', 50, 0)).toBe(true)
    expect(isPositive('nev', 0, 0)).toBe(true)
    expect(isPositive('nev', -10, 0)).toBe(false)
  })

  it('CLI — high score = positive', () => {
    expect(isPositive('cli', 5, 5)).toBe(true)
    expect(isPositive('cli', 4, 5)).toBe(false)
  })
})

describe('isScoreInRange', () => {
  it('NEV bounds at -100 / +100', () => {
    expect(isScoreInRange('nev', -100)).toBe(true)
    expect(isScoreInRange('nev', 100)).toBe(true)
    expect(isScoreInRange('nev', -101)).toBe(false)
    expect(isScoreInRange('nev', 101)).toBe(false)
  })

  it('CSAT bounds at 1-5', () => {
    expect(isScoreInRange('csat', 1)).toBe(true)
    expect(isScoreInRange('csat', 5)).toBe(true)
    expect(isScoreInRange('csat', 0)).toBe(false)
    expect(isScoreInRange('csat', 6)).toBe(false)
  })

  it('NPS bounds at 0-10', () => {
    expect(isScoreInRange('nps', 0)).toBe(true)
    expect(isScoreInRange('nps', 10)).toBe(true)
    expect(isScoreInRange('nps', -1)).toBe(false)
    expect(isScoreInRange('nps', 11)).toBe(false)
  })

  it('rejects non-finite values', () => {
    expect(isScoreInRange('csat', NaN)).toBe(false)
    expect(isScoreInRange('csat', Infinity)).toBe(false)
  })
})

describe('pickRandomMetric', () => {
  it('throws when array is empty', () => {
    expect(() => pickRandomMetric([])).toThrow()
  })

  it('always returns the only entry when array has one item', () => {
    for (let i = 0; i < 50; i++) {
      expect(pickRandomMetric(['csat'])).toBe('csat')
    }
  })

  it('returns a member of the input array', () => {
    const enabled: JourneyMetric[] = ['csat', 'nps', 'ces']
    for (let i = 0; i < 50; i++) {
      const picked = pickRandomMetric(enabled)
      expect(enabled).toContain(picked)
    }
  })
})

describe('getDefaultThreshold', () => {
  it('returns sensible defaults', () => {
    expect(getDefaultThreshold('csat')).toBe(4)
    expect(getDefaultThreshold('nps')).toBe(9)
    expect(getDefaultThreshold('ces')).toBe(3)
    expect(getDefaultThreshold('nev')).toBe(0)
    expect(getDefaultThreshold('cli')).toBe(5)
  })
})

describe('isJourneyMetric', () => {
  it('accepts valid metrics', () => {
    for (const m of JOURNEY_METRICS) expect(isJourneyMetric(m)).toBe(true)
  })

  it('rejects invalid input', () => {
    expect(isJourneyMetric('rating')).toBe(false)
    expect(isJourneyMetric('')).toBe(false)
    expect(isJourneyMetric(null)).toBe(false)
    expect(isJourneyMetric(undefined)).toBe(false)
    expect(isJourneyMetric(42)).toBe(false)
  })
})
