import {
  Controller,
  Post,
  Req,
  Res,
  Logger,
  HttpStatus,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createHmac } from 'crypto'
import { WapisnapService } from './wapisnap.service'

@Controller('webhooks')
export class WapisnapWebhookController {
  private readonly logger = new Logger(WapisnapWebhookController.name)
  private readonly bridgeSecret: string

  constructor(
    private readonly wapisnapService: WapisnapService,
    private readonly config: ConfigService
  ) {
    this.bridgeSecret = this.config.get<string>('WAPISNAP_BRIDGE_SECRET', '')
  }

  @Post('wapisnap')
  async handleWebhook(@Req() req: any, @Res() res: any) {
    try {
      // Verify HMAC-SHA256 signature
      const signature = req.headers['x-bridge-signature'] as string
      const timestamp = req.headers['x-bridge-timestamp'] as string

      if (!signature || !timestamp) {
        this.logger.warn('Webhook received without signature headers')
        return res.status(HttpStatus.UNAUTHORIZED).json({ error: 'Missing signature' })
      }

      const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
      const expectedSignature = createHmac('sha256', this.bridgeSecret)
        .update(`${timestamp}.${body}`)
        .digest('hex')

      if (signature !== expectedSignature) {
        this.logger.warn('Webhook signature verification failed')
        return res.status(HttpStatus.UNAUTHORIZED).json({ error: 'Invalid signature' })
      }

      // Check timestamp freshness (5 minute window)
      const timestampMs = parseInt(timestamp, 10)
      if (Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000) {
        this.logger.warn('Webhook timestamp too old')
        return res.status(HttpStatus.UNAUTHORIZED).json({ error: 'Timestamp expired' })
      }

      const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
      const { event, workspaceId, data } = payload

      this.logger.log(`Webhook received: ${event} for workspace ${workspaceId}`)

      switch (event) {
        case 'message_status':
          await this.wapisnapService.handleMessageStatus(data || {})
          break

        case 'message_received':
          await this.wapisnapService.handleMessageReceived(workspaceId, data || {})
          break

        case 'number_ready':
          await this.wapisnapService.handleNumberReady(workspaceId, data || {})
          break

        case 'number_error':
          await this.wapisnapService.handleNumberError(workspaceId, data || {})
          break

        case 'broadcast_completed':
          this.logger.log(
            `Broadcast completed for workspace ${workspaceId}: ${JSON.stringify(data)}`
          )
          break

        default:
          this.logger.warn(`Unknown webhook event: ${event}`)
      }

      return res.status(HttpStatus.OK).json({ received: true })
    } catch (error) {
      this.logger.error(
        `Webhook processing error: ${error instanceof Error ? error.message : 'Unknown'}`
      )
      return res
        .status(HttpStatus.INTERNAL_SERVER_ERROR)
        .json({ error: 'Internal error' })
    }
  }
}
