import { relations } from 'drizzle-orm'
import { users } from './users'
import { members } from './members'
import { refreshTokens } from './refresh-tokens'
import { workspaces } from './workspaces'
import { organizations } from './organizations'
import { organizationMembers } from './organization-members'
import { locations } from './locations'
import { connectorTypes, connectorInstances } from './connectors'
import { reviews, reviewResponses } from './reviews'
import { customers } from './customers'
import { businessAspects } from './business-aspects'
import { onboardingState } from './onboarding'
// Phase 5 — journeys, truforms, journey-screens schemas + tables removed.
// Cross-table relations to journeyResponses / truformResponses dropped
// alongside; the orphan UUID columns on coupon_instances, automation_queue,
// nev_responses, cli_responses no longer relate to anything.
import { businessListings, listingChangeLog, listingPosts } from './listings'
import { subscriptions, invoices } from './billing'
import { aiResponseSchedules, aiResponseDailyCounts } from './ai-schedules'
import { couponTemplates, couponInstances } from './coupons'
import { escalationRules, escalations } from './cx-routing'
import { notifications } from './notifications'
import { reportSnapshots } from './reports'
import { automationRules, automationQueue } from './automations'
import { emotionDefinitions, nevResponses } from './nev'
import { cliResponses } from './cli'
import {
  wapisnapWorkspaces,
  wapisnapTemplates,
  wapisnapMessages,
  wapisnapSequences,
} from './wapisnap'
import {
  socialPosts,
  contentCalendar,
  brandVoice,
  raisCredits,
  raisCreditLog,
  raisAnalysis,
  raisPostIdeas,
  raisGeneratedPosts,
} from './rais'

export const usersRelations = relations(users, ({ many }) => ({
  members: many(members),
  refreshTokens: many(refreshTokens),
}))

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
}))

export const membersRelations = relations(members, ({ one }) => ({
  user: one(users, {
    fields: [members.userId],
    references: [users.id],
  }),
  workspace: one(workspaces, {
    fields: [members.workspaceId],
    references: [workspaces.id],
  }),
}))

// Phase 1 — Organizations layer relations
export const organizationsRelations = relations(organizations, ({ one, many }) => ({
  owner: one(users, {
    fields: [organizations.ownerUserId],
    references: [users.id],
  }),
  workspaces: many(workspaces),
  members: many(organizationMembers),
}))

export const organizationMembersRelations = relations(organizationMembers, ({ one }) => ({
  organization: one(organizations, {
    fields: [organizationMembers.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [organizationMembers.userId],
    references: [users.id],
  }),
  inviter: one(users, {
    fields: [organizationMembers.invitedBy],
    references: [users.id],
  }),
}))

export const workspacesRelations = relations(workspaces, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [workspaces.organizationId],
    references: [organizations.id],
  }),
  members: many(members),
  locations: many(locations),
  connectorInstances: many(connectorInstances),
  reviews: many(reviews),
  customers: many(customers),
  businessAspects: many(businessAspects),
  // Phase 5 — journeys + truforms removed. Replaced by:
  //   surveys: many(surveys)
  // (relation declared in surveysRelations below).
  businessListings: many(businessListings),
  listingPosts: many(listingPosts),
  couponTemplates: many(couponTemplates),
  couponInstances: many(couponInstances),
  escalationRules: many(escalationRules),
  escalations: many(escalations),
  notifications: many(notifications),
  automationRules: many(automationRules),
  automationQueue: many(automationQueue),
  nevResponses: many(nevResponses),
  cliResponses: many(cliResponses),
  wapisnapSequences: many(wapisnapSequences),
  socialPosts: many(socialPosts),
  contentCalendar: many(contentCalendar),
  brandVoice: many(brandVoice),
}))

export const locationsRelations = relations(locations, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [locations.workspaceId],
    references: [workspaces.id],
  }),
  connectorInstances: many(connectorInstances),
  reviews: many(reviews),
  wapisnapWorkspace: many(wapisnapWorkspaces),
}))

// Connector relations
export const connectorTypesRelations = relations(
  connectorTypes,
  ({ many }) => ({
    instances: many(connectorInstances),
  })
)

export const connectorInstancesRelations = relations(
  connectorInstances,
  ({ one }) => ({
    connectorType: one(connectorTypes, {
      fields: [connectorInstances.connectorTypeId],
      references: [connectorTypes.id],
    }),
    workspace: one(workspaces, {
      fields: [connectorInstances.workspaceId],
      references: [workspaces.id],
    }),
    location: one(locations, {
      fields: [connectorInstances.locationId],
      references: [locations.id],
    }),
  })
)

// Customer relations
export const customersRelations = relations(customers, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [customers.workspaceId],
    references: [workspaces.id],
  }),
  reviews: many(reviews),
}))

// Review relations
export const reviewsRelations = relations(reviews, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [reviews.workspaceId],
    references: [workspaces.id],
  }),
  location: one(locations, {
    fields: [reviews.locationId],
    references: [locations.id],
  }),
  connectorInstance: one(connectorInstances, {
    fields: [reviews.connectorInstanceId],
    references: [connectorInstances.id],
  }),
  customer: one(customers, {
    fields: [reviews.customerId],
    references: [customers.id],
  }),
  responses: many(reviewResponses),
}))

export const reviewResponsesRelations = relations(
  reviewResponses,
  ({ one }) => ({
    review: one(reviews, {
      fields: [reviewResponses.reviewId],
      references: [reviews.id],
    }),
    approvedByUser: one(users, {
      fields: [reviewResponses.approvedBy],
      references: [users.id],
    }),
  })
)

// Business aspects relations
export const businessAspectsRelations = relations(businessAspects, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [businessAspects.workspaceId],
    references: [workspaces.id],
  }),
}))

// Onboarding relations
export const onboardingStateRelations = relations(onboardingState, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [onboardingState.workspaceId],
    references: [workspaces.id],
  }),
}))

// Journey relations
// Phase 5 — journeysRelations / journeyScreensRelations /
// journeyResponsesRelations / truformsRelations / truformResponsesRelations
// all removed when the legacy tables dropped. Surveys + survey_responses
// have their own relations declared elsewhere; no cross-table relations
// from coupon_instances / automation_queue / nev_responses / cli_responses
// to the (now-orphan) journey/truform-response columns.

// Listing relations
export const businessListingsRelations = relations(businessListings, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [businessListings.workspaceId],
    references: [workspaces.id],
  }),
  location: one(locations, {
    fields: [businessListings.locationId],
    references: [locations.id],
  }),
  connectorInstance: one(connectorInstances, {
    fields: [businessListings.connectorInstanceId],
    references: [connectorInstances.id],
  }),
  changeLogs: many(listingChangeLog),
}))

export const listingChangeLogRelations = relations(listingChangeLog, ({ one }) => ({
  listing: one(businessListings, {
    fields: [listingChangeLog.listingId],
    references: [businessListings.id],
  }),
}))

export const listingPostsRelations = relations(listingPosts, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [listingPosts.workspaceId],
    references: [workspaces.id],
  }),
  location: one(locations, {
    fields: [listingPosts.locationId],
    references: [locations.id],
  }),
  connectorInstance: one(connectorInstances, {
    fields: [listingPosts.connectorInstanceId],
    references: [connectorInstances.id],
  }),
}))

// Billing relations
export const subscriptionsRelations = relations(subscriptions, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [subscriptions.workspaceId],
    references: [workspaces.id],
  }),
  invoices: many(invoices),
}))

export const invoicesRelations = relations(invoices, ({ one }) => ({
  subscription: one(subscriptions, {
    fields: [invoices.subscriptionId],
    references: [subscriptions.id],
  }),
}))

// Coupon relations
export const couponTemplatesRelations = relations(couponTemplates, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [couponTemplates.workspaceId],
    references: [workspaces.id],
  }),
  instances: many(couponInstances),
}))

export const couponInstancesRelations = relations(couponInstances, ({ one }) => ({
  template: one(couponTemplates, {
    fields: [couponInstances.templateId],
    references: [couponTemplates.id],
  }),
  workspace: one(workspaces, {
    fields: [couponInstances.workspaceId],
    references: [workspaces.id],
  }),
  customer: one(customers, {
    fields: [couponInstances.customerId],
    references: [customers.id],
  }),
  location: one(locations, {
    fields: [couponInstances.locationId],
    references: [locations.id],
  }),
  // Phase 5 — journeyResponse relation removed (target table dropped).
  // couponInstances.journeyResponseId is now an orphan UUID.
  review: one(reviews, {
    fields: [couponInstances.reviewId],
    references: [reviews.id],
  }),
}))

// CX Routing relations
export const escalationRulesRelations = relations(escalationRules, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [escalationRules.workspaceId],
    references: [workspaces.id],
  }),
  assignToUser: one(users, {
    fields: [escalationRules.assignToUserId],
    references: [users.id],
  }),
}))

export const escalationsRelations = relations(escalations, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [escalations.workspaceId],
    references: [workspaces.id],
  }),
  rule: one(escalationRules, {
    fields: [escalations.ruleId],
    references: [escalationRules.id],
  }),
  review: one(reviews, {
    fields: [escalations.reviewId],
    references: [reviews.id],
  }),
  customer: one(customers, {
    fields: [escalations.customerId],
    references: [customers.id],
  }),
  location: one(locations, {
    fields: [escalations.locationId],
    references: [locations.id],
  }),
  assignedToUser: one(users, {
    fields: [escalations.assignedToUserId],
    references: [users.id],
    relationName: 'escalationAssignee',
  }),
  resolvedByUser: one(users, {
    fields: [escalations.resolvedByUserId],
    references: [users.id],
    relationName: 'escalationResolver',
  }),
}))

// Notification relations
export const notificationsRelations = relations(notifications, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [notifications.workspaceId],
    references: [workspaces.id],
  }),
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}))

// Report relations
export const reportSnapshotsRelations = relations(reportSnapshots, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [reportSnapshots.workspaceId],
    references: [workspaces.id],
  }),
  location: one(locations, {
    fields: [reportSnapshots.locationId],
    references: [locations.id],
  }),
  generatedByUser: one(users, {
    fields: [reportSnapshots.generatedByUserId],
    references: [users.id],
  }),
}))

// Automation relations
export const automationRulesRelations = relations(automationRules, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [automationRules.workspaceId],
    references: [workspaces.id],
  }),
  // Phase 5 — journey relation removed (table dropped). journeyId column
  // is an orphan UUID; rule scoping has moved to scope='workspace' and the
  // chain rules system from Phase 2.
  queueEntries: many(automationQueue),
}))

export const automationQueueRelations = relations(automationQueue, ({ one }) => ({
  rule: one(automationRules, {
    fields: [automationQueue.ruleId],
    references: [automationRules.id],
  }),
  workspace: one(workspaces, {
    fields: [automationQueue.workspaceId],
    references: [workspaces.id],
  }),
  customer: one(customers, {
    fields: [automationQueue.customerId],
    references: [customers.id],
  }),
  // Phase 5 — journeyResponse relation removed.
  review: one(reviews, {
    fields: [automationQueue.reviewId],
    references: [reviews.id],
  }),
}))

// NEV relations
export const nevResponsesRelations = relations(nevResponses, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [nevResponses.workspaceId],
    references: [workspaces.id],
  }),
  customer: one(customers, {
    fields: [nevResponses.customerId],
    references: [customers.id],
  }),
  location: one(locations, {
    fields: [nevResponses.locationId],
    references: [locations.id],
  }),
  review: one(reviews, {
    fields: [nevResponses.reviewId],
    references: [reviews.id],
  }),
  // Phase 5 — truformResponse + journeyResponse relations removed.
}))

// CLI relations
export const cliResponsesRelations = relations(cliResponses, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [cliResponses.workspaceId],
    references: [workspaces.id],
  }),
  customer: one(customers, {
    fields: [cliResponses.customerId],
    references: [customers.id],
  }),
  location: one(locations, {
    fields: [cliResponses.locationId],
    references: [locations.id],
  }),
  // Phase 5 — truformResponse + journeyResponse relations removed.
}))

// WapiSnap relations
export const wapisnapWorkspacesRelations = relations(wapisnapWorkspaces, ({ one, many }) => ({
  location: one(locations, {
    fields: [wapisnapWorkspaces.locationId],
    references: [locations.id],
  }),
  templates: many(wapisnapTemplates),
  messages: many(wapisnapMessages),
}))

export const wapisnapTemplatesRelations = relations(wapisnapTemplates, ({ one }) => ({
  wapisnapWorkspace: one(wapisnapWorkspaces, {
    fields: [wapisnapTemplates.wapisnapWorkspaceId],
    references: [wapisnapWorkspaces.id],
  }),
}))

export const wapisnapMessagesRelations = relations(wapisnapMessages, ({ one }) => ({
  wapisnapWorkspace: one(wapisnapWorkspaces, {
    fields: [wapisnapMessages.wapisnapWorkspaceId],
    references: [wapisnapWorkspaces.id],
  }),
}))

export const wapisnapSequencesRelations = relations(wapisnapSequences, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [wapisnapSequences.workspaceId],
    references: [workspaces.id],
  }),
  customer: one(customers, {
    fields: [wapisnapSequences.customerId],
    references: [customers.id],
  }),
}))

// rAIS (AI Studio) relations
export const socialPostsRelations = relations(socialPosts, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [socialPosts.workspaceId],
    references: [workspaces.id],
  }),
  location: one(locations, {
    fields: [socialPosts.locationId],
    references: [locations.id],
  }),
  createdByUser: one(users, {
    fields: [socialPosts.createdBy],
    references: [users.id],
  }),
}))

export const contentCalendarRelations = relations(contentCalendar, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [contentCalendar.workspaceId],
    references: [workspaces.id],
  }),
}))

export const brandVoiceRelations = relations(brandVoice, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [brandVoice.workspaceId],
    references: [workspaces.id],
  }),
}))

// RAIS Credits relations
export const raisCreditsRelations = relations(raisCredits, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [raisCredits.workspaceId],
    references: [workspaces.id],
  }),
}))

export const raisCreditLogRelations = relations(raisCreditLog, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [raisCreditLog.workspaceId],
    references: [workspaces.id],
  }),
}))

export const raisAnalysisRelations = relations(raisAnalysis, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [raisAnalysis.workspaceId],
    references: [workspaces.id],
  }),
  location: one(locations, {
    fields: [raisAnalysis.locationId],
    references: [locations.id],
  }),
  postIdeas: many(raisPostIdeas),
}))

export const raisPostIdeasRelations = relations(raisPostIdeas, ({ one, many }) => ({
  analysis: one(raisAnalysis, {
    fields: [raisPostIdeas.analysisId],
    references: [raisAnalysis.id],
  }),
  workspace: one(workspaces, {
    fields: [raisPostIdeas.workspaceId],
    references: [workspaces.id],
  }),
  generatedPosts: many(raisGeneratedPosts),
}))

export const raisGeneratedPostsRelations = relations(raisGeneratedPosts, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [raisGeneratedPosts.workspaceId],
    references: [workspaces.id],
  }),
  idea: one(raisPostIdeas, {
    fields: [raisGeneratedPosts.ideaId],
    references: [raisPostIdeas.id],
  }),
}))
