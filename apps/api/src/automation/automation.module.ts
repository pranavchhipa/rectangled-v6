import { Module } from '@nestjs/common'
import { AutomationService } from './automation.service'
import { DatabaseModule } from '../database/database.module'
import { ConnectorModule } from '../connector/connector.module'

@Module({
  imports: [DatabaseModule, ConnectorModule],
  providers: [AutomationService],
  exports: [AutomationService],
})
export class AutomationModule {}
