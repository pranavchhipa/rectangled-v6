import { Module } from '@nestjs/common'
import { InternalJobsService } from './internal-jobs.service'
import { InternalJobsCron } from './queue.cron'
import { DatabaseModule } from '../database/database.module'

@Module({
  imports: [DatabaseModule],
  providers: [InternalJobsService, InternalJobsCron],
  exports: [InternalJobsService],
})
export class InternalJobsModule {}
