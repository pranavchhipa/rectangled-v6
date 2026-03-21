import { Module } from '@nestjs/common'
import { MemberService } from './member.service'
import { DatabaseModule } from '../database/database.module'

@Module({
  imports: [DatabaseModule],
  providers: [MemberService],
  exports: [MemberService],
})
export class MemberModule {}
