import { TRPCError } from '@trpc/server'

/**
 * Phase 4 — legacy table deprecation guard.
 *
 * `journeys` and `truforms` are read-only as of Phase 4. Any service
 * method that would INSERT or UPDATE one of these tables calls this
 * helper as the first line so callers get a clear error instead of
 * the raw PostgreSQL trigger exception.
 *
 * The DB trigger (migration 0013) backstops this — even direct SQL
 * gets blocked. The service-layer guard exists for clean tRPC error
 * messages and to short-circuit before reaching the database.
 *
 * Phase 5 (T+1mo) drops the four legacy tables. Once dropped, this
 * helper and its call-sites can be deleted along with the legacy
 * service files.
 */
/**
 * NB: return type is `void`, not `never`. A `never` return makes
 * TypeScript treat all subsequent code in the calling function as
 * unreachable, which then collapses `this` and local variables to
 * `never` in some flows. Using `void` keeps runtime behaviour identical
 * (the throw still propagates) without poisoning downstream type
 * inference.
 */
export function throwLegacyFrozen(
  legacyEntity: 'journey' | 'truform',
  operation: string,
): void {
  const replacement =
    legacyEntity === 'journey'
      ? 'survey.create / survey.update / survey.complete with template=quick'
      : 'survey.create / survey.update / survey.complete with template=deep'

  throw new TRPCError({
    code: 'METHOD_NOT_SUPPORTED',
    message:
      `[Phase 4] Legacy ${legacyEntity}.${operation} is no longer supported. ` +
      `Use ${replacement} instead. See docs/PHASE_4_CHANGES.md.`,
  })
}
