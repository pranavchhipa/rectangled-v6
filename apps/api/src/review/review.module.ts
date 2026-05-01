import { Module } from '@nestjs/common'
import { ReviewService } from './review.service'
import { AIResponseService } from './ai-response.service'
import { ReviewSyncService } from './review-sync.service'
import { DatabaseModule } from '../database/database.module'
import { ConnectorModule } from '../connector/connector.module'
import { InternalJobsModule } from '../internal-jobs/internal-jobs.module'
import { AutomationModule } from '../automation/automation.module'

@Module({
  imports: [DatabaseModule, ConnectorModule, InternalJobsModule, AutomationModule],
  providers: [ReviewService, AIResponseService, ReviewSyncService],
  exports: [ReviewService, AIResponseService],
})
export class ReviewModule {}
