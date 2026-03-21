import { Module } from '@nestjs/common'
import { AiAgentService } from './ai-agent.service'
import { DatabaseModule } from '../database/database.module'

@Module({
  imports: [DatabaseModule],
  providers: [AiAgentService],
  exports: [AiAgentService],
})
export class AiAgentModule {}
