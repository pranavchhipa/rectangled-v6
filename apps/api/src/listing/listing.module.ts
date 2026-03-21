import { Module } from '@nestjs/common'
import { ListingService } from './listing.service'
import { DatabaseModule } from '../database/database.module'
import { ConnectorModule } from '../connector/connector.module'

@Module({
  imports: [DatabaseModule, ConnectorModule],
  providers: [ListingService],
  exports: [ListingService],
})
export class ListingModule {}
