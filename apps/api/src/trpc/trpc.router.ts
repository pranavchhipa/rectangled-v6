import { Injectable, OnModuleInit } from '@nestjs/common'
import { HttpAdapterHost } from '@nestjs/core'
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { router, publicProcedure } from './middleware'
import { createTrpcContext } from './context'
import { createAuthRouter } from '../auth/auth.router'
import { createWorkspaceRouter } from '../workspace/workspace.router'
import { createLocationRouter } from '../location/location.router'
import { createMemberRouter } from '../member/member.router'
import { createConnectorRouter } from '../connector/connector.router'
import { createReviewRouter } from '../review/review.router'
import { createCustomerRouter } from '../customer/customer.router'
import { createOnboardingRouter } from '../onboarding/onboarding.router'
import { createBusinessAspectRouter } from '../business-aspect/business-aspect.router'
import { createJourneyRouter } from '../journey/journey.router'
import { createTruformRouter } from '../truform/truform.router'
import { createListingRouter } from '../listing/listing.router'
import { createBillingRouter } from '../billing/billing.router'
import { createAiResponseRouter } from '../ai-response/ai-response.router'
import { createCouponRouter } from '../coupon/coupon.router'
import { createCxRoutingRouter } from '../cx-routing/cx-routing.router'
import { createNotificationRouter } from '../notification/notification.router'
import { createQrRouter } from '../qr/qr.router'
import { createAutomationRouter } from '../automation/automation.router'
import { AuthService } from '../auth/auth.service'
import { WorkspaceService } from '../workspace/workspace.service'
import { LocationService } from '../location/location.service'
import { MemberService } from '../member/member.service'
import { ConnectorService } from '../connector/connector.service'
import { GbpAdapter } from '../connector/adapters/gbp.adapter'
import { ReviewService } from '../review/review.service'
import { CustomerService } from '../customer/customer.service'
import { OnboardingService } from '../onboarding/onboarding.service'
import { BusinessAspectService } from '../business-aspect/business-aspect.service'
import { JourneyService } from '../journey/journey.service'
import { TruformService } from '../truform/truform.service'
import { ListingService } from '../listing/listing.service'
import { BillingService } from '../billing/billing.service'
import { AiResponseAutomationService } from '../ai-response/ai-response.service'
import { CouponService } from '../coupon/coupon.service'
import { CxRoutingService } from '../cx-routing/cx-routing.service'
import { NotificationService } from '../notification/notification.service'
import { QrService } from '../qr/qr.service'
import { AutomationService } from '../automation/automation.service'
import { createNevRouter } from '../nev/nev.router'
import { createCliRouter } from '../cli/cli.router'
import { NevService } from '../nev/nev.service'
import { CliService } from '../cli/cli.service'
import { createReportRouter } from '../report/report.router'
import { ReportService } from '../report/report.service'
import { createEmailRouter } from '../email/email.router'
import { EmailService } from '../email/email.service'
import { createWapisnapRouter } from '../wapisnap/wapisnap.router'
import { WapisnapService } from '../wapisnap/wapisnap.service'
import { createRaisRouter } from '../rais/rais.router'
import { RaisService } from '../rais/rais.service'
import { createAppointmentRouter } from '../appointment/appointment.router'
import { AppointmentService } from '../appointment/appointment.service'
import { CalendarAdapter } from '../connector/adapters/calendar.adapter'
import { createAiAgentRouter } from '../ai-agent/ai-agent.router'
import { AiAgentService } from '../ai-agent/ai-agent.service'
import { z } from 'zod'

// Static router for type export — uses null as any for service injection
export const appRouter = router({
  health: publicProcedure.query(() => ({
    status: 'ok' as const,
    version: '6.0.0',
  })),
  hello: publicProcedure
    .input(z.object({ name: z.string().optional() }))
    .query(({ input }) => {
      return { greeting: `Hello ${input.name ?? 'OptimizerV6'}!` }
    }),
  auth: createAuthRouter(null as any),
  workspace: createWorkspaceRouter(null as any),
  location: createLocationRouter(null as any),
  member: createMemberRouter(null as any),
  connector: createConnectorRouter(null as any),
  review: createReviewRouter(null as any),
  customer: createCustomerRouter(null as any),
  onboarding: createOnboardingRouter(null as any),
  businessAspect: createBusinessAspectRouter(null as any),
  journey: createJourneyRouter(null as any),
  truform: createTruformRouter(null as any),
  listing: createListingRouter(null as any),
  billing: createBillingRouter(null as any),
  aiResponse: createAiResponseRouter(null as any),
  coupon: createCouponRouter(null as any),
  cxRouting: createCxRoutingRouter(null as any),
  notification: createNotificationRouter(null as any),
  qr: createQrRouter(null as any),
  automation: createAutomationRouter(null as any),
  nev: createNevRouter(null as any),
  cli: createCliRouter(null as any),
  report: createReportRouter(null as any),
  email: createEmailRouter(null as any),
  wapisnap: createWapisnapRouter(null as any),
  rais: createRaisRouter(null as any),
  appointment: createAppointmentRouter(null as any),
  aiAgent: createAiAgentRouter(null as any),
})

export type AppRouter = typeof appRouter

@Injectable()
export class TrpcRouter implements OnModuleInit {
  private runtimeRouter: any

  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly authService: AuthService,
    private readonly workspaceService: WorkspaceService,
    private readonly locationService: LocationService,
    private readonly memberService: MemberService,
    private readonly connectorService: ConnectorService,
    private readonly gbpAdapter: GbpAdapter,
    private readonly reviewService: ReviewService,
    private readonly customerService: CustomerService,
    private readonly onboardingService: OnboardingService,
    private readonly businessAspectService: BusinessAspectService,
    private readonly journeyService: JourneyService,
    private readonly truformService: TruformService,
    private readonly listingService: ListingService,
    private readonly billingService: BillingService,
    private readonly aiResponseAutomationService: AiResponseAutomationService,
    private readonly couponService: CouponService,
    private readonly cxRoutingService: CxRoutingService,
    private readonly notificationService: NotificationService,
    private readonly qrService: QrService,
    private readonly automationService: AutomationService,
    private readonly nevService: NevService,
    private readonly cliService: CliService,
    private readonly reportService: ReportService,
    private readonly emailService: EmailService,
    private readonly wapisnapService: WapisnapService,
    private readonly raisService: RaisService,
    private readonly appointmentService: AppointmentService,
    private readonly calendarAdapter: CalendarAdapter,
    private readonly aiAgentService: AiAgentService,
  ) {}

  onModuleInit() {
    this.runtimeRouter = router({
      health: publicProcedure.query(() => ({
        status: 'ok' as const,
        version: '6.0.0',
      })),
      hello: publicProcedure
        .input(z.object({ name: z.string().optional() }))
        .query(({ input }) => {
          return { greeting: `Hello ${input.name ?? 'OptimizerV6'}!` }
        }),
      auth: createAuthRouter(this.authService),
      workspace: createWorkspaceRouter(this.workspaceService),
      location: createLocationRouter(this.locationService),
      member: createMemberRouter(this.memberService),
      connector: createConnectorRouter(this.connectorService, this.gbpAdapter, this.calendarAdapter),
      review: createReviewRouter(this.reviewService),
      customer: createCustomerRouter(this.customerService),
      onboarding: createOnboardingRouter(this.onboardingService),
      businessAspect: createBusinessAspectRouter(this.businessAspectService),
      journey: createJourneyRouter(this.journeyService),
      truform: createTruformRouter(this.truformService),
      listing: createListingRouter(this.listingService),
      billing: createBillingRouter(this.billingService),
      aiResponse: createAiResponseRouter(this.aiResponseAutomationService),
      coupon: createCouponRouter(this.couponService),
      cxRouting: createCxRoutingRouter(this.cxRoutingService),
      notification: createNotificationRouter(this.notificationService),
      qr: createQrRouter(this.qrService),
      automation: createAutomationRouter(this.automationService),
      nev: createNevRouter(this.nevService),
      cli: createCliRouter(this.cliService),
      report: createReportRouter(this.reportService),
      email: createEmailRouter(this.emailService),
      wapisnap: createWapisnapRouter(this.wapisnapService),
      rais: createRaisRouter(this.raisService),
      appointment: createAppointmentRouter(this.appointmentService),
      aiAgent: createAiAgentRouter(this.aiAgentService),
    })

    const app = this.httpAdapterHost.httpAdapter.getInstance()
    const runtimeRouter = this.runtimeRouter

    app.use('/trpc', async (req: any, res: any) => {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
      const fullUrl = `http://localhost/trpc${url.pathname}${url.search}`

      let body: string | undefined
      if (req.method !== 'GET') {
        if (req.body && Object.keys(req.body).length > 0) {
          body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
        } else {
          // Body parser may not have run — read raw body from stream
          const chunks: Buffer[] = []
          for await (const chunk of req) {
            chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
          }
          if (chunks.length > 0) {
            body = Buffer.concat(chunks).toString('utf-8')
          }
        }
      }

      // Build headers for fetch Request — ensure content-type is set for POST
      const headers = new Headers()
      if (body) {
        headers.set('content-type', 'application/json')
      }
      // Forward authorization header for protected routes
      if (req.headers.authorization) {
        headers.set('authorization', req.headers.authorization)
      }

      const request = new Request(fullUrl, {
        method: req.method,
        headers,
        body,
      })

      const response = await fetchRequestHandler({
        endpoint: '/trpc',
        req: request,
        router: runtimeRouter,
        createContext: () => createTrpcContext(request),
      })

      res.status(response.status)
      response.headers.forEach((value: string, key: string) => {
        res.setHeader(key, value)
      })
      const text = await response.text()
      res.send(text)
    })
  }
}
