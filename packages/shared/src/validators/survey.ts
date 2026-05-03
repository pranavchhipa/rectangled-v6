import { z } from 'zod'
import { surveyStepSchema } from './survey-steps'

/**
 * Phase 3 Stage D — Survey validators.
 *
 * The unified Survey replaces Journey (template='quick') and Truform
 * (template='deep'). The router exposes:
 *   - public engine endpoints (getInitialState / advance / complete)
 *   - protected CRUD (list / getById / create / update / archive)
 */

// Hotfix §2 — adaptive (locked v2 flow) + custom (wizard-built) added.
export const surveyTemplateSchema = z.enum([
  'quick',
  'deep',
  'adaptive',
  'custom',
])
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
  //
  // Hotfix §3 (Step A): tightened from `z.array(z.record(z.unknown()))`
  // to the discriminated-union step schema. Catches malformed step
  // graphs at the wire boundary instead of letting them rot in the DB
  // until the engine can't run them. Dry-run pass against the 19 prod
  // surveys passes 19/19 (see scripts/dry-run-step-validators.mjs).
  steps: z.array(surveyStepSchema).optional(),
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
  /**
   * Hotfix PRD §3.6 — preview mode for the decision-tree editor.
   * When true, the engine returns a synthetic success response without
   * inserting `survey_starts` / `survey_responses` / `customers` /
   * `reviews` rows or firing automations. Used by the editor's
   * "📱 Preview" button which opens `/j/{slug}?preview=true` in a new
   * tab so the owner walks through the actual public renderer with
   * zero side effects.
   */
  preview: z.boolean().optional(),
})

export const submitLegacyTruformSchema = z.object({
  truformId: z.string().uuid(),
  score: z.number().optional(),
  answers: z.record(z.unknown()).default({}),
  metadata: z.record(z.unknown()).default({}),
  // Hotfix PRD §6 — these are now wired to a real customer upsert in
  // submitLegacyTruform (was silently dropped before). Mirrors the
  // journey shim's customer-upsert path.
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
  /**
   * Hotfix-2 — preview mode for the editor's Preview button. When true,
   * the engine drops the `status='active'` filter so owners can walk
   * draft journeys before activating them. Pairs with the same flag on
   * `submitLegacyJourneySchema` (which already no-ops persistence).
   * Without this flag, freshly-created draft surveys 404 in preview.
   */
  preview: z.boolean().optional(),
})

export const getPublicLegacyTruformSchema = z.object({
  slug: z.string().min(1).max(64),
  preview: z.boolean().optional(),
})

// ─── Hotfix PRD §6 — Responses listing + detail ─────────────────────────

export const listSurveyResponsesSchema = z.object({
  // Either workspaceId (workspace-wide) or surveyId (per-survey) MUST be set.
  // If both are set, the surveyId takes precedence and the workspace check
  // is used as a membership guard.
  workspaceId: z.string().uuid().optional(),
  surveyId: z.string().uuid().optional(),
  filter: z.enum(['all', 'happy', 'unhappy', 'neutral']).optional(),
  search: z.string().max(255).optional(),
  dateFrom: z.union([z.string().datetime(), z.date()]).optional(),
  dateTo: z.union([z.string().datetime(), z.date()]).optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(200).default(25),
})

export const getSurveyResponseByIdSchema = z.object({
  id: z.string().uuid(),
})
