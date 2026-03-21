import { Module } from '@nestjs/common'
import { BillingService } from './billing.service'
import { DatabaseModule } from '../database/database.module'

@Module({
  imports: [DatabaseModule],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
