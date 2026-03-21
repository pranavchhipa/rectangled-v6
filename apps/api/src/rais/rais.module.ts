import { Module } from '@nestjs/common'
import { RaisService } from './rais.service'
import { DatabaseModule } from '../database/database.module'

@Module({
  imports: [DatabaseModule],
  providers: [RaisService],
  exports: [RaisService],
})
export class RaisModule {}
