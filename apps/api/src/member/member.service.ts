import { Injectable, Inject } from '@nestjs/common'
import { TRPCError } from '@trpc/server'
import { eq, and, count } from 'drizzle-orm'
import type { Database } from '@rectangled/db'
import { members, users } from '@rectangled/db'
import { hasPermission, type Role } from '@rectangled/shared'

@Injectable()
export class MemberService {
  constructor(@Inject('DATABASE') private readonly db: Database) {}

  /**
   * List all members for a workspace, with joined user data.
   */
  async list(workspaceId: string, userId: string) {
    await this.requireMembership(workspaceId, userId)

    const workspaceMembers = await this.db.query.members.findMany({
      where: eq(members.workspaceId, workspaceId),
    })

    const result = await Promise.all(
      workspaceMembers.map(async (member) => {
        const user = await this.db.query.users.findFirst({
          where: eq(users.id, member.userId),
        })
        return {
          id: member.id,
          userId: member.userId,
          workspaceId: member.workspaceId,
          role: member.role,
          locationIds: member.locationIds,
          invitedBy: member.invitedBy,
          acceptedAt: member.acceptedAt,
          createdAt: member.createdAt,
          user: user
            ? {
                name: user.name,
                email: user.email,
                avatarUrl: user.avatarUrl,
              }
            : null,
        }
      }),
    )

    return result
  }

  /**
   * Invite a new member to the workspace.
   * For Sprint 1, auto-accepts since there is no email sending.
   */
  async invite(
    workspaceId: string,
    email: string,
    role: string,
    locationIds: string[] | undefined,
    invitedByUserId: string,
  ) {
    const callerMember = await this.requireMembership(workspaceId, invitedByUserId)

    if (!hasPermission(callerMember.role as Role, 'member:invite')) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to invite members',
      })
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Find or create user by email
    let user = await this.db.query.users.findFirst({
      where: eq(users.email, normalizedEmail),
    })

    if (!user) {
      const [newUser] = await this.db
        .insert(users)
        .values({
          email: normalizedEmail,
          name: normalizedEmail.split('@')[0],
          passwordHash: null,
          emailVerified: false,
        })
        .returning()
      user = newUser
    }

    // Check if already a member of this workspace
    const existingMember = await this.db.query.members.findFirst({
      where: and(eq(members.userId, user.id), eq(members.workspaceId, workspaceId)),
    })

    if (existingMember) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'User is already a member of this workspace',
      })
    }

    // Create member (auto-accept for Sprint 1)
    const [member] = await this.db
      .insert(members)
      .values({
        userId: user.id,
        workspaceId,
        role: role as 'owner' | 'manager' | 'staff' | 'viewer',
        locationIds: locationIds ?? [],
        invitedBy: invitedByUserId,
        acceptedAt: new Date(),
      })
      .returning()

    return {
      ...member,
      user: {
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
      },
    }
  }

  /**
   * Update a member's role. Cannot promote to owner or demote the last owner.
   */
  async updateRole(memberId: string, workspaceId: string, role: string, userId: string) {
    // Filter by both memberId AND workspaceId to prevent IDOR
    const member = await this.db.query.members.findFirst({
      where: and(eq(members.id, memberId), eq(members.workspaceId, workspaceId)),
    })

    if (!member) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found' })
    }

    const callerMember = await this.requireMembership(workspaceId, userId)

    if (!hasPermission(callerMember.role as Role, 'member:update_role')) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to update member roles',
      })
    }

    if (role === 'owner') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Cannot promote a member to owner via role update',
      })
    }

    // If this member is currently an owner, ensure they're not the last one
    if (member.role === 'owner') {
      const [ownerCount] = await this.db
        .select({ value: count() })
        .from(members)
        .where(and(eq(members.workspaceId, member.workspaceId), eq(members.role, 'owner')))

      if (ownerCount.value <= 1) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot change the role of the last owner',
        })
      }
    }

    const [updated] = await this.db
      .update(members)
      .set({ role: role as 'owner' | 'manager' | 'staff' | 'viewer' })
      .where(eq(members.id, memberId))
      .returning()

    return updated
  }

  /**
   * Update a member's assigned location IDs.
   */
  async updateLocations(memberId: string, workspaceId: string, locationIds: string[], userId: string) {
    // Filter by both memberId AND workspaceId to prevent IDOR
    const member = await this.db.query.members.findFirst({
      where: and(eq(members.id, memberId), eq(members.workspaceId, workspaceId)),
    })

    if (!member) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found' })
    }

    const callerMember = await this.requireMembership(workspaceId, userId)

    if (!hasPermission(callerMember.role as Role, 'member:update_role')) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to update member locations',
      })
    }

    const [updated] = await this.db
      .update(members)
      .set({ locationIds })
      .where(eq(members.id, memberId))
      .returning()

    return updated
  }

  /**
   * Remove a member from the workspace. Cannot remove the last owner.
   */
  async remove(memberId: string, workspaceId: string, userId: string) {
    // Filter by both memberId AND workspaceId to prevent IDOR
    const member = await this.db.query.members.findFirst({
      where: and(eq(members.id, memberId), eq(members.workspaceId, workspaceId)),
    })

    if (!member) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Member not found' })
    }

    const callerMember = await this.requireMembership(workspaceId, userId)

    if (!hasPermission(callerMember.role as Role, 'member:remove')) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to remove members',
      })
    }

    // Cannot remove the last owner
    if (member.role === 'owner') {
      const [ownerCount] = await this.db
        .select({ value: count() })
        .from(members)
        .where(and(eq(members.workspaceId, member.workspaceId), eq(members.role, 'owner')))

      if (ownerCount.value <= 1) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot remove the last owner of the workspace',
        })
      }
    }

    await this.db.delete(members).where(eq(members.id, memberId))

    return { success: true }
  }

  /**
   * Verify the user is an accepted member of the workspace and return their membership.
   */
  private async requireMembership(workspaceId: string, userId: string) {
    const member = await this.db.query.members.findFirst({
      where: and(eq(members.userId, userId), eq(members.workspaceId, workspaceId)),
    })

    if (!member || !member.acceptedAt) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You are not a member of this workspace',
      })
    }

    return member
  }
}
