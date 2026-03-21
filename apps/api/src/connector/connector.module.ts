import { Module } from '@nestjs/common'
import { ConnectorService } from './connector.service'
import { GbpAdapter } from './adapters/gbp.adapter'
import { ZomatoAdapter } from './adapters/zomato.adapter'
import { SendGridAdapter } from './adapters/sendgrid.adapter'
import { DatabaseModule } from '../database/database.module'

@Module({
  imports: [DatabaseModule],
  providers: [ConnectorService, GbpAdapter, ZomatoAdapter, SendGridAdapter],
  exports: [ConnectorService, GbpAdapter, ZomatoAdapter, SendGridAdapter],
})
export class ConnectorModule {}
