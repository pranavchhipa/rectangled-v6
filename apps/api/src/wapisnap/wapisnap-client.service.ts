import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { TRPCError } from '@trpc/server'
import { createHmac } from 'crypto'

interface BridgeResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

@Injectable()
export class WapisnapClientService {
  private readonly logger = new Logger(WapisnapClientService.name)
  private readonly bridgeUrl: string
  private readonly bridgeSecret: string

  constructor(private readonly config: ConfigService) {
    this.bridgeUrl = this.config.get<string>('WAPISNAP_BRIDGE_URL', 'http://localhost:3050/bridge')
    this.bridgeSecret = this.config.get<string>('WAPISNAP_BRIDGE_SECRET', '')
  }

  // --- Provisioning ---

  async provision(locationName: string, timezone: string) {
    return this.request<{ workspaceId: string; apiKey: string }>(
      'POST',
      '/provision',
      undefined,
      { locationName, timezone }
    )
  }

  // --- Messaging ---

  async sendTemplate(
    apiKey: string,
    phone: string,
    templateName: string,
    variables: Record<string, unknown>,
    scheduledAt?: string
  ) {
    return this.request<{ messageId: string }>(
      'POST',
      '/send-template',
      apiKey,
      { phone, templateName, variables, scheduledAt }
    )
  }

  async sendText(apiKey: string, phone: string, text: string) {
    return this.request<{ messageId: string }>(
      'POST',
      '/send-text',
      apiKey,
      { phone, text }
    )
  }

  async sendInteractive(
    apiKey: string,
    phone: string,
    body: string,
    buttons: Array<{ id: string; title: string }>
  ) {
    return this.request<{ messageId: string }>(
      'POST',
      '/send-interactive',
      apiKey,
      { phone, body, buttons }
    )
  }

  // --- Templates ---

  async createTemplate(
    apiKey: string,
    name: string,
    language: string,
    category: string,
    components: Record<string, unknown>[]
  ) {
    return this.request<{ templateId: string }>(
      'POST',
      '/templates',
      apiKey,
      { name, language, category, components }
    )
  }

  async listTemplates(apiKey: string) {
    return this.request<
      Array<{
        id: string
        name: string
        language: string
        category: string
        status: string
        components: Record<string, unknown>[]
      }>
    >('GET', '/templates', apiKey)
  }

  async deleteTemplate(apiKey: string, templateId: string) {
    return this.request<{ success: boolean }>(
      'DELETE',
      `/templates/${templateId}`,
      apiKey
    )
  }

  // --- Contacts ---

  async getContact(apiKey: string, phone: string) {
    return this.request<{
      id: string
      phone: string
      name?: string
      tags: string[]
    }>('GET', `/contacts?phone=${encodeURIComponent(phone)}`, apiKey)
  }

  async createContact(apiKey: string, phone: string, name: string, tags: string[]) {
    return this.request<{ contactId: string }>(
      'POST',
      '/contacts',
      apiKey,
      { phone, name, tags }
    )
  }

  async addTags(apiKey: string, contactId: string, tags: string[]) {
    return this.request<{ success: boolean }>(
      'PATCH',
      `/contacts/${contactId}/tags`,
      apiKey,
      { tags }
    )
  }

  // --- Message history ---

  async getMessageHistory(apiKey: string, phone: string, limit: number = 50) {
    return this.request<
      Array<{
        id: string
        phone: string
        direction: string
        type: string
        content: unknown
        status: string
        createdAt: string
      }>
    >('GET', `/messages?phone=${encodeURIComponent(phone)}&limit=${limit}`, apiKey)
  }

  // --- Broadcasts ---

  async createBroadcast(
    apiKey: string,
    templateName: string,
    recipients: Array<{ phone: string; variables: Record<string, unknown> }>
  ) {
    return this.request<{ broadcastId: string; queued: number }>(
      'POST',
      '/broadcasts',
      apiKey,
      { templateName, recipients }
    )
  }

  // --- Kill switch ---

  async pauseWorkspace(apiKey: string) {
    return this.request<{ success: boolean }>('POST', '/pause', apiKey)
  }

  async resumeWorkspace(apiKey: string) {
    return this.request<{ success: boolean }>('POST', '/resume', apiKey)
  }

  // --- Health ---

  async healthCheck(apiKey: string) {
    return this.request<{
      status: string
      phoneNumber?: string
      numberStatus?: string
    }>('GET', '/health', apiKey)
  }

  // --- Private HTTP client ---

  private async request<T>(
    method: string,
    path: string,
    apiKey?: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const url = `${this.bridgeUrl}${path}`
    const timestamp = Date.now().toString()
    const bodyStr = body ? JSON.stringify(body) : ''

    // HMAC-SHA256 signature: timestamp.method.path.body
    const signPayload = `${timestamp}.${method}.${path}.${bodyStr}`
    const signature = createHmac('sha256', this.bridgeSecret)
      .update(signPayload)
      .digest('hex')

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Bridge-Timestamp': timestamp,
      'X-Bridge-Signature': signature,
    }

    if (apiKey) {
      headers['X-Api-Key'] = apiKey
    }

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? bodyStr : undefined,
      })

      if (!response.ok) {
        const errorBody = await response.text()
        this.logger.error(
          `Bridge request failed: ${method} ${path} → ${response.status} ${errorBody}`
        )
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `WapiSnap bridge error: ${response.status} ${response.statusText}`,
        })
      }

      const json = (await response.json()) as BridgeResponse<T>

      if (!json.success) {
        this.logger.error(`Bridge returned error: ${method} ${path} → ${json.error}`)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `WapiSnap bridge error: ${json.error || 'Unknown error'}`,
        })
      }

      return json.data as T
    } catch (error) {
      if (error instanceof TRPCError) throw error

      this.logger.error(
        `Bridge request exception: ${method} ${path} → ${error instanceof Error ? error.message : 'Unknown'}`
      )
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `WapiSnap bridge unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    }
  }
}
