import { Injectable, Inject, OnModuleInit } from '@nestjs/common'
import { TRPCError } from '@trpc/server'
import { eq, and, isNotNull } from 'drizzle-orm'
import type { Database } from '@rectangled/db'
import {
  connectorTypes,
  connectorInstances,
  members,
} from '@rectangled/db'
import { hasPermission } from '@rectangled/shared'
import type { Role } from '@rectangled/shared'

const SEED_CONNECTOR_TYPES = [
  {
    id: 'gbp',
    name: 'Google Business Profile',
    description:
      'Fetch and respond to Google reviews. Connect your GBP listing to manage your online reputation.',
    iconUrl: null,
    authType: 'oauth2',
    bindingLevel: 'location' as const,
    configSchema: {},
    isActive: true,
  },
  {
    id: 'zomato',
    name: 'Zomato',
    description:
      'Aggregate Zomato reviews and ratings for your F&B business locations.',
    iconUrl: null,
    authType: 'profile_url',
    bindingLevel: 'location' as const,
    configSchema: {},
    isActive: true,
  },
  {
    id: 'wapisnap',
    name: 'Wapisnap',
    description:
      'Connect your Wapisnap workspace for WhatsApp review requests, coupons, and nudges.',
    iconUrl: null,
    authType: 'api_key',
    bindingLevel: 'workspace' as const,
    configSchema: {},
    isActive: false, // Pending Wapisnap PRD
  },
  {
    id: 'email',
    name: 'Email Provider',
    description:
      'Connect your own SendGrid or Resend API for sending emails',
    iconUrl: null,
    authType: 'api_key',
    bindingLevel: 'workspace' as const,
    configSchema: { provider: 'string', fromEmail: 'string' },
    isActive: true,
  },
  {
    id: 'google_calendar',
    name: 'Google Calendar',
    description: 'Connect Google Calendar for appointment scheduling at your locations',
    iconUrl: null,
    authType: 'oauth2',
    bindingLevel: 'location' as const,
    configSchema: { calendarId: 'string' },
    isActive: true,
  },
  {
    id: 'instagram',
    name: 'Instagram Business',
    description:
      'Connect your Instagram Business account to share posts and stories directly from your dashboard',
    iconUrl: null,
    authType: 'oauth',
    bindingLevel: 'workspace' as const,
    configSchema: {},
    isActive: true,
  },
]

@Injectable()
export class ConnectorService implements OnModuleInit {
  constructor(@Inject('DATABASE') private readonly db: Database) {}

  async onModuleInit() {
    await this.seedTypes()
  }

  /**
   * Upsert connector types from seed data.
   */
  async seedTypes() {
    for (const seed of SEED_CONNECTOR_TYPES) {
      const existing = await this.db.query.connectorTypes.findFirst({
        where: eq(connectorTypes.id, seed.id),
      })
      if (!existing) {
        await this.db.insert(connectorTypes).values(seed)
      }
    }
  }

  /**
   * List all available connector types.
   */
  async listTypes() {
    return this.db.query.connectorTypes.findMany()
  }

  /**
   * List connector instances for a workspace (optionally filtered by location).
   */
  async listInstances(
    workspaceId: string,
    locationId: string | undefined,
    userId: string
  ) {
    await this.requireMembership(workspaceId, userId)

    const conditions = [eq(connectorInstances.workspaceId, workspaceId)]
    if (locationId) {
      conditions.push(eq(connectorInstances.locationId, locationId))
    }

    const instances = await this.db
      .select()
      .from(connectorInstances)
      .where(and(...conditions))

    // Join with connector types
    const types = await this.db.query.connectorTypes.findMany()
    const typeMap = new Map(types.map((t) => [t.id, t]))

    return instances.map((inst) => ({
      ...inst,
      // Strip credentials from response
      credentials: undefined,
      connectorType: typeMap.get(inst.connectorTypeId) ?? null,
    }))
  }

  /**
   * Connect a new connector instance.
   */
  async connect(
    input: {
      connectorTypeId: string
      workspaceId: string
      locationId?: string
      credentials?: Record<string, unknown>
      config?: Record<string, unknown>
    },
    userId: string
  ) {
    const membership = await this.requireMembership(
      input.workspaceId,
      userId
    )

    if (!hasPermission(membership.role as Role, 'connector:connect')) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to connect integrations',
      })
    }

    // Verify connector type exists
    const connType = await this.db.query.connectorTypes.findFirst({
      where: eq(connectorTypes.id, input.connectorTypeId),
    })
    if (!connType) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Connector type not found',
      })
    }

    const [instance] = await this.db
      .insert(connectorInstances)
      .values({
        connectorTypeId: input.connectorTypeId,
        workspaceId: input.workspaceId,
        locationId: input.locationId ?? null,
        credentials: input.credentials ?? {},
        config: input.config ?? {},
        status: 'pending',
      })
      .returning()

    return {
      ...instance,
      credentials: undefined,
      connectorType: connType,
    }
  }

  /**
   * Disconnect (delete) a connector instance.
   */
  async disconnect(instanceId: string, workspaceId: string, userId: string) {
    // Filter by both instanceId AND workspaceId to prevent IDOR
    const instance = await this.db.query.connectorInstances.findFirst({
      where: and(
        eq(connectorInstances.id, instanceId),
        eq(connectorInstances.workspaceId, workspaceId),
      ),
    })
    if (!instance) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Connector instance not found' })
    }

    const membership = await this.requireMembership(workspaceId, userId)

    if (!hasPermission(membership.role as Role, 'connector:disconnect')) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to disconnect integrations',
      })
    }

    await this.db
      .delete(connectorInstances)
      .where(and(
        eq(connectorInstances.id, instanceId),
        eq(connectorInstances.workspaceId, workspaceId),
      ))

    return { success: true }
  }

  /**
   * Update connector config.
   */
  async updateConfig(
    instanceId: string,
    workspaceId: string,
    config: Record<string, unknown>,
    userId: string
  ) {
    // Filter by both instanceId AND workspaceId to prevent IDOR
    const instance = await this.db.query.connectorInstances.findFirst({
      where: and(
        eq(connectorInstances.id, instanceId),
        eq(connectorInstances.workspaceId, workspaceId),
      ),
    })
    if (!instance) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Connector instance not found' })
    }

    const membership = await this.requireMembership(workspaceId, userId)

    if (!hasPermission(membership.role as Role, 'connector:configure')) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to configure integrations',
      })
    }

    const [updated] = await this.db
      .update(connectorInstances)
      .set({
        config: { ...instance.config, ...config },
        updatedAt: new Date(),
      })
      .where(and(
        eq(connectorInstances.id, instanceId),
        eq(connectorInstances.workspaceId, workspaceId),
      ))
      .returning()

    return { ...updated, credentials: undefined }
  }

  /**
   * Update connector status (internal, used by adapters).
   */
  async updateStatus(
    instanceId: string,
    status: 'connected' | 'disconnected' | 'error' | 'pending',
    errorMessage?: string
  ) {
    const [updated] = await this.db
      .update(connectorInstances)
      .set({
        status,
        errorMessage: errorMessage ?? null,
        lastHealthCheck: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(connectorInstances.id, instanceId))
      .returning()

    return updated
  }

  /**
   * Update connector config (internal, no permission check — used by sync logic).
   */
  async updateConfigInternal(
    instanceId: string,
    config: Record<string, unknown>
  ) {
    const instance = await this.db.query.connectorInstances.findFirst({
      where: eq(connectorInstances.id, instanceId),
    })
    if (!instance) return null

    const [updated] = await this.db
      .update(connectorInstances)
      .set({
        config: { ...(instance.config as Record<string, unknown>), ...config },
        updatedAt: new Date(),
      })
      .where(eq(connectorInstances.id, instanceId))
      .returning()

    return updated
  }

  /**
   * Update connector credentials (internal, used by adapters).
   */
  async updateCredentials(
    instanceId: string,
    credentials: Record<string, unknown>
  ) {
    const [updated] = await this.db
      .update(connectorInstances)
      .set({
        credentials,
        updatedAt: new Date(),
      })
      .where(eq(connectorInstances.id, instanceId))
      .returning()

    return updated
  }

  /**
   * Get an instance by ID (public, strips credentials).
   */
  async getInstanceById(instanceId: string, userId: string) {
    const instance = await this.getInstanceByIdInternal(instanceId)
    await this.requireMembership(instance.workspaceId, userId)

    const connType = await this.db.query.connectorTypes.findFirst({
      where: eq(connectorTypes.id, instance.connectorTypeId),
    })

    return {
      ...instance,
      credentials: undefined,
      connectorType: connType ?? null,
    }
  }

  /**
   * Get an instance by ID (internal, includes credentials).
   */
  async getInstanceByIdInternal(instanceId: string) {
    const instance = await this.db.query.connectorInstances.findFirst({
      where: eq(connectorInstances.id, instanceId),
    })

    if (!instance) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Connector instance not found',
      })
    }

    return instance
  }

  private async requireMembership(workspaceId: string, userId: string) {
    const membership = await this.db.query.members.findFirst({
      where: and(
        eq(members.workspaceId, workspaceId),
        eq(members.userId, userId),
        isNotNull(members.acceptedAt)
      ),
    })

    if (!membership) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You are not a member of this workspace',
      })
    }

    return membership
  }
}
