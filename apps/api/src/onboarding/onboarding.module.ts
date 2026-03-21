import { Module } from '@nestjs/common'
import { OnboardingService } from './onboarding.service'
import { DatabaseModule } from '../database/database.module'

@Module({
  imports: [DatabaseModule],
  providers: [OnboardingService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
