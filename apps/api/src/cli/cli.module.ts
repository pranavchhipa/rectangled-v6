import { Module } from '@nestjs/common'
import { CliService } from './cli.service'
import { DatabaseModule } from '../database/database.module'

@Module({
  imports: [DatabaseModule],
  providers: [CliService],
  exports: [CliService],
})
export class CliModule {}
