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
  reviewReply: {
    comment: string
    updateTime: string
  } | null
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
   * List GBP locations for an account, optionally filtering by Place ID.
   * Returns the matching location resource name.
   */
  async findLocationByPlaceId(
    accessToken: string,
    placeId: string
  ): Promise<{ accountName: string; locationName: string } | null> {
    const oauth2Client = this.createAuthClient(accessToken)

    try {
      // List accounts first
      const accounts = await this.listAccounts(accessToken)

      for (const account of accounts) {
        const accountName = account.name as string
        // List locations for each account
        const locationsRes = await oauth2Client.request({
          url: `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations`,
          params: {
            readMask: 'name,metadata',
          },
        })

        const locationsData = locationsRes.data as any
        const gbpLocations = locationsData.locations ?? []

        for (const loc of gbpLocations) {
          // The metadata.placeId field contains the Google Place ID
          if (loc.metadata?.placeId === placeId) {
            return {
              accountName,
              locationName: loc.name as string,
            }
          }
        }
      }

      return null
    } catch (err: any) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to find location by Place ID: ${err.message}`,
      })
    }
  }

  /**
   * Auto-discover the first GBP location from the authorized account.
   * Used when no placeId is available (fallback).
   */
  async getFirstLocation(
    accessToken: string
  ): Promise<{ accountName: string; locationName: string; placeId?: string; businessName?: string } | null> {
    const oauth2Client = this.createAuthClient(accessToken)
    try {
      const accounts = await this.listAccounts(accessToken)
      for (const account of accounts) {
        const accountName = account.name as string
        const locationsRes = await oauth2Client.request({
          url: `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations`,
          params: { readMask: 'name,title,metadata' },
        })
        const locationsData = locationsRes.data as any
        const gbpLocations = locationsData.locations ?? []
        if (gbpLocations.length > 0) {
          const loc = gbpLocations[0]
          return {
            accountName,
            locationName: loc.name as string,
            placeId: loc.metadata?.placeId,
            businessName: loc.title,
          }
        }
      }
      return null
    } catch {
      return null
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
      // URL format: accounts/{accountId}/locations/{locationId}/reviews
      const url = `https://mybusiness.googleapis.com/v4/${accountName}/${locationName}/reviews`
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
          // Reply state — present only if the owner has posted a reply.
          reviewReply: r.reviewReply
            ? {
                comment: r.reviewReply.comment,
                updateTime: r.reviewReply.updateTime,
              }
            : null,
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

  /**
   * Resolve a Google Maps URL to a Place ID.
   *
   * Supports:
   *  - https://www.google.com/maps/place/Business+Name/...
   *  - https://maps.app.goo.gl/... (short links — followed via redirect)
   *  - URLs with `place_id:` or `ftid` query params
   *
   * Uses the Google Places API (findplacefromtext) with the OAuth access token.
   * If no access token is provided, falls back to GOOGLE_API_KEY env var.
   */
  async resolveMapsLink(
    url: string,
    accessToken?: string
  ): Promise<{ placeId: string; businessName: string; address: string }> {
    this.ensureConfigured()

    // 1. Follow redirects to get the canonical URL
    const finalUrl = await this.followRedirects(url)

    // 2. Try to extract a place_id directly from the URL
    const directPlaceId = this.extractPlaceIdFromUrl(finalUrl)
    if (directPlaceId) {
      // Look up details for the place ID to get name + address
      const details = await this.getPlaceDetails(directPlaceId, accessToken)
      return details
    }

    // 3. Extract business name from the URL path
    const businessName = this.extractBusinessNameFromUrl(finalUrl)
    if (!businessName) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message:
          'Could not extract a business name from this Google Maps link. Please check the URL and try again.',
      })
    }

    // 4. Search for the place using Places API findPlaceFromText
    const placeId = await this.findPlaceFromText(businessName, accessToken)

    // 5. Get full details
    const details = await this.getPlaceDetails(placeId, accessToken)
    return details
  }

  /**
   * Follow HTTP redirects to resolve short URLs (e.g. maps.app.goo.gl).
   */
  private async followRedirects(url: string): Promise<string> {
    try {
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (compatible; Rectangled/1.0; +https://rectangled.io)',
        },
      })
      // The final URL after all redirects
      return response.url || url
    } catch {
      // If fetch fails, return the original URL and let downstream parsing try
      return url
    }
  }

  /**
   * Try to extract a Place ID directly from URL parameters.
   * Handles URLs like: ...?ftid=0x...&place_id=ChIJ...
   */
  private extractPlaceIdFromUrl(url: string): string | null {
    try {
      const parsed = new URL(url)

      // Check for place_id query param
      const placeIdParam = parsed.searchParams.get('place_id')
      if (placeIdParam) return placeIdParam

      // Check for ftid param (Google's internal place reference)
      // ftid values aren't Place IDs but we can try
      // Actually ftid is not a Place ID — skip it

      // Check for ChIJ... pattern in the URL (Place ID format)
      const placeIdMatch = url.match(/ChIJ[A-Za-z0-9_-]{20,}/)
      if (placeIdMatch) return placeIdMatch[0]

      return null
    } catch {
      return null
    }
  }

  /**
   * Extract the business name from a Google Maps place URL.
   * URL format: /maps/place/Business+Name+Here/@lat,lng,...
   */
  private extractBusinessNameFromUrl(url: string): string | null {
    try {
      const parsed = new URL(url)
      const pathname = parsed.pathname

      // Match /maps/place/BUSINESS_NAME/ or /maps/place/BUSINESS_NAME/@...
      const placeMatch = pathname.match(/\/maps\/place\/([^/@]+)/)
      if (placeMatch?.[1]) {
        // Decode URL encoding: Business+Name+Here → Business Name Here
        const raw = decodeURIComponent(placeMatch[1].replace(/\+/g, ' '))
        return raw
      }

      // Try to extract from search query parameter (q=...)
      const q = parsed.searchParams.get('q')
      if (q) return q

      return null
    } catch {
      return null
    }
  }

  /**
   * Call Google Places API findPlaceFromText to get a Place ID from text.
   */
  private async findPlaceFromText(
    query: string,
    accessToken?: string
  ): Promise<string> {
    const apiKey = this.config.get<string>('GOOGLE_API_KEY')

    let url: string
    let headers: Record<string, string> = {}

    if (apiKey) {
      url =
        `https://maps.googleapis.com/maps/api/place/findplacefromtext/json` +
        `?input=${encodeURIComponent(query)}` +
        `&inputtype=textquery` +
        `&fields=place_id,name,formatted_address` +
        `&key=${apiKey}`
    } else if (accessToken) {
      // Use OAuth token — the Places API accepts OAuth if the project has it enabled
      url =
        `https://maps.googleapis.com/maps/api/place/findplacefromtext/json` +
        `?input=${encodeURIComponent(query)}` +
        `&inputtype=textquery` +
        `&fields=place_id,name,formatted_address`
      headers['Authorization'] = `Bearer ${accessToken}`
    } else {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message:
          'No Google API key or OAuth access token available. Set GOOGLE_API_KEY in environment or connect GBP first.',
      })
    }

    const res = await fetch(url, { headers })
    const data = (await res.json()) as {
      candidates?: Array<{
        place_id: string
        name: string
        formatted_address: string
      }>
      status: string
      error_message?: string
    }

    if (
      data.status !== 'OK' ||
      !data.candidates ||
      data.candidates.length === 0
    ) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `Could not find a Google place matching "${query}". ${data.error_message ?? ''}`.trim(),
      })
    }

    return data.candidates[0].place_id
  }

  /**
   * Get place details (name, address) for a Place ID.
   */
  private async getPlaceDetails(
    placeId: string,
    accessToken?: string
  ): Promise<{ placeId: string; businessName: string; address: string }> {
    const apiKey = this.config.get<string>('GOOGLE_API_KEY')

    let url: string
    let headers: Record<string, string> = {}

    if (apiKey) {
      url =
        `https://maps.googleapis.com/maps/api/place/details/json` +
        `?place_id=${encodeURIComponent(placeId)}` +
        `&fields=place_id,name,formatted_address` +
        `&key=${apiKey}`
    } else if (accessToken) {
      url =
        `https://maps.googleapis.com/maps/api/place/details/json` +
        `?place_id=${encodeURIComponent(placeId)}` +
        `&fields=place_id,name,formatted_address`
      headers['Authorization'] = `Bearer ${accessToken}`
    } else {
      // Return just the placeId without details
      return { placeId, businessName: '', address: '' }
    }

    try {
      const res = await fetch(url, { headers })
      const data = (await res.json()) as {
        result?: {
          place_id: string
          name: string
          formatted_address: string
        }
        status: string
      }

      if (data.status === 'OK' && data.result) {
        return {
          placeId: data.result.place_id,
          businessName: data.result.name,
          address: data.result.formatted_address,
        }
      }
    } catch {
      // Fall through to default
    }

    return { placeId, businessName: '', address: '' }
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
