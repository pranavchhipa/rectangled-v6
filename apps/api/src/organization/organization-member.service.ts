import { Injectable, Inject, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { TRPCError } from '@trpc/server'
import jwt from 'jsonwebtoken'
import { eq, and, isNull } from 'drizzle-orm'
import type { Database } from '@rectangled/db'
import {
  organizationMembers,
  organizations,
  users,
} from '@rectangled/db'
import type { OrgRole } from '@rectangled/shared'
import { requireOrgAccess } from '../auth/permissions'

const INVITE_TOKEN_TYPE = 'org_invite' as const
const INVITE_TOKEN_TTL_DAYS = 7

interface InviteTokenPayload {
  memberId: string
  type: typeof INVITE_TOKEN_TYPE
}

@Injectable()
export class OrganizationMemberService {
  private readonly logger = new Logger(OrganizationMemberService.name)
  private readonly jwtSecret: string

  constructor(
    @Inject('DATABASE') private readonly db: Database,
    private readonly config: ConfigService,
  ) {
    this.jwtSecret = this.config.get<string>('JWT_SECRET') ?? ''
    if (!this.jwtSecret) {
      this.logger.warn('JWT_SECRET not set — org invitations will not work')
    }
  }

  /**
   * List all members (accepted + pending) of an organization. Includes
   * basic user info (name, email) so the dashboard table doesn't need a
   * second round-trip.
   */
  async list(organizationId: string, userId: string) {
    await requireOrgAccess(this.db, userId, organizationId)

    const rows = await this.db
      .select({
        id: organizationMembers.id,
        organizationId: organizationMembers.organizationId,
        userId: organizationMembers.userId,
        role: organizationMembers.role,
        workspaceIds: organizationMembers.workspaceIds,
        acceptedAt: organizationMembers.acceptedAt,
        invitedBy: organizationMembers.invitedBy,
        createdAt: organizationMembers.createdAt,
        userName: users.name,
        userEmail: users.email,
      })
      .from(organizationMembers)
      .leftJoin(users, eq(users.id, organizationMembers.userId))
      .where(eq(organizationMembers.organizationId, organizationId))
      .orderBy(organizationMembers.createdAt)

    return rows
  }

  /**
   * Invite a user (by email) to join the organization. If a user with
   * that email already exists, a pending org_member row is created and
   * an invite JWT is returned. If no user exists yet, we still create
   * a placeholder user row so we have a userId to link.
   *
   * Returns the JWT — the caller (router or email service) sends it to
   * the invitee.
   */
  async invite(
    input: {
      organizationId: string
      email: string
      role: OrgRole
      workspaceIds?: string[]
    },
    inviterUserId: string,
  ) {
    await requireOrgAccess(this.db, inviterUserId, input.organizationId, {
      roles: ['org_owner', 'org_admin'],
    })

    const email = input.email.toLowerCase().trim()

    // Find or create the invitee user.
    let invitee = await this.db.query.users.findFirst({ where: eq(users.email, email) })
    if (!invitee) {
      const [newUser] = await this.db
        .insert(users)
        .values({
          email,
          name: email.split('@')[0],
          emailVerified: false,
        })
        .returning()
      invitee = newUser
    }

    // Refuse if they're already a member of this org.
    const existing = await this.db.query.organizationMembers.findFirst({
      where: and(
        eq(organizationMembers.organizationId, input.organizationId),
        eq(organizationMembers.userId, invitee.id),
      ),
    })
    if (existing && existing.acceptedAt) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'User is already a member of this organization',
      })
    }

    // Upsert the pending row.
    const [member] = existing
      ? await this.db
          .update(organizationMembers)
          .set({
            role: input.role,
            workspaceIds: input.workspaceIds ?? null,
            invitedBy: inviterUserId,
          })
          .where(eq(organizationMembers.id, existing.id))
          .returning()
      : await this.db
          .insert(organizationMembers)
          .values({
            organizationId: input.organizationId,
            userId: invitee.id,
            role: input.role,
            workspaceIds: input.workspaceIds ?? null,
            invitedBy: inviterUserId,
          })
          .returning()

    const invitationToken = this.signInviteToken(member.id)
    return { invitationToken, memberId: member.id, inviteeEmail: email }
  }

  /**
   * Consume an invite token. Sets acceptedAt on the membership.
   * Verifies the token's signature + expiry + type.
   */
  async acceptInvite(token: string, userId: string) {
    const payload = this.verifyInviteToken(token)

    const member = await this.db.query.organizationMembers.findFirst({
      where: eq(organizationMembers.id, payload.memberId),
    })
    if (!member) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Invitation not found' })
    }
    if (member.userId !== userId) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'This invitation belongs to another account',
      })
    }
    if (member.acceptedAt) {
      // Idempotent: already accepted is fine, just return the org id.
      return { organizationId: member.organizationId, alreadyAccepted: true as const }
    }

    await this.db
      .update(organizationMembers)
      .set({ acceptedAt: new Date() })
      .where(eq(organizationMembers.id, member.id))

    return { organizationId: member.organizationId, alreadyAccepted: false as const }
  }

  async updateRole(
    input: {
      organizationId: string
      memberId: string
      role: OrgRole
      workspaceIds?: string[] | null
    },
    actorUserId: string,
  ) {
    await requireOrgAccess(this.db, actorUserId, input.organizationId, {
      roles: ['org_owner'],
    })

    const member = await this.db.query.organizationMembers.findFirst({
      where: and(
        eq(organizationMembers.id, input.memberId),
        eq(organizationMembers.organizationId, input.organizationId),
      ),
    })
    if (!member) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found' })
    }

    // Refuse to demote the last owner.
    if (member.role === 'org_owner' && input.role !== 'org_owner') {
      const [{ ownerCount }] = await this.db
        .select({
          ownerCount: this.db.$count(
            organizationMembers,
            and(
              eq(organizationMembers.organizationId, input.organizationId),
              eq(organizationMembers.role, 'org_owner'),
            ),
          ),
        })
        .from(organizationMembers)
        .limit(1)
      if (ownerCount <= 1) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot demote the last org_owner',
        })
      }
    }

    const updates: Record<string, unknown> = { role: input.role }
    if (input.workspaceIds !== undefined) {
      updates.workspaceIds = input.workspaceIds
    }

    const [updated] = await this.db
      .update(organizationMembers)
      .set(updates)
      .where(eq(organizationMembers.id, input.memberId))
      .returning()
    return updated
  }

  async remove(input: { organizationId: string; memberId: string }, actorUserId: string) {
    await requireOrgAccess(this.db, actorUserId, input.organizationId, {
      roles: ['org_owner', 'org_admin'],
    })

    const member = await this.db.query.organizationMembers.findFirst({
      where: and(
        eq(organizationMembers.id, input.memberId),
        eq(organizationMembers.organizationId, input.organizationId),
      ),
    })
    if (!member) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found' })
    }
    if (member.role === 'org_owner') {
      // Don't let admins remove owners; org_owner-only.
      const [actor] = await this.db
        .select()
        .from(organizationMembers)
        .where(
          and(
            eq(organizationMembers.organizationId, input.organizationId),
            eq(organizationMembers.userId, actorUserId),
          ),
        )
      if (actor?.role !== 'org_owner') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only org_owner can remove another org_owner',
        })
      }
    }

    await this.db.delete(organizationMembers).where(eq(organizationMembers.id, input.memberId))
    return { success: true as const }
  }

  async assignToWorkspaces(
    input: { organizationId: string; memberId: string; workspaceIds: string[] },
    actorUserId: string,
  ) {
    await requireOrgAccess(this.db, actorUserId, input.organizationId, {
      roles: ['org_owner', 'org_admin'],
    })

    const [updated] = await this.db
      .update(organizationMembers)
      .set({ workspaceIds: input.workspaceIds })
      .where(
        and(
          eq(organizationMembers.id, input.memberId),
          eq(organizationMembers.organizationId, input.organizationId),
        ),
      )
      .returning()
    if (!updated) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found' })
    }
    return updated
  }

  // ─── Token plumbing ───────────────────────────────────

  private signInviteToken(memberId: string): string {
    const payload: InviteTokenPayload = { memberId, type: INVITE_TOKEN_TYPE }
    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: `${INVITE_TOKEN_TTL_DAYS}d`,
    })
  }

  private verifyInviteToken(token: string): InviteTokenPayload {
    let decoded: any
    try {
      decoded = jwt.verify(token, this.jwtSecret)
    } catch {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Invitation has expired or is invalid',
      })
    }
    if (decoded?.type !== INVITE_TOKEN_TYPE || typeof decoded?.memberId !== 'string') {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid invitation token' })
    }
    return decoded as InviteTokenPayload
  }
}
