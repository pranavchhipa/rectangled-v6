import { Module } from '@nestjs/common'
import { TrpcRouter } from './trpc.router'
import { TrpcService } from './trpc.service'
import { AuthModule } from '../auth/auth.module'
import { WorkspaceModule } from '../workspace/workspace.module'
import { LocationModule } from '../location/location.module'
import { MemberModule } from '../member/member.module'
import { ConnectorModule } from '../connector/connector.module'
import { ReviewModule } from '../review/review.module'
import { CustomerModule } from '../customer/customer.module'
import { OnboardingModule } from '../onboarding/onboarding.module'
import { BusinessAspectModule } from '../business-aspect/business-aspect.module'
// Phase 5 — JourneyModule + TruformModule deleted; SurveysModule covers both.
import { ListingModule } from '../listing/listing.module'
import { BillingModule } from '../billing/billing.module'
import { AiResponseAutomationModule } from '../ai-response/ai-response.module'
import { CouponModule } from '../coupon/coupon.module'
import { CxRoutingModule } from '../cx-routing/cx-routing.module'
import { NotificationModule } from '../notification/notification.module'
import { QrModule } from '../qr/qr.module'
import { AutomationModule } from '../automation/automation.module'
import { NevModule } from '../nev/nev.module'
import { CliModule } from '../cli/cli.module'
import { ReportModule } from '../report/report.module'
import { EmailModule } from '../email/email.module'
import { WapisnapModule } from '../wapisnap/wapisnap.module'
import { RaisModule } from '../rais/rais.module'
import { AppointmentModule } from '../appointment/appointment.module'
import { AiAgentModule } from '../ai-agent/ai-agent.module'
import { OrganizationModule } from '../organization/organization.module'
import { ChainModule } from '../chain/chain.module'
import { SurveysModule } from '../surveys/surveys.module'

@Module({
  imports: [AuthModule, WorkspaceModule, LocationModule, MemberModule, ConnectorModule, ReviewModule, CustomerModule, OnboardingModule, BusinessAspectModule, ListingModule, BillingModule, AiResponseAutomationModule, CouponModule, CxRoutingModule, NotificationModule, QrModule, AutomationModule, NevModule, CliModule, ReportModule, EmailModule, WapisnapModule, RaisModule, AppointmentModule, AiAgentModule, OrganizationModule, ChainModule, SurveysModule],
  providers: [TrpcRouter, TrpcService],
  exports: [TrpcService],
})
export class TrpcModule {}
