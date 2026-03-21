import { Module } from '@nestjs/common'
import { QrService } from './qr.service'
import { DatabaseModule } from '../database/database.module'

@Module({
  imports: [DatabaseModule],
  providers: [QrService],
  exports: [QrService],
})
export class QrModule {}
