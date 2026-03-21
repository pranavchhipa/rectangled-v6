import { Injectable, Logger } from '@nestjs/common'

interface SendGridMailPayload {
  personalizations: Array<{ to: Array<{ email: string }> }>
  from: { email: string; name?: string }
  subject: string
  content: Array<{ type: string; value: string }>
}

@Injectable()
export class SendGridAdapter {
  private readonly logger = new Logger(SendGridAdapter.name)

  async sendEmail(apiKey: string, params: { to: string; from: string; subject: string; html: string }) {
    const payload: SendGridMailPayload = {
      personalizations: [{ to: [{ email: params.to }] }],
      from: { email: params.from },
      subject: params.subject,
      content: [{ type: 'text/html', value: params.html }],
    }

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      this.logger.error(`SendGrid error: ${response.status} ${errorText}`)
      throw new Error(`SendGrid API error: ${response.status}`)
    }

    return { success: true, provider: 'sendgrid' }
  }

  async verifyApiKey(apiKey: string): Promise<boolean> {
    try {
      const response = await fetch('https://api.sendgrid.com/v3/scopes', {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      })
      return response.ok
    } catch {
      return false
    }
  }
}
