import { Module } from '@nestjs/common'
import { ChainService } from './chain.service'
import { DatabaseModule } from '../database/database.module'

@Module({
  imports: [DatabaseModule],
  providers: [ChainService],
  exports: [ChainService],
})
export class ChainModule {}
