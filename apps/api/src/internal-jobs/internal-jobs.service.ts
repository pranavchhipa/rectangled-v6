import { Injectable, Inject, Logger } from '@nestjs/common'
import { eq, and, lte, sql, lt, asc } from 'drizzle-orm'
import type { Database } from '@rectangled/db'
import { internalJobs } from '@rectangled/db'

/**
 * Phase 0 Fix 3 — internal job queue service.
 *
 * - enqueue(type, payload, options?): adds a row to internal_jobs.
 * - registerHandler(type, fn): map a job type to its handler.
 * - process(): pick due pending jobs, dispatch them, update status.
 * - resetStuck(): watchdog (called from cron) flips long-stuck 'processing'
 *   rows back to 'pending' so the next tick retries.
 *
 * Handlers are registered by feature modules at startup. The service has no
 * knowledge of what work each type does — keeps the dependency graph clean
 * (cx-routing depends on internal-jobs, not the reverse).
 */
const STUCK_THRESHOLD_MINUTES = 10
const RETRY_BACKOFF_SECONDS = 30

export type JobHandler = (payload: Record<string, unknown>) => Promise<void>

@Injectable()
export class InternalJobsService {
  private readonly logger = new Logger(InternalJobsService.name)
  private handlers = new Map<string, JobHandler>()
  private running = false

  constructor(@Inject('DATABASE') private readonly db: Database) {}

  registerHandler(type: string, handler: JobHandler): void {
    if (this.handlers.has(type)) {
      this.logger.warn(`Handler for type "${type}" replaced.`)
    }
    this.handlers.set(type, handler)
  }

  async enqueue(
    type: string,
    payload: Record<string, unknown>,
    options?: { delaySeconds?: number; maxAttempts?: number },
  ): Promise<void> {
    const scheduledFor = options?.delaySeconds
      ? new Date(Date.now() + options.delaySeconds * 1000)
      : new Date()

    await this.db.insert(internalJobs).values({
      type,
      payload,
      status: 'pending',
      maxAttempts: options?.maxAttempts ?? 3,
      scheduledFor,
    })
  }

  /**
   * Process due pending jobs. Designed to be invoked from a cron tick.
   * Single-instance via local guard; the watchdog (resetStuck) handles tick
   * crashes.
   */
  async process(): Promise<{ processed: number; succeeded: number; failed: number; retried: number }> {
    if (this.running) {
      return { processed: 0, succeeded: 0, failed: 0, retried: 0 }
    }
    this.running = true

    try {
      const now = new Date()
      const due = await this.db
        .select()
        .from(internalJobs)
        .where(and(eq(internalJobs.status, 'pending'), lte(internalJobs.scheduledFor, now)))
        .orderBy(asc(internalJobs.scheduledFor))
        .limit(50)

      let succeeded = 0
      let failed = 0
      let retried = 0

      for (const job of due) {
        // Mark processing
        await this.db
          .update(internalJobs)
          .set({
            status: 'processing',
            attempts: job.attempts + 1,
            updatedAt: new Date(),
          })
          .where(eq(internalJobs.id, job.id))

        const handler = this.handlers.get(job.type)
        if (!handler) {
          await this.markFailed(job.id, `No handler registered for type "${job.type}"`)
          failed++
          continue
        }

        try {
          await handler(job.payload as Record<string, unknown>)
          await this.db
            .update(internalJobs)
            .set({
              status: 'completed',
              completedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(internalJobs.id, job.id))
          succeeded++
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'unknown error'
          if (job.attempts + 1 < job.maxAttempts) {
            // Re-schedule with backoff
            const next = new Date(Date.now() + RETRY_BACKOFF_SECONDS * 1000)
            await this.db
              .update(internalJobs)
              .set({
                status: 'pending',
                scheduledFor: next,
                lastError: msg,
                updatedAt: new Date(),
              })
              .where(eq(internalJobs.id, job.id))
            retried++
          } else {
            await this.markFailed(job.id, msg)
            failed++
          }
        }
      }

      return { processed: due.length, succeeded, failed, retried }
    } finally {
      this.running = false
    }
  }

  /**
   * Watchdog: flip long-stuck 'processing' rows back to 'pending'.
   */
  async resetStuck(): Promise<number> {
    const cutoff = new Date(Date.now() - STUCK_THRESHOLD_MINUTES * 60 * 1000)
    const reset = await this.db
      .update(internalJobs)
      .set({
        status: 'pending',
        lastError: sql`COALESCE(${internalJobs.lastError} || E'\n', '') || ${`watchdog reset @ ${new Date().toISOString()}: stuck > ${STUCK_THRESHOLD_MINUTES}min`}`,
        updatedAt: new Date(),
      })
      .where(
        and(eq(internalJobs.status, 'processing'), lt(internalJobs.updatedAt, cutoff)),
      )
      .returning({ id: internalJobs.id })
    if (reset.length > 0) {
      this.logger.warn(`reset ${reset.length} stuck internal_jobs row(s)`)
    }
    return reset.length
  }

  private async markFailed(id: string, error: string): Promise<void> {
    await this.db
      .update(internalJobs)
      .set({
        status: 'failed',
        lastError: error,
        updatedAt: new Date(),
      })
      .where(eq(internalJobs.id, id))
  }
}
