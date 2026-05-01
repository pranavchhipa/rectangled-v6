import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { InternalJobsService } from './internal-jobs.service'

/**
 * Phase 0 Fix 3 — cron driver for the internal job queue.
 *
 * Runs every 30 seconds (twice per minute). Resets stuck rows every 2 minutes.
 *
 * Kill switch: AUTOMATION_WORKER_ENABLED=false also disables this worker
 * because internal-jobs and automation_queue share the same operator
 * concern (off all queues, off all workers).
 */
@Injectable()
export class InternalJobsCron {
  private readonly logger = new Logger(InternalJobsCron.name)

  constructor(private readonly service: InternalJobsService) {}

  @Cron('*/30 * * * * *') // every 30 seconds
  async tick() {
    if (process.env.AUTOMATION_WORKER_ENABLED === 'false') return
    try {
      const result = await this.service.process()
      if (result.processed > 0) {
        this.logger.log(
          `processed ${result.processed} (succeeded ${result.succeeded}, retried ${result.retried}, failed ${result.failed})`,
        )
      }
    } catch (err) {
      this.logger.error('Internal jobs tick failed:', err instanceof Error ? err.message : err)
    }
  }

  @Cron('*/2 * * * *') // every 2 minutes
  async watchdog() {
    if (process.env.AUTOMATION_WORKER_ENABLED === 'false') return
    try {
      await this.service.resetStuck()
    } catch (err) {
      this.logger.error('Internal jobs watchdog failed:', err instanceof Error ? err.message : err)
    }
  }
}
