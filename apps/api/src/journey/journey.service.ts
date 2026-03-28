import { Injectable, Inject } from '@nestjs/common'
import { TRPCError } from '@trpc/server'
import { eq, and, asc, desc, isNull } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import type { Database } from '@rectangled/db'
import {
  journeys,
  journeyScreens,
  journeyResponses,
  members,
  customers,
  reviews,
  connectorInstances,
} from '@rectangled/db'

@Injectable()
export class JourneyService {
  constructor(@Inject('DATABASE') private readonly db: Database) {}

  async list(workspaceId: string, locationId: string | undefined, userId: string, includeArchived = false) {
    await this.requireMembership(workspaceId, userId)
    const conditions = [eq(journeys.workspaceId, workspaceId)]
    if (locationId) conditions.push(eq(journeys.locationId, locationId))
    if (!includeArchived) conditions.push(isNull(journeys.archivedAt))

    return this.db.query.journeys.findMany({
      where: and(...conditions),
      orderBy: [desc(journeys.createdAt)],
      with: { screens: { orderBy: [asc(journeyScreens.order)] } },
    })
  }

  async getById(id: string, userId: string) {
    const journey = await this.findOrThrow(id)
    await this.requireMembership(journey.workspaceId, userId)
    const screens = await this.db.query.journeyScreens.findMany({
      where: eq(journeyScreens.journeyId, id),
      orderBy: [asc(journeyScreens.order)],
    })
    return { ...journey, screens }
  }

  async create(
    input: {
      workspaceId: string
      locationId?: string
      name: string
      settings?: { positiveThreshold?: number; enableCoupon?: boolean; reviewPlatform?: string }
    },
    userId: string
  ) {
    await this.requireMembership(input.workspaceId, userId)
    const slug = `j-${randomUUID().slice(0, 10)}`

    const [journey] = await this.db
      .insert(journeys)
      .values({
        workspaceId: input.workspaceId,
        locationId: input.locationId,
        name: input.name.trim(),
        slug,
        settings: {
          positiveThreshold: input.settings?.positiveThreshold ?? 4,
          enableCoupon: input.settings?.enableCoupon ?? false,
          reviewPlatform: input.settings?.reviewPlatform ?? 'google',
        },
      })
      .returning()

    return journey
  }

  async update(
    input: {
      id: string
      name?: string
      locationId?: string | null
      isActive?: boolean
      settings?: { positiveThreshold?: number; enableCoupon?: boolean; reviewPlatform?: string }
    },
    userId: string
  ) {
    const journey = await this.findOrThrow(input.id)
    await this.requireMembership(journey.workspaceId, userId)

    const setValues: Record<string, unknown> = { updatedAt: new Date() }
    if (input.name !== undefined) setValues.name = input.name.trim()
    if (input.locationId !== undefined) setValues.locationId = input.locationId
    if (input.isActive !== undefined) setValues.isActive = input.isActive
    if (input.settings) {
      setValues.settings = { ...journey.settings, ...input.settings }
    }

    const [updated] = await this.db
      .update(journeys)
      .set(setValues)
      .where(eq(journeys.id, input.id))
      .returning()

    // When locationId changes, auto-fill Google review URL in screen configs
    if (input.locationId !== undefined && input.locationId !== null) {
      await this.autoFillGoogleReviewUrl(input.id, journey.workspaceId, input.locationId)
    }

    return updated
  }

  private async autoFillGoogleReviewUrl(journeyId: string, workspaceId: string, locationId: string) {
    // Find GBP connector for this location
    const gbpConnector = await this.db.query.connectorInstances.findFirst({
      where: and(
        eq(connectorInstances.workspaceId, workspaceId),
        eq(connectorInstances.connectorTypeId, 'gbp'),
        eq(connectorInstances.locationId, locationId),
      ),
    })
    const placeId = (gbpConnector?.config as any)?.placeId
    if (!placeId) return

    const googleUrl = `https://search.google.com/local/writereview?placeid=${placeId}`

    // Fetch all screens for this journey
    const screens = await this.db.query.journeyScreens.findMany({
      where: eq(journeyScreens.journeyId, journeyId),
    })

    for (const screen of screens) {
      const config = (screen.config ?? {}) as Record<string, any>
      let updated = false

      // Single-screen rating with embedded redirectLinks
      if (screen.screenType === 'rating' && Array.isArray(config.redirectLinks)) {
        const googleLink = config.redirectLinks.find((l: any) => l.platform === 'Google')
        if (googleLink && (!googleLink.url || googleLink.url.includes('writereview?placeid='))) {
          googleLink.url = googleUrl
          updated = true
        } else if (!googleLink) {
          config.redirectLinks.unshift({ platform: 'Google', url: googleUrl })
          updated = true
        }
      }

      // Legacy review_redirect screen
      if (screen.screenType === 'review_redirect' && Array.isArray(config.links)) {
        const googleLink = config.links.find((l: any) => l.platform === 'Google')
        if (googleLink && (!googleLink.url || googleLink.url.includes('writereview?placeid='))) {
          googleLink.url = googleUrl
          updated = true
        } else if (!googleLink) {
          config.links.unshift({ platform: 'Google', url: googleUrl })
          updated = true
        }
      }

      if (updated) {
        await this.db
          .update(journeyScreens)
          .set({ config })
          .where(eq(journeyScreens.id, screen.id))
      }
    }
  }

  async archive(id: string, userId: string) {
    const journey = await this.findOrThrow(id)
    await this.requireMembership(journey.workspaceId, userId)
    const [updated] = await this.db
      .update(journeys)
      .set({ archivedAt: new Date(), isActive: false, updatedAt: new Date() })
      .where(eq(journeys.id, id))
      .returning()
    return updated
  }

  async updateScreens(
    journeyId: string,
    screens: Array<{
      id?: string
      order: number
      screenType: string
      title?: string
      subtitle?: string
      config?: Record<string, unknown>
      branchConditions?: Array<{ field: string; operator: string; value?: unknown; nextScreenId: string }>
    }>,
    userId: string
  ) {
    const journey = await this.findOrThrow(journeyId)
    await this.requireMembership(journey.workspaceId, userId)

    // Auto-fill Google review URLs from journey's location before saving
    let googleUrl: string | undefined
    if (journey.locationId) {
      const gbpConnector = await this.db.query.connectorInstances.findFirst({
        where: and(
          eq(connectorInstances.workspaceId, journey.workspaceId),
          eq(connectorInstances.connectorTypeId, 'gbp'),
          eq(connectorInstances.locationId, journey.locationId),
        ),
      })
      const placeId = (gbpConnector?.config as any)?.placeId
      if (placeId) googleUrl = `https://search.google.com/local/writereview?placeid=${placeId}`
    }

    // Fill empty Google URLs in screen configs
    if (googleUrl) {
      for (const s of screens) {
        const config = (s.config || {}) as Record<string, any>
        if (s.screenType === 'rating' && Array.isArray(config.redirectLinks)) {
          const gl = config.redirectLinks.find((l: any) => l.platform === 'Google')
          if (gl && !gl.url) gl.url = googleUrl
        }
        if (s.screenType === 'review_redirect' && Array.isArray(config.links)) {
          const gl = config.links.find((l: any) => l.platform === 'Google')
          if (gl && !gl.url) gl.url = googleUrl
        }
      }
    }

    // Delete existing screens and re-insert
    await this.db.delete(journeyScreens).where(eq(journeyScreens.journeyId, journeyId))

    if (screens.length === 0) return []

    const values = screens.map((s) => ({
      journeyId,
      order: s.order,
      screenType: s.screenType as any,
      title: s.title,
      subtitle: s.subtitle,
      config: s.config || {},
      branchConditions: s.branchConditions || [],
    }))

    const inserted = await this.db.insert(journeyScreens).values(values).returning()
    return inserted
  }

  // PUBLIC: Get journey by slug (no auth)
  async getPublicJourney(slug: string) {
    const journey = await this.db.query.journeys.findFirst({
      where: and(eq(journeys.slug, slug), eq(journeys.isActive, true)),
    })

    if (!journey) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Journey not found' })
    }

    const screens = await this.db.query.journeyScreens.findMany({
      where: eq(journeyScreens.journeyId, journey.id),
      orderBy: [asc(journeyScreens.order)],
    })

    // Return only public-safe data
    return {
      id: journey.id,
      name: journey.name,
      isActive: journey.isActive,
      locationId: journey.locationId,
      settings: journey.settings,
      screens: screens.map((s) => ({
        id: s.id,
        order: s.order,
        screenType: s.screenType,
        title: s.title,
        subtitle: s.subtitle,
        config: s.config,
        branchConditions: s.branchConditions,
      })),
    }
  }

  // PUBLIC: Submit response (no auth)
  async submitResponse(input: {
    journeyId: string
    journeyScreenId?: string
    locationId?: string
    sessionId: string
    responseData: Record<string, unknown>
    customerName?: string
    customerEmail?: string
    customerPhone?: string
  }) {
    // Optionally create/update customer
    let customerId: string | undefined
    if (input.customerName || input.customerEmail || input.customerPhone) {
      const journey = await this.db.query.journeys.findFirst({
        where: eq(journeys.id, input.journeyId),
      })
      if (journey) {
        const [customer] = await this.db
          .insert(customers)
          .values({
            workspaceId: journey.workspaceId,
            name: input.customerName,
            email: input.customerEmail,
            phone: input.customerPhone,
          })
          .returning()
        customerId = customer.id
      }
    }

    const [response] = await this.db
      .insert(journeyResponses)
      .values({
        journeyId: input.journeyId,
        journeyScreenId: input.journeyScreenId,
        locationId: input.locationId,
        sessionId: input.sessionId,
        responseData: input.responseData,
        customerId,
      })
      .returning()

    // If this is a negative feedback response, create an offline review
    const rating = input.responseData.rating as number | undefined
    if (rating && rating <= 3) {
      const journey = await this.db.query.journeys.findFirst({
        where: eq(journeys.id, input.journeyId),
      })
      if (journey) {
        await this.db.insert(reviews).values({
          workspaceId: journey.workspaceId,
          locationId: input.locationId,
          platform: 'offline',
          platformReviewId: `offline-${response.id}`,
          reviewerName: input.customerName || 'Anonymous',
          rating,
          text: (input.responseData.feedback as string) || null,
          reviewedAt: new Date(),
          source: 'offline',
          journeyResponseId: response.id,
          aspectTags: (input.responseData.tags as string[]) || (input.responseData.aspectTags as string[]) || null,
          customerId,
        })
      }
    }

    return { success: true, responseId: response.id }
  }

  async seedDefault(workspaceId: string, locationId: string | undefined) {
    const slug = `j-${randomUUID().slice(0, 10)}`
    const [journey] = await this.db
      .insert(journeys)
      .values({
        workspaceId,
        locationId,
        name: 'Default Customer Journey',
        slug,
        isDefault: true,
        isActive: true,
        settings: { positiveThreshold: 4, enableCoupon: false, reviewPlatform: 'google' },
      })
      .returning()

    // Create default 3-screen flow
    await this.db.insert(journeyScreens).values([
      {
        journeyId: journey.id,
        order: 0,
        screenType: 'rating' as any,
        title: 'How was your experience?',
        subtitle: 'Tap to rate',
        config: { type: 'stars', maxRating: 5 },
        branchConditions: [],
      },
      {
        journeyId: journey.id,
        order: 1,
        screenType: 'review_redirect' as any,
        title: 'Thank you!',
        subtitle: 'Would you share your experience on Google?',
        config: { showForRating: 'positive', platform: 'google' },
        branchConditions: [],
      },
      {
        journeyId: journey.id,
        order: 2,
        screenType: 'aspects' as any,
        title: "We're sorry to hear that",
        subtitle: "What didn't you like?",
        config: { showForRating: 'negative' },
        branchConditions: [],
      },
      {
        journeyId: journey.id,
        order: 3,
        screenType: 'contact_collection' as any,
        title: 'We want to make this right',
        subtitle: 'Please share your contact so we can reach out',
        config: { showForRating: 'negative', fields: ['name', 'phone', 'email'] },
        branchConditions: [],
      },
      {
        journeyId: journey.id,
        order: 4,
        screenType: 'thank_you' as any,
        title: 'Thank you!',
        subtitle: 'Your feedback helps us improve',
        config: {},
        branchConditions: [],
      },
    ])

    return journey
  }

  private async requireMembership(workspaceId: string, userId: string) {
    const membership = await this.db.query.members.findFirst({
      where: and(eq(members.workspaceId, workspaceId), eq(members.userId, userId)),
    })
    if (!membership || !membership.acceptedAt) {
      throw new TRPCError({ code: 'FORBIDDEN', message: 'You are not a member of this workspace' })
    }
    return membership
  }

  private async findOrThrow(id: string) {
    const journey = await this.db.query.journeys.findFirst({
      where: eq(journeys.id, id),
    })
    if (!journey) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Journey not found' })
    }
    return journey
  }
}
