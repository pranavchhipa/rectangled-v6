import { Module } from '@nestjs/common'
import { OrganizationService } from './organization.service'
import { OrganizationMemberService } from './organization-member.service'
import { DatabaseModule } from '../database/database.module'

@Module({
  imports: [DatabaseModule],
  providers: [OrganizationService, OrganizationMemberService],
  exports: [OrganizationService, OrganizationMemberService],
})
export class OrganizationModule {}
