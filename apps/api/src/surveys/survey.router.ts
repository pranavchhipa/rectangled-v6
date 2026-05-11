import { protectedProcedure, publicProcedure, router } from '../trpc/middleware'
import {
  listSurveysSchema,
  getSurveyByIdSchema,
  createSurveySchema,
  createSurveyFromWizardSchema,
  updateSurveySchema,
  archiveSurveySchema,
  getInitialStateSchema,
  advanceSchema,
  completeSchema,
  submitLegacyJourneySchema,
  submitLegacyTruformSchema,
  getPublicLegacyJourneySchema,
  getPublicLegacyTruformSchema,
  generateHappyReviewDraftSchema,
  listSurveyResponsesSchema,
  getSurveyResponseByIdSchema,
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

    // ─── Phase 3 Stage E — legacy compat shim ──────────────────────────
    // These keep `/j/{slug}` and `/f/{slug}` URLs working. Storage now
    // goes to survey_responses; the input/return shapes match the old
    // journey/truform mutations so the renderer pages don't change.
    submitLegacyJourney: publicProcedure
      .input(submitLegacyJourneySchema)
      .mutation(async ({ input }) => {
        return engine.submitLegacyJourney(input)
      }),

    submitLegacyTruform: publicProcedure
      .input(submitLegacyTruformSchema)
      .mutation(async ({ input }) => {
        return engine.submitLegacyTruform(input)
      }),

    // ─── Phase 5 — legacy-shape read endpoints ─────────────────────────
    // After the legacy tables drop, the renderer reads from these
    // instead of trpc.journey.getPublic / trpc.truform.getPublic.
    getPublicLegacyJourney: publicProcedure
      .input(getPublicLegacyJourneySchema)
      .query(async ({ input }) => {
        return engine.getPublicLegacyJourney(input)
      }),

    getPublicLegacyTruform: publicProcedure
      .input(getPublicLegacyTruformSchema)
      .query(async ({ input }) => {
        return engine.getPublicLegacyTruform(input)
      }),

    // Journey A Step 3a.1 — AI review draft for the customer to paste on
    // the external review platform. Called from /j/[slug] page.tsx when
    // the customer clicks YES on the happy prompt. publicProcedure
    // because the journey itself is unauthenticated. See
    // obsidian/concepts/Customer-Journeys.md.
    generateHappyReviewDraft: publicProcedure
      .input(generateHappyReviewDraftSchema)
      .mutation(async ({ input }) => {
        return engine.generateHappyReviewDraft(input)
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

    // Hotfix PRD §3 — Wizard Custom Journey Builder.
    // Atomic create from wizard answers. metric='random' short-circuits
    // to template='adaptive'; concrete metrics produce template='custom'
    // with a deterministic step graph from buildCustomStepsFromWizard.
    createFromWizard: protectedProcedure
      .input(createSurveyFromWizardSchema)
      .mutation(async ({ input, ctx }) => {
        return crud.createFromWizard(input, ctx.user.sub)
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

    // ─── Hotfix PRD §6 — Responses listing + detail ────────────────────
    listResponses: protectedProcedure
      .input(listSurveyResponsesSchema)
      .query(async ({ input, ctx }) => {
        return crud.listResponses(input, ctx.user.sub)
      }),

    getResponseById: protectedProcedure
      .input(getSurveyResponseByIdSchema)
      .query(async ({ input, ctx }) => {
        return crud.getResponseById(input.id, ctx.user.sub)
      }),
  })
}
