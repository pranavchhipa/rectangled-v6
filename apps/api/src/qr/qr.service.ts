import { Injectable, Inject, Logger } from '@nestjs/common'
import { TRPCError } from '@trpc/server'
import { eq, and, or, desc, sql, isNull } from 'drizzle-orm'
import { randomBytes } from 'crypto'
import type { Database } from '@rectangled/db'
import { surveys, members, qrCodes } from '@rectangled/db'
import QRCode from 'qrcode'

/**
 * 8-char base64url short code. ~2.8 * 10^14 combinations — safe against
 * collision for any single workspace's QR catalog. Generator uses Node's
 * `crypto.randomBytes`, not `Math.random`.
 */
function generateShortCode(): string {
  return randomBytes(6).toString('base64url')
}

function buildBaseUrl(): string {
  return (
    process.env.FRONTEND_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'http://localhost:3000'
  )
}

@Injectable()
export class QrService {
  private readonly logger = new Logger(QrService.name)
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

  // ─── QR Code Management System (registry CRUD) ────────────────────

  /**
   * List every QR in a workspace. Joined with `surveys` so the dashboard
   * table can render the target name + slug without N+1 queries.
   */
  async listQrCodes(
    workspaceId: string,
    userId: string,
    filters?: { status?: 'active' | 'archived'; locationId?: string },
  ) {
    await this.requireMembership(workspaceId, userId)

    // Auto-backfill: for active surveys in this workspace that don't yet
    // have a QR row, create a default one. Owners arriving at
    // /dashboard/qr expect to see one entry per existing journey/truform
    // out of the box, not an empty table. Idempotent — wrapped in
    // try/catch so a race condition (two parallel list calls) doesn't
    // surface a duplicate-short-code error.
    await this.backfillDefaultQrsForWorkspace(workspaceId, userId)

    const where = [eq(qrCodes.workspaceId, workspaceId)]
    if (filters?.status) where.push(eq(qrCodes.status, filters.status))
    if (filters?.locationId)
      where.push(eq(qrCodes.locationId, filters.locationId))

    const rows = await this.db
      .select({
        id: qrCodes.id,
        workspaceId: qrCodes.workspaceId,
        locationId: qrCodes.locationId,
        targetType: qrCodes.targetType,
        targetId: qrCodes.targetId,
        label: qrCodes.label,
        shortCode: qrCodes.shortCode,
        destinationUrl: qrCodes.destinationUrl,
        clickCount: qrCodes.clickCount,
        status: qrCodes.status,
        createdAt: qrCodes.createdAt,
        targetName: surveys.name,
        targetSlug: surveys.slug,
      })
      .from(qrCodes)
      .leftJoin(surveys, eq(qrCodes.targetId, surveys.id))
      .where(and(...where))
      .orderBy(desc(qrCodes.createdAt))

    const base = buildBaseUrl()
    return rows.map((r) => ({
      ...r,
      // The trackable short URL — what owners share / print.
      trackingUrl: `${base}/q/${r.shortCode}`,
    }))
  }

  /**
   * Register a new QR. Looks up the target survey, picks a short code,
   * caches the destination URL. Returns the row + tracking URL.
   */
  async createQrCode(
    input: {
      workspaceId: string
      targetType: 'journey' | 'form'
      targetId: string
      label?: string
      locationId?: string
    },
    userId: string,
  ) {
    await this.requireMembership(input.workspaceId, userId)

    // Validate the target survey exists in this workspace AND matches the
    // template (journey = quick/adaptive/custom, form = deep).
    const survey = await this.db.query.surveys.findFirst({
      where: and(
        eq(surveys.id, input.targetId),
        eq(surveys.workspaceId, input.workspaceId),
      ),
    })
    if (!survey) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Survey not found in this workspace',
      })
    }
    const isForm = survey.template === 'deep'
    if (input.targetType === 'form' && !isForm) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Survey is not a TruForm (template != "deep")',
      })
    }
    if (input.targetType === 'journey' && isForm) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Survey is a TruForm — use targetType "form"',
      })
    }

    const base = buildBaseUrl()
    const path = isForm ? `/f/${survey.slug}` : `/j/${survey.slug}`
    const destinationUrl = input.locationId
      ? `${base}${path}?loc=${input.locationId}`
      : `${base}${path}`

    // Retry on the (very rare) short-code collision.
    let attempt = 0
    while (attempt < 5) {
      const shortCode = generateShortCode()
      try {
        const [row] = await this.db
          .insert(qrCodes)
          .values({
            workspaceId: input.workspaceId,
            locationId: input.locationId,
            targetType: input.targetType,
            targetId: input.targetId,
            label: input.label,
            shortCode,
            destinationUrl,
            createdBy: userId,
          })
          .returning()
        return {
          ...row,
          targetName: survey.name,
          targetSlug: survey.slug,
          trackingUrl: `${base}/q/${row.shortCode}`,
        }
      } catch (err: any) {
        // Postgres unique violation on short_code → retry
        if (err?.code === '23505' && /short_code/.test(err?.detail ?? '')) {
          attempt++
          continue
        }
        throw err
      }
    }
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Could not allocate a unique short code after 5 attempts',
    })
  }

  async updateQrCode(
    input: { id: string; label?: string; status?: 'active' | 'archived' },
    userId: string,
  ) {
    const row = await this.db.query.qrCodes.findFirst({
      where: eq(qrCodes.id, input.id),
    })
    if (!row) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'QR not found' })
    }
    await this.requireMembership(row.workspaceId, userId)

    const patch: Partial<typeof qrCodes.$inferInsert> = { updatedAt: new Date() }
    if (input.label !== undefined) patch.label = input.label
    if (input.status !== undefined) patch.status = input.status

    const [updated] = await this.db
      .update(qrCodes)
      .set(patch)
      .where(eq(qrCodes.id, input.id))
      .returning()
    return updated
  }

  async archiveQrCode(id: string, userId: string) {
    return this.updateQrCode({ id, status: 'archived' }, userId)
  }

  /**
   * Generate a downloadable PNG/SVG for a registered QR. Encodes the
   * trackable short URL (not the destination), so the QR routes through
   * the click counter on every scan.
   */
  async downloadQrCode(
    input: { id: string; format: 'png' | 'svg'; size: number },
    userId: string,
  ) {
    const row = await this.db.query.qrCodes.findFirst({
      where: eq(qrCodes.id, input.id),
    })
    if (!row) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'QR not found' })
    }
    await this.requireMembership(row.workspaceId, userId)

    const base = buildBaseUrl()
    const trackingUrl = `${base}/q/${row.shortCode}`
    const data = await this.generateQr(trackingUrl, {
      size: input.size,
      format: input.format,
    })
    return { data, format: input.format, shortCode: row.shortCode }
  }

  /**
   * Public — atomic click recording. The Next.js `/q/[shortCode]` route
   * handler calls this on every scan; we increment the counter and
   * return the destination URL so the route handler can 302-redirect.
   *
   * Archived QRs still resolve (the destination URL doesn't disappear)
   * but their click count is frozen — so an archived sticker that's
   * still on a wall doesn't keep inflating numbers indefinitely. If you
   * want the opposite policy (count archived too), drop the status
   * check below.
   */
  async recordClickAndResolve(shortCode: string) {
    const row = await this.db.query.qrCodes.findFirst({
      where: eq(qrCodes.shortCode, shortCode),
    })
    if (!row) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Unknown QR code',
      })
    }
    if (row.status === 'active') {
      await this.db
        .update(qrCodes)
        .set({ clickCount: sql`${qrCodes.clickCount} + 1` })
        .where(eq(qrCodes.id, row.id))
    }
    return { destinationUrl: row.destinationUrl, status: row.status }
  }

  // --- Private ---

  /**
   * Find every active survey in the workspace that doesn't yet have a
   * `qr_codes` row pointing at it, and create one default QR per survey.
   * Called from `listQrCodes` so owners arriving at /dashboard/qr see
   * their existing journeys/truforms immediately instead of an empty
   * "Create your first QR" CTA.
   *
   * Idempotent on retry — once a survey has a QR row, this is a no-op
   * for it. Errors during creation are swallowed and logged: a single
   * bad survey shouldn't block the whole list view.
   */
  private async backfillDefaultQrsForWorkspace(
    workspaceId: string,
    userId: string,
  ) {
    try {
      // Surveys in this workspace that have no matching qr_codes row.
      const missing = await this.db
        .select({
          id: surveys.id,
          template: surveys.template,
          name: surveys.name,
          locationId: surveys.locationId,
        })
        .from(surveys)
        .leftJoin(qrCodes, eq(qrCodes.targetId, surveys.id))
        .where(
          and(
            eq(surveys.workspaceId, workspaceId),
            eq(surveys.status, 'active'),
            isNull(surveys.archivedAt),
            isNull(qrCodes.id),
          ),
        )

      for (const s of missing) {
        try {
          await this.createQrCode(
            {
              workspaceId,
              targetType: s.template === 'deep' ? 'form' : 'journey',
              targetId: s.id,
              label: s.name,
              locationId: s.locationId ?? undefined,
            },
            userId,
          )
        } catch (err: any) {
          // Most likely a race (parallel list calls) or a transient
          // short-code collision after 5 retries — log and continue.
          this.logger.warn(
            `Backfill QR for survey ${s.id} skipped: ${err?.message ?? err}`,
          )
        }
      }
    } catch (err: any) {
      // Don't let backfill failure block the list response — the
      // existing QRs (if any) should still render.
      this.logger.error(
        `Backfill scan failed for workspace ${workspaceId}: ${err?.message ?? err}`,
      )
    }
  }

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
