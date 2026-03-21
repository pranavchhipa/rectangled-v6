import { Injectable, Inject, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { eq, and } from 'drizzle-orm'
import type { Database } from '@rectangled/db'
import { connectorInstances } from '@rectangled/db'
import { ReviewService } from './review.service'

@Injectable()
export class ReviewSyncService {
  private readonly logger = new Logger(ReviewSyncService.name)

  constructor(
    @Inject('DATABASE') private readonly db: Database,
    private readonly reviewService: ReviewService
  ) {}

  @Cron('0 */6 * * *')
  async handleCron() {
    this.logger.log('Starting scheduled review sync...')

    const instances = await this.db
      .select()
      .from(connectorInstances)
      .where(
        and(
          eq(connectorInstances.connectorTypeId, 'gbp'),
          eq(connectorInstances.status, 'connected')
        )
      )

    if (instances.length === 0) {
      this.logger.log('No active GBP connectors to sync')
      return
    }

    let totalSynced = 0
    let failures = 0

    for (const instance of instances) {
      try {
        const result = await this.reviewService.syncReviewsInternal(
          instance.id
        )
        totalSynced += result.synced
        this.logger.log(
          `Synced ${result.synced} reviews for connector ${instance.id}`
        )
      } catch (error: any) {
        failures++
        this.logger.error(
          `Failed to sync connector ${instance.id}: ${error.message}`
        )
      }
    }

    this.logger.log(
      `Scheduled sync complete: ${totalSynced} reviews synced, ${failures} failures out of ${instances.length} connectors`
    )
  }
}
