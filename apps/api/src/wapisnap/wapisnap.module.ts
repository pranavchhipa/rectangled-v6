import { Module } from '@nestjs/common'
import { WapisnapClientService } from './wapisnap-client.service'
import { WapisnapService } from './wapisnap.service'
import { WapisnapWebhookController } from './wapisnap-webhook.controller'
import { DatabaseModule } from '../database/database.module'

@Module({
  imports: [DatabaseModule],
  controllers: [WapisnapWebhookController],
  providers: [WapisnapClientService, WapisnapService],
  exports: [WapisnapClientService, WapisnapService],
})
export class WapisnapModule {}
