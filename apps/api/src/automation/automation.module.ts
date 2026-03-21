import { Module } from '@nestjs/common'
import { AutomationService } from './automation.service'
import { DatabaseModule } from '../database/database.module'

@Module({
  imports: [DatabaseModule],
  providers: [AutomationService],
  exports: [AutomationService],
})
export class AutomationModule {}
