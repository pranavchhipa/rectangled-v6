import { z } from 'zod'

// Phase 1 — onboarding flow per organization type. Branches the wizard.
export const onboardingFlowSchema = z.enum(['direct', 'multi_location', 'agency'])

export const getOnboardingStateSchema = z.object({
  workspaceId: z.string().uuid(),
})

export const updateOnboardingStepSchema = z.object({
  workspaceId: z.string().uuid(),
  step: z.number().int().min(0).max(10),
  data: z.record(z.unknown()).optional(),
})

export const completeOnboardingSchema = z.object({
  workspaceId: z.string().uuid(),
})

// Phase 1 Stage G — pick the flow before entering content steps.
export const setOnboardingFlowSchema = z.object({
  workspaceId: z.string().uuid(),
  flow: onboardingFlowSchema,
})

// ─── Phase 2 — review-platform redirect URLs (hard requirement) ─────────
//
// The Customer-Journeys spec gates onboarding completion on the owner
// supplying a working positive-path URL for every platform they want to
// onboard. Journey A Step 3a.1 (happy YES) opens this URL after writing
// the AI review to the customer's clipboard. See
// obsidian/domains/Onboarding.md → "redirectURL hard requirement".

// redirectPlatformSchema already exported from validators/survey-steps.ts
// for the survey RedirectStep config; we just inline the same enum here
// to avoid a cross-validator import cycle.
export const getRedirectLinksSchema = z.object({
  workspaceId: z.string().uuid(),
})

export const setRedirectLinksSchema = z.object({
  workspaceId: z.string().uuid(),
  redirectLinks: z.object({
    google: z.string().url().optional(),
    zomato: z.string().url().optional(),
    swiggy: z.string().url().optional(),
  }),
  // Phase 2.1 — optional; persisted on workspace.settings.googlePlaceId
  // so the later GBP connector can claim the exact place without making
  // the owner pick again.
  googlePlaceId: z.string().min(1).max(255).optional(),
})

// ─── Phase 2.1 — Places API search for auto-resolve ─────────────────────
//
// Onboarding Step 4 search box. Owner types their business name; server
// hits Google Places API Text Search (using GOOGLE_API_KEY) and returns
// top matches. Picking one constructs the writereview URL deterministically
// and prefills the Google input. See obsidian/domains/Onboarding.md.
export const searchGooglePlacesSchema = z.object({
  workspaceId: z.string().uuid(),
  query: z.string().min(3).max(200),
})
