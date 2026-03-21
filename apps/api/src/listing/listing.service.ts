import { Injectable, Inject } from '@nestjs/common'
import { TRPCError } from '@trpc/server'
import { eq, and, desc, isNull } from 'drizzle-orm'
import type { Database } from '@rectangled/db'
import {
  businessListings,
  listingChangeLog,
  listingPosts,
  members,
  connectorInstances,
} from '@rectangled/db'
import { GbpAdapter } from '../connector/adapters/gbp.adapter'
import { ConnectorService } from '../connector/connector.service'
import type { CreateLocalPostInput } from '../connector/adapters/gbp.adapter'

@Injectable()
export class ListingService {
  constructor(
    @Inject('DATABASE') private readonly db: Database,
    private readonly gbpAdapter: GbpAdapter,
    private readonly connectorService: ConnectorService,
  ) {}

  async list(workspaceId: string, userId: string) {
    await this.requireMembership(workspaceId, userId)
    return this.db.query.businessListings.findMany({
      where: eq(businessListings.workspaceId, workspaceId),
      orderBy: [desc(businessListings.updatedAt)],
    })
  }

  async getById(id: string, userId: string) {
    const listing = await this.findOrThrow(id)
    await this.requireMembership(listing.workspaceId, userId)
    return listing
  }

  async getChanges(listingId: string, userId: string) {
    const listing = await this.findOrThrow(listingId)
    await this.requireMembership(listing.workspaceId, userId)
    return this.db.query.listingChangeLog.findMany({
      where: and(
        eq(listingChangeLog.listingId, listingId),
        isNull(listingChangeLog.resolvedAt)
      ),
      orderBy: [desc(listingChangeLog.detectedAt)],
    })
  }

  async resolveChange(changeId: string, userId: string) {
    const change = await this.db.query.listingChangeLog.findFirst({
      where: eq(listingChangeLog.id, changeId),
    })
    if (!change) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Change not found' })
    }
    const listing = await this.findOrThrow(change.listingId)
    await this.requireMembership(listing.workspaceId, userId)

    const [updated] = await this.db
      .update(listingChangeLog)
      .set({ resolvedAt: new Date(), resolvedBy: userId, isAuthorized: true })
      .where(eq(listingChangeLog.id, changeId))
      .returning()
    return updated
  }

  async createPost(
    input: {
      workspaceId: string
      locationId: string
      type: string
      title?: string
      content: string
      imageUrl?: string
      ctaType?: string
      ctaUrl?: string
    },
    userId: string
  ) {
    await this.requireMembership(input.workspaceId, userId)

    // Find connector instance for this location
    const connector = await this.db.query.connectorInstances.findFirst({
      where: and(
        eq(connectorInstances.workspaceId, input.workspaceId),
        eq(connectorInstances.locationId, input.locationId),
        eq(connectorInstances.connectorTypeId, 'gbp'),
        eq(connectorInstances.status, 'connected' as any)
      ),
    })

    const [post] = await this.db
      .insert(listingPosts)
      .values({
        workspaceId: input.workspaceId,
        locationId: input.locationId,
        connectorInstanceId: connector?.id,
        type: input.type,
        title: input.title,
        content: input.content,
        imageUrl: input.imageUrl,
        ctaType: input.ctaType,
        ctaUrl: input.ctaUrl,
      })
      .returning()

    return post
  }

  async listPosts(workspaceId: string, locationId: string | undefined, userId: string) {
    await this.requireMembership(workspaceId, userId)
    const conditions = [eq(listingPosts.workspaceId, workspaceId)]
    if (locationId) conditions.push(eq(listingPosts.locationId, locationId))

    return this.db.query.listingPosts.findMany({
      where: and(...conditions),
      orderBy: [desc(listingPosts.createdAt)],
    })
  }

  async syncListing(connectorInstanceId: string, userId: string) {
    const instance = await this.db.query.connectorInstances.findFirst({
      where: eq(connectorInstances.id, connectorInstanceId),
    })
    if (!instance) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Connector not found' })
    }
    await this.requireMembership(instance.workspaceId, userId)

    // TODO: Call GBP adapter to fetch listing details and sync
    // For now, mark as synced
    return { success: true, message: 'Listing sync will be implemented with GBP adapter extension' }
  }

  /**
   * Publish a post to GBP and save it locally.
   */
  async publishGbpPost(
    input: {
      workspaceId: string
      locationId: string
      type: 'STANDARD' | 'EVENT' | 'OFFER'
      content: string
      title?: string
      imageUrl?: string
      ctaType?: string
      ctaUrl?: string
      eventTitle?: string
      eventStartDate?: string
      eventEndDate?: string
      couponCode?: string
      redeemOnlineUrl?: string
      termsConditions?: string
    },
    userId: string
  ) {
    await this.requireMembership(input.workspaceId, userId)

    // Find GBP connector for this location
    const connector = await this.db.query.connectorInstances.findFirst({
      where: and(
        eq(connectorInstances.workspaceId, input.workspaceId),
        eq(connectorInstances.locationId, input.locationId),
        eq(connectorInstances.connectorTypeId, 'gbp'),
        eq(connectorInstances.status, 'connected' as any)
      ),
    })

    if (!connector) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'No connected GBP connector found for this location',
      })
    }

    const config = connector.config as Record<string, string>
    const locationName = config?.locationName
    if (!locationName) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Connector is missing locationName in config',
      })
    }

    // Get access token (refresh if needed)
    const accessToken = await this.getAccessToken(connector)

    // Build the post input for the adapter
    const postInput: CreateLocalPostInput = {
      topicType: input.type,
      summary: input.content,
    }

    if (input.ctaType && input.ctaUrl) {
      postInput.callToAction = {
        actionType: input.ctaType,
        url: input.ctaUrl,
      }
    }

    if (input.imageUrl) {
      postInput.mediaUrl = input.imageUrl
    }

    if (input.type === 'EVENT' && input.eventTitle && input.eventStartDate && input.eventEndDate) {
      postInput.event = {
        title: input.eventTitle,
        startDate: input.eventStartDate,
        endDate: input.eventEndDate,
      }
    }

    if (input.type === 'OFFER') {
      postInput.offer = {
        couponCode: input.couponCode,
        redeemOnlineUrl: input.redeemOnlineUrl,
        termsConditions: input.termsConditions,
      }
    }

    // Publish to GBP
    const gbpPost = await this.gbpAdapter.createLocalPost(
      accessToken,
      locationName,
      postInput
    )

    // Save locally
    const [post] = await this.db
      .insert(listingPosts)
      .values({
        workspaceId: input.workspaceId,
        locationId: input.locationId,
        connectorInstanceId: connector.id,
        type: input.type,
        title: input.title ?? input.eventTitle,
        content: input.content,
        imageUrl: input.imageUrl,
        ctaType: input.ctaType,
        ctaUrl: input.ctaUrl,
        platformPostId: gbpPost.name,
        status: 'published',
        publishedAt: new Date(),
      })
      .returning()

    return post
  }

  /**
   * Sync posts from GBP for a location.
   */
  async syncGbpPosts(
    workspaceId: string,
    locationId: string,
    userId: string
  ) {
    await this.requireMembership(workspaceId, userId)

    const connector = await this.db.query.connectorInstances.findFirst({
      where: and(
        eq(connectorInstances.workspaceId, workspaceId),
        eq(connectorInstances.locationId, locationId),
        eq(connectorInstances.connectorTypeId, 'gbp'),
        eq(connectorInstances.status, 'connected' as any)
      ),
    })

    if (!connector) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'No connected GBP connector found for this location',
      })
    }

    const config = connector.config as Record<string, string>
    const locationName = config?.locationName
    if (!locationName) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Connector is missing locationName in config',
      })
    }

    const accessToken = await this.getAccessToken(connector)

    const result = await this.gbpAdapter.listLocalPosts(accessToken, locationName)

    return {
      posts: result.posts,
      total: result.posts.length,
    }
  }

  /**
   * Delete a GBP post both remotely and locally.
   */
  async deleteGbpPost(
    workspaceId: string,
    locationId: string,
    postId: string,
    userId: string
  ) {
    await this.requireMembership(workspaceId, userId)

    // Look up the local post record
    const post = await this.db.query.listingPosts.findFirst({
      where: eq(listingPosts.id, postId),
    })

    if (!post) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Post not found' })
    }

    if (post.workspaceId !== workspaceId) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Post does not belong to this workspace',
      })
    }

    // If the post has been published to GBP, delete from GBP first
    if (post.platformPostId && post.connectorInstanceId) {
      try {
        const connector = await this.connectorService.getInstanceByIdInternal(
          post.connectorInstanceId
        )
        const accessToken = await this.getAccessToken(connector)
        await this.gbpAdapter.deleteLocalPost(accessToken, post.platformPostId)
      } catch {
        // If GBP deletion fails (e.g. already deleted), still proceed to local cleanup
      }
    }

    // Update local status
    const [updated] = await this.db
      .update(listingPosts)
      .set({ status: 'deleted', updatedAt: new Date() })
      .where(eq(listingPosts.id, postId))
      .returning()

    return updated
  }

  /**
   * Get a fresh access token for a GBP connector, refreshing if expired.
   */
  private async getAccessToken(
    connector: typeof connectorInstances.$inferSelect
  ): Promise<string> {
    const creds = connector.credentials as Record<string, string>
    if (!creds?.accessToken || !creds?.refreshToken) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Connector is missing OAuth credentials',
      })
    }

    let accessToken = creds.accessToken
    if (creds.expiresAt && new Date(creds.expiresAt) <= new Date()) {
      const refreshed = await this.gbpAdapter.refreshAccessToken(
        creds.refreshToken
      )
      accessToken = refreshed.accessToken
      await this.connectorService.updateCredentials(connector.id, {
        ...creds,
        accessToken: refreshed.accessToken,
        expiresAt: refreshed.expiresAt,
      })
    }

    return accessToken
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
    const listing = await this.db.query.businessListings.findFirst({
      where: eq(businessListings.id, id),
    })
    if (!listing) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Listing not found' })
    }
    return listing
  }
}
