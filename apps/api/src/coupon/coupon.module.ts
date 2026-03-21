import { Module } from '@nestjs/common'
import { CouponService } from './coupon.service'
import { DatabaseModule } from '../database/database.module'

@Module({
  imports: [DatabaseModule],
  providers: [CouponService],
  exports: [CouponService],
})
export class CouponModule {}
