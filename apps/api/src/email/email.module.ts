import { Global, Module } from '@nestjs/common'
import { EmailService } from './email.service'
import { DatabaseModule } from '../database/database.module'
import { SendGridAdapter } from '../connector/adapters/sendgrid.adapter'

@Global()
@Module({
  imports: [DatabaseModule],
  providers: [EmailService, SendGridAdapter],
  exports: [EmailService],
})
export class EmailModule {}
