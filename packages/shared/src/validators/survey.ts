import { z } from 'zod'

/**
 * Phase 3 Stage D — Survey validators.
 *
 * The unified Survey replaces Journey (template='quick') and Truform
 * (template='deep'). The router exposes:
 *   - public engine endpoints (getInitialState / advance / complete)
 *   - protected CRUD (list / getById / create / update / archive)
 */

export const surveyTemplateSchema = z.enum(['quick', 'deep'])
export const surveyModeSchema = z.enum(['intelligent', 'builder'])
export const surveyStatusSchema = z.enum(['draft', 'active', 'archived'])
export const surveyMetricSchema = z.enum(['csat', 'nps', 'ces', 'nev', 'cli'])

/**
 * `settings` is template-dependent. Quick surveys carry the journey-v2
 * shape (enabledMetrics, thresholds, reviewPlatform). Deep surveys carry
 * a `type` field (nps|csat|ces|custom) plus branding/copy. We keep this
 * as `record(unknown)` for flexibility — the engine and CRUD service
 * apply template-specific defaults.
 */
const surveySettingsSchema = z.record(z.unknown())

// ─── CRUD shapes ────────────────────────────────────────────────────────

export const listSurveysSchema = z.object({
  workspaceId: z.string().uuid(),
  locationId: z.string().uuid().optional(),
  template: surveyTemplateSchema.optional(),
  status: surveyStatusSchema.optional(),
  includeArchived: z.boolean().optional(),
})

export const getSurveyByIdSchema = z.object({
  id: z.string().uuid(),
})

export const createSurveySchema = z.object({
  workspaceId: z.string().uuid(),
  locationId: z.string().uuid().optional(),
  name: z.string().min(1).max(255),
  template: surveyTemplateSchema,
  // Mode defaults to 'intelligent' on the server. 'builder' is allowed
  // here so Stage F (builder UI) can flip mode without going through a
  // separate endpoint, but the engine treats both modes the same way at
  // runtime — `mode` is purely a UI hint about which editor to render.
  mode: surveyModeSchema.optional(),
  // Optional: deep surveys want `settings.type` (nps|csat|ces|custom)
  // to seed the right step graph. Quick surveys ignore `settings.type`.
  settings: surveySettingsSchema.optional(),
})

export const updateSurveySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255).optional(),
  locationId: z.string().uuid().nullable().optional(),
  status: surveyStatusSchema.optional(),
  mode: surveyModeSchema.optional(),
  settings: surveySettingsSchema.optional(),
  // Steps can only be patched via the builder; intelligent-mode surveys
  // re-derive their steps from `settings`. Allowing patch here lets Stage
  // F save canvas edits without a separate endpoint.
  steps: z.array(z.record(z.unknown())).optional(),
})

export const archiveSurveySchema = z.object({
  id: z.string().uuid(),
})

// ─── Engine shapes (public, no auth) ────────────────────────────────────

export const getInitialStateSchema = z.object({
  slug: z.string().min(1).max(64),
  sessionId: z.string().uuid().optional(),
})

export const advanceSchema = z.object({
  surveyId: z.string().uuid(),
  sessionId: z.string().uuid(),
  fromStepId: z.string().min(1).max(64),
  // The renderer sends back whatever the user picked. The engine
  // validates against the step type.
  answer: z.unknown(),
  metricShown: surveyMetricSchema.optional(),
  metricScore: z.number().optional(),
})

export const completeSchema = z.object({
  surveyId: z.string().uuid(),
  sessionId: z.string().uuid(),
  finalState: z.object({
    metricShown: surveyMetricSchema.optional(),
    metricScore: z.number().optional(),
    answers: z.record(z.unknown()).optional(),
    contact: z
      .object({
        name: z.string().max(255).optional(),
        email: z.string().email().optional(),
        phone: z.string().max(50).optional(),
      })
      .optional(),
    redirectedTo: z.enum(['google', 'zomato', 'swiggy']).optional(),
    acceptedReviewPrompt: z.boolean().optional(),
  }),
  terminalStepId: z.string().min(1).max(64).optional(),
})

// ─── Phase 3 Stage E — legacy compat shim ───────────────────────────────
//
// The legacy renderer pages (apps/web/src/app/{j,f}/[slug]/page.tsx)
// keep their existing UI but call these mutations instead of the now-
// frozen journey.submitResponse / truform.submitResponse.
// Input shapes mirror the legacy mutations exactly so the renderer
// doesn't have to change its internal logic. Phase 5 deletes these
// along with the legacy URL paths.

export const submitLegacyJourneySchema = z.object({
  journeyId: z.string().uuid(),
  journeyScreenId: z.string().uuid().optional(),
  locationId: z.string().uuid().optional(),
  sessionId: z.string(),
  responseData: z.record(z.unknown()),
  customerName: z.string().optional(),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().optional(),
  updateResponseId: z.string().uuid().optional(),
})

export const submitLegacyTruformSchema = z.object({
  truformId: z.string().uuid(),
  score: z.number().optional(),
  answers: z.record(z.unknown()).default({}),
  metadata: z.record(z.unknown()).default({}),
  // The legacy renderer also passes contact fields, but the legacy
  // submit endpoint silently dropped them — preserving that behaviour
  // here. Future work: route these through the customer upsert.
  customerName: z.string().optional(),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().optional(),
})

// ─── Phase 5 — legacy-shape read endpoints ──────────────────────────────
//
// After the legacy tables are dropped, the renderer pages need to read
// from `surveys` instead of `journeys`/`truforms`. These two queries
// reconstruct the legacy read shape from the survey row + step graph
// so the renderer's UI doesn't have to change. Phase 5+ work can rebuild
// the renderers against the native survey shape and delete these.

export const getPublicLegacyJourneySchema = z.object({
  slug: z.string().min(1).max(64),
})

export const getPublicLegacyTruformSchema = z.object({
  slug: z.string().min(1).max(64),
})
