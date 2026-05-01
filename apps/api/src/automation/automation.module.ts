import { Module } from '@nestjs/common'
import { AutomationService } from './automation.service'
import { AutomationQueueCron } from './queue.cron'
import { AutomationWatchdogCron } from './watchdog.cron'
import { DatabaseModule } from '../database/database.module'
import { ConnectorModule } from '../connector/connector.module'

@Module({
  imports: [DatabaseModule, ConnectorModule],
  providers: [AutomationService, AutomationQueueCron, AutomationWatchdogCron],
  exports: [AutomationService],
})
export class AutomationModule {}
