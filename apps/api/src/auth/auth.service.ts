import { Injectable, Inject, Logger } from '@nestjs/common'
import { TRPCError } from '@trpc/server'
import * as bcrypt from 'bcryptjs'
import * as jwt from 'jsonwebtoken'
import { eq, isNotNull } from 'drizzle-orm'
import type { Database } from '@rectangled/db'
import { users, members, workspaces, organizations, organizationMembers, refreshTokens, passwordResetTokens } from '@rectangled/db'
import type { JwtPayload, AuthResponse, MeResponse } from '@rectangled/shared'

@Injectable()
export class AuthService {
  private readonly jwtSecret: string
  private readonly logger = new Logger(AuthService.name)
  private readonly accessTokenExpiry = 7 * 24 * 60 * 60 // 7 days
  private readonly refreshTokenExpiry = 30 * 24 * 60 * 60 // 30 days in seconds

  constructor(@Inject('DATABASE') private readonly db: Database) {
    const secret = process.env.JWT_SECRET
    if (!secret) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('FATAL: JWT_SECRET environment variable is required in production')
      }
      console.warn('⚠️  JWT_SECRET not set — using insecure default for development only')
      this.jwtSecret = 'dev-only-insecure-jwt-secret-not-for-production-use'
    } else if (secret.length < 32 && process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: JWT_SECRET must be at least 32 characters in production')
    } else {
      this.jwtSecret = secret
    }
  }

  async register(name: string, email: string, password: string): Promise<AuthResponse> {
    const existing = await this.db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase().trim()),
    })
    if (existing) {
      this.logger.warn(`AUTH: Registration attempt with existing email ${email}`)
      throw new TRPCError({ code: 'CONFLICT', message: 'Email already registered' })
    }

    const passwordHash = await bcrypt.hash(password, 12)
    const [user] = await this.db
      .insert(users)
      .values({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        passwordHash,
        emailVerified: false,
      })
      .returning()

    // Phase 1: every workspace lives under an organization. Create a default
    // direct-mode org first, then the workspace, then memberships at both
    // layers. Direct-mode keeps the legacy single-business UX — the org
    // layer is invisible to the user until they upgrade to multi_location
    // or agency.
    const baseSlug = this.generateSlug(name)
    const { workspace } = await this.createOrganizationAndWorkspace({
      userId: user.id,
      workspaceName: `${name.trim()}'s Business`,
      workspaceSlug: baseSlug,
    })

    this.logger.log(`AUTH: New registration for ${email}`)
    const tokens = await this.generateTokens(user.id, user.email)
    const { passwordHash: _, ...safeUser } = user
    return { user: safeUser as any, ...tokens }
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const user = await this.db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase().trim()),
    })

    if (!user || !user.passwordHash) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid email or password' })
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash)
    if (!validPassword) {
      this.logger.warn(`AUTH: Login failed for ${email} — invalid password`)
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid email or password' })
    }

    await this.db
      .update(users)
      .set({ lastLoginAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, user.id))

    this.logger.log(`AUTH: Login success for ${email}`)
    const tokens = await this.generateTokens(user.id, user.email)
    const { passwordHash: _, ...safeUser } = user
    return { user: safeUser as any, ...tokens }
  }

  async refresh(oldRefreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    let payload: JwtPayload
    try {
      payload = jwt.verify(oldRefreshToken, this.jwtSecret) as JwtPayload
    } catch {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid refresh token' })
    }

    const storedTokens = await this.db.query.refreshTokens.findMany({
      where: eq(refreshTokens.userId, payload.sub),
    })

    let validToken = false
    for (const stored of storedTokens) {
      if (!stored.revokedAt && stored.expiresAt > new Date()) {
        const matches = await bcrypt.compare(oldRefreshToken, stored.tokenHash)
        if (matches) {
          await this.db
            .update(refreshTokens)
            .set({ revokedAt: new Date() })
            .where(eq(refreshTokens.id, stored.id))
          validToken = true
          break
        }
      }
    }

    if (!validToken) {
      this.logger.warn(`AUTH: Refresh token invalid/expired for user ${payload.sub}`)
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Refresh token expired or revoked' })
    }

    this.logger.log(`AUTH: Token refreshed for user ${payload.sub}`)
    return this.generateTokens(payload.sub, payload.email)
  }

  async me(userId: string): Promise<MeResponse> {
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, userId),
    })

    if (!user) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' })
    }

    const userMembers = await this.db.query.members.findMany({
      where: eq(members.userId, userId),
    })

    const memberWorkspaces = await Promise.all(
      userMembers
        .filter((m) => m.acceptedAt !== null)
        .map(async (m) => {
          const ws = await this.db.query.workspaces.findFirst({
            where: eq(workspaces.id, m.workspaceId),
          })
          return {
            workspaceId: m.workspaceId,
            workspaceName: ws?.name || '',
            workspaceSlug: ws?.slug || '',
            workspaceLogoUrl: ws?.logoUrl ?? null,
            role: m.role,
          }
        }),
    )

    const { passwordHash: _, ...safeUser } = user
    return {
      user: safeUser as any,
      memberships: memberWorkspaces as any,
    }
  }

  async googleCallback(code: string, redirectUrl?: string): Promise<AuthResponse> {
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    const redirect =
      redirectUrl ||
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/google/callback`

    if (!clientId || !clientSecret) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Google OAuth not configured' })
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirect,
        grant_type: 'authorization_code',
      }),
    })

    const tokenData = (await tokenRes.json()) as { access_token?: string }
    if (!tokenData.access_token) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Failed to exchange Google auth code' })
    }

    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })
    const profile = (await profileRes.json()) as {
      id: string
      email: string
      name?: string
      picture?: string
    }

    if (!profile.email) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Could not get email from Google' })
    }

    // Upsert user
    let user = await this.db.query.users.findFirst({
      where: eq(users.googleId, profile.id),
    })

    if (!user) {
      user = await this.db.query.users.findFirst({
        where: eq(users.email, profile.email.toLowerCase()),
      })

      if (user) {
        await this.db
          .update(users)
          .set({
            googleId: profile.id,
            avatarUrl: user.avatarUrl || profile.picture,
            emailVerified: true,
            updatedAt: new Date(),
          })
          .where(eq(users.id, user.id))
      } else {
        const [newUser] = await this.db
          .insert(users)
          .values({
            email: profile.email.toLowerCase(),
            name: profile.name || profile.email.split('@')[0],
            googleId: profile.id,
            avatarUrl: profile.picture,
            emailVerified: true,
          })
          .returning()
        user = newUser

        const baseSlug = this.generateSlug(user.name)
        await this.createOrganizationAndWorkspace({
          userId: user.id,
          workspaceName: `${user.name}'s Business`,
          workspaceSlug: baseSlug,
        })
      }
    } else {
      await this.db
        .update(users)
        .set({ lastLoginAt: new Date(), updatedAt: new Date() })
        .where(eq(users.id, user.id))
    }

    const tokens = await this.generateTokens(user.id, user.email)
    const { passwordHash: _, ...safeUser } = user
    return { user: safeUser as any, ...tokens }
  }

  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await this.db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase().trim()),
    })

    // Always return success to prevent email enumeration
    if (!user) {
      this.logger.warn(`AUTH: Password reset requested for unknown email ${email}`)
      return { message: 'If an account exists, a reset link has been sent.' }
    }

    // Generate a secure random token
    const crypto = await import('crypto')
    const token = crypto.randomBytes(32).toString('hex')
    const tokenHash = await bcrypt.hash(token, 10)

    // Store hashed token with 1-hour expiry
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 1)

    await this.db.insert(passwordResetTokens).values({
      userId: user.id,
      tokenHash,
      expiresAt,
    })

    // Send email (fire and forget)
    // The actual email sending depends on EmailService being injected
    const resetLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/reset-password?token=${token}&email=${encodeURIComponent(user.email)}`
    this.logger.log(`AUTH: Password reset token generated for ${email}`)

    // Note: Email service would send the link
    // For now just log it in development
    if (process.env.NODE_ENV !== 'production') {
      this.logger.debug(`DEV: Reset link — ${resetLink}`)
    }

    return { message: 'If an account exists, a reset link has been sent.' }
  }

  async resetPassword(email: string, token: string, newPassword: string): Promise<{ message: string }> {
    const user = await this.db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase().trim()),
    })

    if (!user) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid or expired reset token' })
    }

    // Find valid token
    const storedTokens = await this.db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, user.id))

    let validToken = false
    let tokenId: string | null = null

    for (const stored of storedTokens) {
      if (stored.usedAt || stored.expiresAt < new Date()) continue
      const matches = await bcrypt.compare(token, stored.tokenHash)
      if (matches) {
        validToken = true
        tokenId = stored.id
        break
      }
    }

    if (!validToken || !tokenId) {
      this.logger.warn(`AUTH: Invalid password reset attempt for ${email}`)
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid or expired reset token' })
    }

    // Update password
    const passwordHash = await bcrypt.hash(newPassword, 12)
    await this.db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, user.id))

    // Mark token as used
    await this.db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, tokenId))

    // Revoke all refresh tokens for security
    await this.db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.userId, user.id))

    this.logger.log(`AUTH: Password reset completed for ${email}`)
    return { message: 'Password has been reset successfully. Please log in with your new password.' }
  }

  async requestEmailVerification(userId: string): Promise<{ message: string }> {
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, userId),
    })
    if (!user) throw new TRPCError({ code: 'NOT_FOUND', message: 'User not found' })
    if (user.emailVerified) return { message: 'Email is already verified.' }

    this.logger.log(`AUTH: Email verification requested for ${user.email}`)
    return { message: 'Verification email sent.' }
  }

  getGoogleAuthUrl(redirectUrl?: string): string {
    const clientId = process.env.GOOGLE_CLIENT_ID
    if (!clientId) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Google OAuth not configured' })
    }

    const redirect =
      redirectUrl ||
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/google/callback`
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirect,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'consent',
    })

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  }

  private async generateTokens(userId: string, email: string) {
    const accessToken = jwt.sign({ sub: userId, email } as JwtPayload, this.jwtSecret, {
      expiresIn: this.accessTokenExpiry,
    })

    const refreshToken = jwt.sign({ sub: userId, email } as JwtPayload, this.jwtSecret, {
      expiresIn: this.refreshTokenExpiry,
    })

    const tokenHash = await bcrypt.hash(refreshToken, 10)
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30)

    await this.db.insert(refreshTokens).values({
      userId,
      tokenHash,
      expiresAt,
    })

    return { accessToken, refreshToken }
  }

  private generateSlug(name: string): string {
    const base = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    const suffix = Math.random().toString(36).slice(2, 6)
    return `${base}-${suffix}`
  }

  /**
   * Phase 1 — atomic org + workspace + memberships creation.
   *
   * Every workspace lives under an organization. For a fresh user
   * registration we always create a 'direct' org and treat the workspace as
   * its sole child. The user is org_owner at the org layer AND owner at
   * the workspace layer; the two membership tables coexist (Phase 1
   * intentionally — Phase 2 will start migrating reads onto the org layer).
   *
   * The function is non-transactional because the underlying postgres-js
   * driver in this codebase doesn't expose easy transactions on the
   * Drizzle wrapper. A failure halfway through could leave a stranded
   * org row; that's a known minor risk and we accept it for now (Phase 4
   * event bus will move this to a saga).
   */
  protected async createOrganizationAndWorkspace(input: {
    userId: string
    workspaceName: string
    workspaceSlug: string
  }): Promise<{
    organization: typeof organizations.$inferSelect
    workspace: typeof workspaces.$inferSelect
  }> {
    // Org slug = workspace slug + '-org', truncated to fit the 100-char column.
    const orgSlug = `${input.workspaceSlug}-org`.slice(0, 100)
    const [organization] = await this.db
      .insert(organizations)
      .values({
        name: input.workspaceName,
        slug: orgSlug,
        type: 'direct',
        ownerUserId: input.userId,
      })
      .returning()

    const [workspace] = await this.db
      .insert(workspaces)
      .values({
        organizationId: organization.id,
        name: input.workspaceName,
        slug: input.workspaceSlug,
        settings: {
          defaultTimezone: 'Asia/Kolkata',
          aiAutoRespond: false,
          reviewResponseDelay: { min: 1, max: 3 },
          frequencyCap: { maxSurveys: 2, windowDays: 60 },
          customerRateCap: {
            maxMessagesPerDay: 3,
            maxCouponsPerMonth: 1,
            maxActionsPerWeek: 10,
          },
        },
      })
      .returning()

    // Workspace-level membership (legacy + still required for existing flows).
    await this.db.insert(members).values({
      userId: input.userId,
      workspaceId: workspace.id,
      role: 'owner',
      acceptedAt: new Date(),
    })

    // Org-level membership (Phase 1 layer).
    await this.db.insert(organizationMembers).values({
      organizationId: organization.id,
      userId: input.userId,
      role: 'org_owner',
      acceptedAt: new Date(),
    })

    return { organization, workspace }
  }
}
