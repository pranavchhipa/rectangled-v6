import { Module } from '@nestjs/common'
import { ReportService } from './report.service'
import { DatabaseModule } from '../database/database.module'

@Module({
  imports: [DatabaseModule],
  providers: [ReportService],
  exports: [ReportService],
})
export class ReportModule {}
