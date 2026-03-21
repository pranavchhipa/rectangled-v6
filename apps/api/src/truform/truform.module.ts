import { Module } from '@nestjs/common'
import { TruformService } from './truform.service'
import { DatabaseModule } from '../database/database.module'

@Module({
  imports: [DatabaseModule],
  providers: [TruformService],
  exports: [TruformService],
})
export class TruformModule {}
