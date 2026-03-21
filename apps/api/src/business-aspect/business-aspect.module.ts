import { Module } from '@nestjs/common'
import { BusinessAspectService } from './business-aspect.service'
import { DatabaseModule } from '../database/database.module'

@Module({
  imports: [DatabaseModule],
  providers: [BusinessAspectService],
  exports: [BusinessAspectService],
})
export class BusinessAspectModule {}
