import { describe, it, expect } from 'vitest'
import { TRPCError } from '@trpc/server'
import { throwLegacyFrozen } from './legacy-frozen'

/**
 * Phase 4 deprecation guard tests.
 *
 * The DB trigger (migration 0013) backstops every write, but the
 * service-layer helper exists so tRPC clients see a clean
 * METHOD_NOT_SUPPORTED error with a message naming the new endpoint.
 */
describe('throwLegacyFrozen', () => {
  it('throws TRPCError with METHOD_NOT_SUPPORTED for journey', () => {
    expect(() => throwLegacyFrozen('journey', 'create')).toThrow(TRPCError)
    try {
      throwLegacyFrozen('journey', 'create')
    } catch (err) {
      const e = err as TRPCError
      expect(e.code).toBe('METHOD_NOT_SUPPORTED')
      expect(e.message).toContain('[Phase 4]')
      expect(e.message).toContain('journey.create')
      expect(e.message).toContain('survey.create')
      expect(e.message).toContain('template=quick')
    }
  })

  it('throws TRPCError with METHOD_NOT_SUPPORTED for truform', () => {
    try {
      throwLegacyFrozen('truform', 'submitResponse')
    } catch (err) {
      const e = err as TRPCError
      expect(e.code).toBe('METHOD_NOT_SUPPORTED')
      expect(e.message).toContain('[Phase 4]')
      expect(e.message).toContain('truform.submitResponse')
      expect(e.message).toContain('survey')
      expect(e.message).toContain('template=deep')
    }
  })

  it('mentions docs/PHASE_4_CHANGES.md so consumers know where to look', () => {
    try {
      throwLegacyFrozen('journey', 'update')
    } catch (err) {
      const e = err as TRPCError
      expect(e.message).toContain('docs/PHASE_4_CHANGES.md')
    }
  })

  it('uses the operation name verbatim in the error', () => {
    const ops = ['create', 'update', 'archive', 'updateScreens', 'bulkDeploy', 'submitResponse']
    for (const op of ops) {
      try {
        throwLegacyFrozen('journey', op)
        // unreachable
        expect.fail(`expected throw for ${op}`)
      } catch (err) {
        const e = err as TRPCError
        expect(e.message).toContain(`journey.${op}`)
      }
    }
  })
})
