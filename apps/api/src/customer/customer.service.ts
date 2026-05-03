import { Injectable, Inject } from '@nestjs/common'
import { TRPCError } from '@trpc/server'
import { eq, and, or, like, sql, desc, isNotNull } from 'drizzle-orm'
import type { Database } from '@rectangled/db'
import { customers, members, reviews, surveyResponses } from '@rectangled/db'
import { hasPermission } from '@rectangled/shared'
import type { Role } from '@rectangled/shared'

@Injectable()
export class CustomerService {
  constructor(@Inject('DATABASE') private readonly db: Database) {}

  async list(
    input: {
      workspaceId: string
      search?: string
      tags?: string[]
      // Hotfix-5 — narrow the customer directory to people who've
      // submitted a response at this specific location. Customer rows
      // don't carry a location_id directly; we resolve via a subquery
      // on survey_responses.
      locationId?: string
      page?: number
      limit?: number
    },
    userId: string
  ) {
    const membership = await this.requireMembership(
      input.workspaceId,
      userId
    )

    if (!hasPermission(membership.role as Role, 'customer:view')) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to view customers',
      })
    }

    const page = input.page ?? 1
    const limit = Math.min(input.limit ?? 20, 100)
    const offset = (page - 1) * limit

    const conditions: ReturnType<typeof eq>[] = [
      eq(customers.workspaceId, input.workspaceId),
    ]

    if (input.search) {
      conditions.push(
        or(
          like(customers.name, `%${input.search}%`),
          like(customers.email, `%${input.search}%`),
          like(customers.phone, `%${input.search}%`)
        )!
      )
    }

    if (input.tags && input.tags.length > 0) {
      conditions.push(
        sql`${customers.tags} @> ${JSON.stringify(input.tags)}::jsonb`
      )
    }

    // Hotfix-5 — restrict to customers who have at least one
    // survey_response with this locationId. Subquery is cheap (indexed
    // on customer_id + location_id) and keeps the customers query
    // shape unchanged for non-filtered case.
    if (input.locationId) {
      conditions.push(
        sql`${customers.id} IN (
          SELECT DISTINCT customer_id FROM ${surveyResponses}
          WHERE customer_id IS NOT NULL
            AND workspace_id = ${input.workspaceId}
            AND location_id = ${input.locationId}
        )`
      )
    }

    const where = and(...conditions)

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(customers)
        .where(where)
        .orderBy(desc(customers.lastSeenAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(customers)
        .where(where),
    ])

    return {
      data,
      total: countResult[0]?.count ?? 0,
      page,
      limit,
      totalPages: Math.ceil((countResult[0]?.count ?? 0) / limit),
    }
  }

  async getById(customerId: string, userId: string) {
    const customer = await this.db.query.customers.findFirst({
      where: eq(customers.id, customerId),
    })

    if (!customer) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Customer not found',
      })
    }

    await this.requireMembership(customer.workspaceId, userId)

    return customer
  }

  async create(
    input: {
      workspaceId: string
      name: string
      email?: string
      phone?: string
      tags?: string[]
      metadata?: Record<string, unknown>
    },
    userId: string
  ) {
    const membership = await this.requireMembership(
      input.workspaceId,
      userId
    )

    if (!hasPermission(membership.role as Role, 'customer:create')) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to create customers',
      })
    }

    const [customer] = await this.db
      .insert(customers)
      .values({
        workspaceId: input.workspaceId,
        name: input.name,
        email: input.email || null,
        phone: input.phone || null,
        tags: input.tags ?? [],
        metadata: input.metadata ?? {},
      })
      .returning()

    return customer
  }

  async update(
    input: {
      customerId: string
      name?: string
      email?: string
      phone?: string
      tags?: string[]
      metadata?: Record<string, unknown>
    },
    userId: string
  ) {
    const customer = await this.db.query.customers.findFirst({
      where: eq(customers.id, input.customerId),
    })

    if (!customer) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Customer not found',
      })
    }

    const membership = await this.requireMembership(
      customer.workspaceId,
      userId
    )

    if (!hasPermission(membership.role as Role, 'customer:update')) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to update customers',
      })
    }

    const updateData: Record<string, unknown> = {}
    if (input.name !== undefined) updateData.name = input.name
    if (input.email !== undefined) updateData.email = input.email || null
    if (input.phone !== undefined) updateData.phone = input.phone || null
    if (input.tags !== undefined) updateData.tags = input.tags
    if (input.metadata !== undefined) updateData.metadata = input.metadata

    const [updated] = await this.db
      .update(customers)
      .set(updateData)
      .where(eq(customers.id, input.customerId))
      .returning()

    return updated
  }

  async delete(customerId: string, userId: string) {
    const customer = await this.db.query.customers.findFirst({
      where: eq(customers.id, customerId),
    })

    if (!customer) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Customer not found',
      })
    }

    const membership = await this.requireMembership(
      customer.workspaceId,
      userId
    )

    if (!hasPermission(membership.role as Role, 'customer:delete')) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to delete customers',
      })
    }

    await this.db.delete(customers).where(eq(customers.id, customerId))

    return { success: true }
  }

  async getReviews(
    input: { customerId: string; page?: number; limit?: number },
    userId: string
  ) {
    const customer = await this.db.query.customers.findFirst({
      where: eq(customers.id, input.customerId),
    })

    if (!customer) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Customer not found',
      })
    }

    await this.requireMembership(customer.workspaceId, userId)

    const page = input.page ?? 1
    const limit = Math.min(input.limit ?? 20, 100)
    const offset = (page - 1) * limit

    // Match reviews by customerId FK or by reviewer name
    const conditions = [
      eq(reviews.workspaceId, customer.workspaceId),
      or(
        eq(reviews.customerId, customer.id),
        customer.name
          ? like(reviews.reviewerName, `%${customer.name}%`)
          : sql`false`
      )!,
    ]

    const where = and(...conditions)

    const [data, countResult] = await Promise.all([
      this.db
        .select()
        .from(reviews)
        .where(where)
        .orderBy(desc(reviews.reviewedAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(reviews)
        .where(where),
    ])

    return {
      data,
      total: countResult[0]?.count ?? 0,
      page,
      limit,
      totalPages: Math.ceil((countResult[0]?.count ?? 0) / limit),
    }
  }

  async bulkCreate(
    input: { workspaceId: string; customers: Array<{ name: string; email?: string; phone?: string; tags?: string[] }> },
    userId: string
  ) {
    const membership = await this.requireMembership(input.workspaceId, userId)

    if (!hasPermission(membership.role as Role, 'customer:create')) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'You do not have permission to create customers',
      })
    }

    let created = 0
    let skipped = 0
    const errors: string[] = []

    for (const cust of input.customers) {
      try {
        // Check for duplicates by email or phone
        if (cust.email && cust.email !== '') {
          const existing = await this.db.query.customers.findFirst({
            where: and(
              eq(customers.workspaceId, input.workspaceId),
              eq(customers.email, cust.email)
            ),
          })
          if (existing) { skipped++; continue }
        }
        if (cust.phone && cust.phone !== '') {
          const existing = await this.db.query.customers.findFirst({
            where: and(
              eq(customers.workspaceId, input.workspaceId),
              eq(customers.phone, cust.phone)
            ),
          })
          if (existing) { skipped++; continue }
        }

        await this.db.insert(customers).values({
          workspaceId: input.workspaceId,
          name: cust.name,
          email: cust.email || null,
          phone: cust.phone || null,
          tags: cust.tags ?? [],
        })
        created++
      } catch (err: any) {
        errors.push(`Row "${cust.name}": ${err.message}`)
      }
    }

    return { created, skipped, errors }
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
