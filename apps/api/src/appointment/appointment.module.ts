import { Module } from '@nestjs/common'
import { AppointmentService } from './appointment.service'
import { CalendarAdapter } from '../connector/adapters/calendar.adapter'
import { DatabaseModule } from '../database/database.module'
import { ConnectorModule } from '../connector/connector.module'

@Module({
  imports: [DatabaseModule, ConnectorModule],
  providers: [AppointmentService, CalendarAdapter],
  exports: [AppointmentService, CalendarAdapter],
})
export class AppointmentModule {}
