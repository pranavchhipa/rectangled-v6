import { Module } from '@nestjs/common'
import { JourneyService } from './journey.service'
import { DatabaseModule } from '../database/database.module'

@Module({
  imports: [DatabaseModule],
  providers: [JourneyService],
  exports: [JourneyService],
})
export class JourneyModule {}
