import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { google } from 'googleapis'
import { TRPCError } from '@trpc/server'

export interface GbpTokens {
  accessToken: string
  refreshToken: string
  expiresAt: string
}

export interface GbpReview {
  reviewId: string
  reviewer: {
    displayName: string
    profilePhotoUrl?: string
  }
  starRating: string // ONE, TWO, THREE, FOUR, FIVE
  comment?: string
  createTime: string
  updateTime: string
  name: string // resource name for reply
}

export interface GbpLocalPost {
  name: string
  languageCode?: string
  summary: string
  callToAction?: {
    actionType: string
    url: string
  }
  media?: Array<{
    mediaFormat: string
    sourceUrl: string
  }>
  topicType: 'STANDARD' | 'EVENT' | 'OFFER'
  event?: {
    title: string
    schedule: {
      startDate: { year: number; month: number; day: number }
      startTime?: { hours: number; minutes: number }
      endDate: { year: number; month: number; day: number }
      endTime?: { hours: number; minutes: number }
    }
  }
  offer?: {
    couponCode?: string
    redeemOnlineUrl?: string
    termsConditions?: string
  }
  state: string
  createTime: string
  updateTime: string
}

export interface CreateLocalPostInput {
  topicType: 'STANDARD' | 'EVENT' | 'OFFER'
  summary: string
  callToAction?: {
    actionType: string
    url: string
  }
  mediaUrl?: string
  event?: {
    title: string
    startDate: string // ISO date
    endDate: string // ISO date
  }
  offer?: {
    couponCode?: string
    redeemOnlineUrl?: string
    termsConditions?: string
  }
}

@Injectable()
export class GbpAdapter {
  private clientId: string
  private clientSecret: string
  private configured = false

  constructor(private config: ConfigService) {
    this.clientId =
      this.config.get<string>('GBP_CLIENT_ID') ??
      this.config.get<string>('GOOGLE_CLIENT_ID') ??
      ''
    this.clientSecret =
      this.config.get<string>('GBP_CLIENT_SECRET') ??
      this.config.get<string>('GOOGLE_CLIENT_SECRET') ??
      ''
    this.configured = !!(this.clientId && this.clientSecret)
  }

  isConfigured(): boolean {
    return this.configured
  }

  /**
   * Generate Google OAuth URL with GBP scopes.
   */
  getAuthUrl(redirectUrl: string, state: string): string {
    this.ensureConfigured()

    const oauth2Client = new google.auth.OAuth2(
      this.clientId,
      this.clientSecret,
      redirectUrl
    )

    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [
        'https://www.googleapis.com/auth/business.manage',
        'https://www.googleapis.com/auth/userinfo.email',
      ],
      state,
    })
  }

  /**
   * Exchange authorization code for OAuth tokens.
   */
  async exchangeCode(
    code: string,
    redirectUrl: string
  ): Promise<GbpTokens> {
    this.ensureConfigured()

    const oauth2Client = new google.auth.OAuth2(
      this.clientId,
      this.clientSecret,
      redirectUrl
    )

    const { tokens } = await oauth2Client.getToken(code)

    if (!tokens.access_token || !tokens.refresh_token) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to obtain Google tokens',
      })
    }

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: tokens.expiry_date
        ? new Date(tokens.expiry_date).toISOString()
        : new Date(Date.now() + 3600 * 1000).toISOString(),
    }
  }

  /**
   * Refresh an expired access token.
   */
  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string
    expiresAt: string
  }> {
    this.ensureConfigured()

    const oauth2Client = new google.auth.OAuth2(
      this.clientId,
      this.clientSecret
    )
    oauth2Client.setCredentials({ refresh_token: refreshToken })

    const { credentials } = await oauth2Client.refreshAccessToken()

    return {
      accessToken: credentials.access_token!,
      expiresAt: credentials.expiry_date
        ? new Date(credentials.expiry_date).toISOString()
        : new Date(Date.now() + 3600 * 1000).toISOString(),
    }
  }

  /**
   * List GBP accounts for the authenticated user.
   */
  async listAccounts(accessToken: string) {
    const oauth2Client = this.createAuthClient(accessToken)
    const mybusiness = google.mybusinessaccountmanagement({
      version: 'v1',
      auth: oauth2Client,
    })

    try {
      const res = await mybusiness.accounts.list()
      return res.data.accounts ?? []
    } catch (err: any) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to list GBP accounts: ${err.message}`,
      })
    }
  }

  /**
   * Fetch reviews for a GBP location.
   */
  async fetchReviews(
    accessToken: string,
    accountName: string,
    locationName: string,
    pageToken?: string
  ): Promise<{ reviews: GbpReview[]; nextPageToken?: string }> {
    const oauth2Client = this.createAuthClient(accessToken)

    try {
      // Use the My Business API v4 for reviews
      const url = `https://mybusiness.googleapis.com/v4/${locationName}/reviews`
      const params: Record<string, string> = { pageSize: '50' }
      if (pageToken) params.pageToken = pageToken

      const res = await oauth2Client.request({
        url,
        params,
      })

      const data = res.data as any

      return {
        reviews: (data.reviews ?? []).map((r: any) => ({
          reviewId: r.reviewId,
          reviewer: {
            displayName: r.reviewer?.displayName ?? 'Anonymous',
            profilePhotoUrl: r.reviewer?.profilePhotoUrl,
          },
          starRating: r.starRating,
          comment: r.comment,
          createTime: r.createTime,
          updateTime: r.updateTime,
          name: r.name,
        })),
        nextPageToken: data.nextPageToken,
      }
    } catch (err: any) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to fetch reviews: ${err.message}`,
      })
    }
  }

  /**
   * Post a reply to a review on GBP.
   */
  async replyToReview(
    accessToken: string,
    reviewName: string,
    comment: string
  ): Promise<void> {
    const oauth2Client = this.createAuthClient(accessToken)

    try {
      await oauth2Client.request({
        url: `https://mybusiness.googleapis.com/v4/${reviewName}/reply`,
        method: 'PUT',
        data: { comment },
      })
    } catch (err: any) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to post review reply: ${err.message}`,
      })
    }
  }

  /**
   * Delete a reply from a review on GBP.
   */
  async deleteReviewReply(
    accessToken: string,
    reviewName: string
  ): Promise<void> {
    const oauth2Client = this.createAuthClient(accessToken)

    try {
      await oauth2Client.request({
        url: `https://mybusiness.googleapis.com/v4/${reviewName}/reply`,
        method: 'DELETE',
      })
    } catch (err: any) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to delete review reply: ${err.message}`,
      })
    }
  }

  /**
   * Create a local post on a GBP location.
   */
  async createLocalPost(
    accessToken: string,
    locationName: string,
    post: CreateLocalPostInput
  ): Promise<GbpLocalPost> {
    const oauth2Client = this.createAuthClient(accessToken)

    try {
      const body: Record<string, unknown> = {
        topicType: post.topicType,
        summary: post.summary,
        languageCode: 'en',
      }

      if (post.callToAction) {
        body.callToAction = post.callToAction
      }

      if (post.mediaUrl) {
        body.media = [
          { mediaFormat: 'PHOTO', sourceUrl: post.mediaUrl },
        ]
      }

      if (post.topicType === 'EVENT' && post.event) {
        const startDate = new Date(post.event.startDate)
        const endDate = new Date(post.event.endDate)
        body.event = {
          title: post.event.title,
          schedule: {
            startDate: {
              year: startDate.getFullYear(),
              month: startDate.getMonth() + 1,
              day: startDate.getDate(),
            },
            endDate: {
              year: endDate.getFullYear(),
              month: endDate.getMonth() + 1,
              day: endDate.getDate(),
            },
          },
        }
      }

      if (post.topicType === 'OFFER' && post.offer) {
        body.offer = post.offer
      }

      const res = await oauth2Client.request({
        url: `https://mybusiness.googleapis.com/v4/${locationName}/localPosts`,
        method: 'POST',
        data: body,
      })

      return res.data as GbpLocalPost
    } catch (err: any) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to create local post: ${err.message}`,
      })
    }
  }

  /**
   * List local posts for a GBP location.
   */
  async listLocalPosts(
    accessToken: string,
    locationName: string,
    pageToken?: string
  ): Promise<{ posts: GbpLocalPost[]; nextPageToken?: string }> {
    const oauth2Client = this.createAuthClient(accessToken)

    try {
      const params: Record<string, string> = { pageSize: '50' }
      if (pageToken) params.pageToken = pageToken

      const res = await oauth2Client.request({
        url: `https://mybusiness.googleapis.com/v4/${locationName}/localPosts`,
        params,
      })

      const data = res.data as any

      return {
        posts: data.localPosts ?? [],
        nextPageToken: data.nextPageToken,
      }
    } catch (err: any) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to list local posts: ${err.message}`,
      })
    }
  }

  /**
   * Update an existing local post on GBP.
   */
  async updateLocalPost(
    accessToken: string,
    postName: string,
    post: Partial<CreateLocalPostInput>
  ): Promise<GbpLocalPost> {
    const oauth2Client = this.createAuthClient(accessToken)

    try {
      const body: Record<string, unknown> = {}

      if (post.summary !== undefined) body.summary = post.summary
      if (post.callToAction) body.callToAction = post.callToAction
      if (post.mediaUrl) {
        body.media = [
          { mediaFormat: 'PHOTO', sourceUrl: post.mediaUrl },
        ]
      }

      const res = await oauth2Client.request({
        url: `https://mybusiness.googleapis.com/v4/${postName}`,
        method: 'PATCH',
        data: body,
      })

      return res.data as GbpLocalPost
    } catch (err: any) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to update local post: ${err.message}`,
      })
    }
  }

  /**
   * Delete a local post from GBP.
   */
  async deleteLocalPost(
    accessToken: string,
    postName: string
  ): Promise<void> {
    const oauth2Client = this.createAuthClient(accessToken)

    try {
      await oauth2Client.request({
        url: `https://mybusiness.googleapis.com/v4/${postName}`,
        method: 'DELETE',
      })
    } catch (err: any) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to delete local post: ${err.message}`,
      })
    }
  }

  private createAuthClient(accessToken: string) {
    const oauth2Client = new google.auth.OAuth2(
      this.clientId,
      this.clientSecret
    )
    oauth2Client.setCredentials({ access_token: accessToken })
    return oauth2Client
  }

  private ensureConfigured() {
    if (!this.configured) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message:
          'Google Business Profile is not configured. Set GBP_CLIENT_ID and GBP_CLIENT_SECRET in environment.',
      })
    }
  }
}

/**
 * Convert GBP star rating string to numeric value.
 */
export function gbpStarRatingToNumber(
  starRating: string
): number {
  const map: Record<string, number> = {
    ONE: 1,
    TWO: 2,
    THREE: 3,
    FOUR: 4,
    FIVE: 5,
  }
  return map[starRating] ?? 0
}
