import { Injectable, Inject } from '@nestjs/common'
import { TRPCError } from '@trpc/server'
import { eq, and, or } from 'drizzle-orm'
import type { Database } from '@rectangled/db'
import { surveys, members } from '@rectangled/db'
import QRCode from 'qrcode'

@Injectable()
export class QrService {
  constructor(@Inject('DATABASE') private readonly db: Database) {}

  async generateJourneyQr(
    journeySlug: string,
    locationId?: string,
    options?: { size?: number; format?: 'png' | 'svg' }
  ) {
    const baseUrl = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    let url = `${baseUrl}/j/${journeySlug}`
    if (locationId) url += `?loc=${locationId}`

    return this.generateQr(url, options)
  }

  async generateFormQr(
    formSlug: string,
    options?: { size?: number; format?: 'png' | 'svg' }
  ) {
    const baseUrl = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const url = `${baseUrl}/f/${formSlug}`

    return this.generateQr(url, options)
  }

  async generateBulkQr(
    items: Array<{ type: 'journey' | 'form'; slug: string; locationId?: string }>
  ) {
    const results: Array<{ slug: string; qrDataUrl: string }> = []

    for (const item of items) {
      let qrDataUrl: string
      if (item.type === 'journey') {
        qrDataUrl = await this.generateJourneyQr(item.slug, item.locationId)
      } else {
        qrDataUrl = await this.generateFormQr(item.slug)
      }
      results.push({ slug: item.slug, qrDataUrl })
    }

    return results
  }

  async generateWithLogo(
    url: string,
    options?: { size?: number }
  ) {
    // Generate QR with higher error correction to allow logo overlay
    const size = options?.size || 300
    const qrDataUrl = await QRCode.toDataURL(url, {
      width: size,
      margin: 2,
      errorCorrectionLevel: 'H', // High correction for logo overlay
      color: { dark: '#000000', light: '#ffffff' },
    })

    return { qrDataUrl, logoPlaceholder: true }
  }

  // --- Lookup helpers used by router ---

  /**
   * Phase 5 — looks up the slug for a survey of template='quick'. Accepts
   * either the new `surveys.id` or the legacy `journeys.id` (preserved on
   * `surveys.legacy_journey_id` for backfilled rows). Callers that still
   * hold legacy IDs keep working until they migrate.
   */
  async lookupJourneySlug(journeyId: string, workspaceId: string | undefined, userId: string) {
    if (workspaceId) {
      await this.requireMembership(workspaceId, userId)
    }
    const idMatch = or(
      eq(surveys.id, journeyId),
      eq(surveys.legacyJourneyId, journeyId),
    )
    const conditions = workspaceId
      ? and(idMatch, eq(surveys.workspaceId, workspaceId), eq(surveys.template, 'quick'))
      : and(idMatch, eq(surveys.template, 'quick'))
    const survey = await this.db.query.surveys.findFirst({ where: conditions })
    if (!survey) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Journey not found' })
    }
    return survey.slug
  }

  /**
   * Phase 5 — same as above for template='deep' (formerly truforms).
   */
  async lookupFormSlug(formId: string, workspaceId: string, userId: string) {
    await this.requireMembership(workspaceId, userId)
    const survey = await this.db.query.surveys.findFirst({
      where: and(
        or(eq(surveys.id, formId), eq(surveys.legacyTruformId, formId)),
        eq(surveys.workspaceId, workspaceId),
        eq(surveys.template, 'deep'),
      ),
    })
    if (!survey) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Form not found' })
    }
    return survey.slug
  }

  // --- Private ---

  private async generateQr(
    url: string,
    options?: { size?: number; format?: 'png' | 'svg' }
  ): Promise<string> {
    const size = options?.size || 300
    const format = options?.format || 'png'

    if (format === 'svg') {
      return QRCode.toString(url, {
        type: 'svg',
        width: size,
        margin: 2,
        errorCorrectionLevel: 'M',
      })
    }

    return QRCode.toDataURL(url, {
      width: size,
      margin: 2,
      errorCorrectionLevel: 'M',
    })
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
}
