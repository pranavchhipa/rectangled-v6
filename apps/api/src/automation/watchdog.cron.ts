import { Injectable, Inject, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { eq, and, lt, sql } from 'drizzle-orm'
import type { Database } from '@rectangled/db'
import { automationQueue } from '@rectangled/db'

/**
 * Phase 0 Fix 13b — recover stuck `processing` rows.
 *
 * If a worker tick crashes after marking a row 'processing' but before
 * marking it 'completed' or 'failed', the row is orphaned. Without this
 * watchdog, it stays 'processing' forever and the work never retries.
 *
 * The watchdog runs every 2 minutes and flips rows stuck in 'processing'
 * for more than STUCK_THRESHOLD_MINUTES back to 'pending' so the next
 * worker tick picks them up.
 *
 * Safety: combined with Fix 1 (idempotent enqueue) and Fix 9 (idempotency
 * tokens on outbound calls), retried work is safe even if the original
 * tick had already partially executed.
 */
const STUCK_THRESHOLD_MINUTES = 10

@Injectable()
export class AutomationWatchdogCron {
  private readonly logger = new Logger(AutomationWatchdogCron.name)

  constructor(@Inject('DATABASE') private readonly db: Database) {}

  @Cron('*/2 * * * *') // every 2 minutes
  async resetStuckRows() {
    if (process.env.AUTOMATION_WORKER_ENABLED === 'false') return

    const cutoff = new Date(Date.now() - STUCK_THRESHOLD_MINUTES * 60 * 1000)

    const result = await this.db
      .update(automationQueue)
      .set({
        status: 'pending' as any,
        lastError: sql`COALESCE(${automationQueue.lastError} || E'\n', '') || ${`watchdog reset @ ${new Date().toISOString()}: stuck > ${STUCK_THRESHOLD_MINUTES}min`}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(automationQueue.status, 'processing' as any),
          lt(automationQueue.updatedAt, cutoff),
        ),
      )
      .returning({ id: automationQueue.id })

    if (result.length > 0) {
      this.logger.warn(
        `reset ${result.length} stuck row(s) from 'processing' back to 'pending' (cutoff ${STUCK_THRESHOLD_MINUTES}min)`,
      )
    }
  }
}
