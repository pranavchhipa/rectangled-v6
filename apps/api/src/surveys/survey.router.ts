import { protectedProcedure, publicProcedure, router } from '../trpc/middleware'
import {
  listSurveysSchema,
  getSurveyByIdSchema,
  createSurveySchema,
  updateSurveySchema,
  archiveSurveySchema,
  getInitialStateSchema,
  advanceSchema,
  completeSchema,
} from '@rectangled/shared'
import { SurveyCrudService } from './survey-crud.service'
import { SurveyEngineService } from './survey-engine.service'

/**
 * Phase 3 Stage D — Survey router.
 *
 * Two surfaces:
 *
 *   Public engine (no auth):
 *     - getInitialState(slug, sessionId?) → first step + sessionId
 *     - advance(...)                       → next step or done
 *     - complete(...)                       → terminal write + triggers
 *
 *   Protected CRUD (workspace member):
 *     - list / getById / create / update / archive
 *
 * Both legacy `/j/{slug}` and `/f/{slug}` URLs route through the public
 * engine endpoints in Stage E (compat shim — deferred).
 */
export function createSurveyRouter(
  crud: SurveyCrudService,
  engine: SurveyEngineService,
) {
  return router({
    // ─── Public engine ──────────────────────────────────────────────────
    getInitialState: publicProcedure
      .input(getInitialStateSchema)
      .query(async ({ input }) => {
        return engine.getInitialState(input)
      }),

    advance: publicProcedure.input(advanceSchema).mutation(async ({ input }) => {
      return engine.advance(input)
    }),

    complete: publicProcedure.input(completeSchema).mutation(async ({ input }) => {
      return engine.complete(input)
    }),

    // ─── Protected CRUD ─────────────────────────────────────────────────
    list: protectedProcedure
      .input(listSurveysSchema)
      .query(async ({ input, ctx }) => {
        return crud.list(
          input.workspaceId,
          {
            locationId: input.locationId,
            template: input.template,
            status: input.status,
            includeArchived: input.includeArchived,
          },
          ctx.user.sub,
        )
      }),

    getById: protectedProcedure
      .input(getSurveyByIdSchema)
      .query(async ({ input, ctx }) => {
        return crud.getById(input.id, ctx.user.sub)
      }),

    create: protectedProcedure
      .input(createSurveySchema)
      .mutation(async ({ input, ctx }) => {
        return crud.create(input, ctx.user.sub)
      }),

    update: protectedProcedure
      .input(updateSurveySchema)
      .mutation(async ({ input, ctx }) => {
        return crud.update(input, ctx.user.sub)
      }),

    archive: protectedProcedure
      .input(archiveSurveySchema)
      .mutation(async ({ input, ctx }) => {
        return crud.archive(input.id, ctx.user.sub)
      }),
  })
}
