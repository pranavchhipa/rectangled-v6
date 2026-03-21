import { Module } from '@nestjs/common'
import { CxRoutingService } from './cx-routing.service'
import { DatabaseModule } from '../database/database.module'

@Module({
  imports: [DatabaseModule],
  providers: [CxRoutingService],
  exports: [CxRoutingService],
})
export class CxRoutingModule {}
