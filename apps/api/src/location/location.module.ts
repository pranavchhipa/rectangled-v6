import { Module } from '@nestjs/common'
import { LocationService } from './location.service'
import { DatabaseModule } from '../database/database.module'

@Module({
  imports: [DatabaseModule],
  providers: [LocationService],
  exports: [LocationService],
})
export class LocationModule {}
