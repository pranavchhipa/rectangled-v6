import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { AutomationService } from './automation.service'

/**
 * Phase 0 Fix 13a — make the automation worker actually run.
 *
 * Pre-fix, AutomationService.processQueue() existed but was never called from
 * anywhere. Every automation rule that fired enqueued a row that sat
 * status='pending' forever. Coupons were never sent. WhatsApp follow-ups
 * were never sent. AI replies via the automation path were never posted.
 *
 * This worker runs every minute. Combined with Fix 1 (idempotent enqueue,
 * unique key on rule_id+trigger_key), Fix 13b (watchdog for stuck
 * 'processing' rows), and Fix 9 (idempotency tokens on outbound calls),
 * the worker is safe to run even if a single tick fails.
 *
 * Kill switch: set AUTOMATION_WORKER_ENABLED=false to disable without
 * redeploy. Useful if the worker starts behaving badly in production.
 */
@Injectable()
export class AutomationQueueCron {
  private readonly logger = new Logger(AutomationQueueCron.name)
  private running = false

  constructor(private readonly automation: AutomationService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tick() {
    if (process.env.AUTOMATION_WORKER_ENABLED === 'false') {
      // Loud first time, quiet thereafter; we don't want this to be silent
      // forever in case someone forgot to flip it back.
      if (!this.killSwitchLoggedRecently) {
        this.logger.warn(
          'AUTOMATION_WORKER_ENABLED=false — automation queue worker is paused.',
        )
        this.killSwitchLoggedRecently = true
        // Reset the flag every 30 minutes so the warning re-prints.
        setTimeout(() => {
          this.killSwitchLoggedRecently = false
        }, 30 * 60 * 1000).unref?.()
      }
      return
    }

    // Single-instance guard: if a tick is still running when the next one
    // fires, skip. The watchdog (Fix 13b) handles cases where a tick crashes
    // mid-processing.
    if (this.running) {
      this.logger.debug('Previous tick still running, skipping.')
      return
    }

    this.running = true
    try {
      const result = await this.automation.processQueue()
      if (result.processed > 0) {
        this.logger.log(
          `processed ${result.processed} (succeeded ${result.succeeded}, failed ${result.failed})`,
        )
      }
    } catch (err) {
      this.logger.error('Queue tick failed:', err instanceof Error ? err.message : err)
    } finally {
      this.running = false
    }
  }

  private killSwitchLoggedRecently = false
}
