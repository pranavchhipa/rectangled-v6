import { Module } from '@nestjs/common'
import { AiResponseAutomationService } from './ai-response.service'
import { DatabaseModule } from '../database/database.module'

@Module({
  imports: [DatabaseModule],
  providers: [AiResponseAutomationService],
  exports: [AiResponseAutomationService],
})
export class AiResponseAutomationModule {}
