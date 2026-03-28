import { Injectable, Inject } from '@nestjs/common'
import { TRPCError } from '@trpc/server'
import { eq, and } from 'drizzle-orm'
import type { Database } from '@rectangled/db'
import { journeys, truforms, members } from '@rectangled/db'
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

  async lookupJourneySlug(journeyId: string, workspaceId: string | undefined, userId: string) {
    if (workspaceId) {
      await this.requireMembership(workspaceId, userId)
    }
    const conditions = workspaceId
      ? and(eq(journeys.id, journeyId), eq(journeys.workspaceId, workspaceId))
      : eq(journeys.id, journeyId)
    const journey = await this.db.query.journeys.findFirst({ where: conditions })
    if (!journey) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Journey not found' })
    }
    return journey.slug
  }

  async lookupFormSlug(formId: string, workspaceId: string, userId: string) {
    await this.requireMembership(workspaceId, userId)
    const form = await this.db.query.truforms.findFirst({
      where: and(eq(truforms.id, formId), eq(truforms.workspaceId, workspaceId)),
    })
    if (!form) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Form not found' })
    }
    return form.slug
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
