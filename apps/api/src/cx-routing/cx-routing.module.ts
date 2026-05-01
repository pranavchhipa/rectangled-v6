import { Module, OnModuleInit } from '@nestjs/common'
import { CxRoutingService } from './cx-routing.service'
import { DatabaseModule } from '../database/database.module'
import { InternalJobsModule } from '../internal-jobs/internal-jobs.module'
import { InternalJobsService } from '../internal-jobs/internal-jobs.service'

@Module({
  imports: [DatabaseModule, InternalJobsModule],
  providers: [CxRoutingService],
  exports: [CxRoutingService],
})
export class CxRoutingModule implements OnModuleInit {
  constructor(
    private readonly internalJobs: InternalJobsService,
    private readonly cxRouting: CxRoutingService,
  ) {}

  /**
   * Phase 0 Fix 3 — register the escalation evaluator as an internal-jobs
   * handler. Producers (e.g. review sync) enqueue
   * { type: 'escalation.evaluate', payload: { reviewId } } and the worker
   * dispatches here. Decoupled from review sync so an evaluator bug doesn't
   * break review ingestion.
   */
  onModuleInit() {
    this.internalJobs.registerHandler(
      'escalation.evaluate',
      async (payload) => {
        await this.cxRouting.evaluateReviewById(payload.reviewId as string)
      },
    )
  }
}
