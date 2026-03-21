import { Module } from '@nestjs/common'
import { NevService } from './nev.service'
import { DatabaseModule } from '../database/database.module'

@Module({
  imports: [DatabaseModule],
  providers: [NevService],
  exports: [NevService],
})
export class NevModule {}
