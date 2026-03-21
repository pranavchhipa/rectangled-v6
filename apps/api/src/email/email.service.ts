import { Injectable, Inject, Logger } from '@nestjs/common'
import { Resend } from 'resend'
import { eq, and } from 'drizzle-orm'
import type { Database } from '@rectangled/db'
import { connectorInstances } from '@rectangled/db'
import { SendGridAdapter } from '../connector/adapters/sendgrid.adapter'

interface WorkspaceEmailConfig {
  provider: 'sendgrid' | 'resend'
  apiKey: string
  fromEmail: string
}

@Injectable()
export class EmailService {
  private readonly resend: Resend
  private readonly from: string
  private readonly logger = new Logger(EmailService.name)

  constructor(
    @Inject('DATABASE') private readonly db: Database,
    private readonly sendGridAdapter: SendGridAdapter,
  ) {
    this.resend = new Resend(process.env.RESEND_API_KEY)
    this.from = process.env.EMAIL_FROM || 'reviews@exprectangled.com'
  }

  async getWorkspaceEmailConfig(workspaceId: string): Promise<WorkspaceEmailConfig | null> {
    const instance = await this.db
      .select()
      .from(connectorInstances)
      .where(
        and(
          eq(connectorInstances.workspaceId, workspaceId),
          eq(connectorInstances.connectorTypeId, 'email'),
          eq(connectorInstances.status, 'connected'),
        ),
      )
      .then((rows) => rows[0] ?? null)

    if (!instance) return null

    const credentials = instance.credentials as Record<string, unknown>
    const config = instance.config as Record<string, unknown>

    return {
      provider: (config.provider as string) === 'sendgrid' ? 'sendgrid' : 'resend',
      apiKey: credentials.apiKey as string,
      fromEmail: (config.fromEmail as string) || this.from,
    }
  }

  // ─── Review Request ───────────────────────────────────────

  async sendReviewRequestEmail(
    to: string,
    customerName: string,
    journeyLink: string,
    businessName: string,
    workspaceId?: string,
  ) {
    const subject = `${businessName} would love your feedback`
    const html = this.wrapLayout(`
      <h1 style="color:#1f2937;font-size:24px;margin:0 0 16px;">Hi ${this.esc(customerName)},</h1>
      <p style="color:#4b5563;font-size:16px;line-height:1.6;margin:0 0 24px;">
        Thank you for choosing <strong>${this.esc(businessName)}</strong>. We'd love to hear about your experience!
      </p>
      ${this.ctaButton('Share Your Feedback', journeyLink)}
      <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:24px 0 0;">
        It only takes a minute and helps us serve you better.
      </p>
    `)

    return this.send(to, subject, html, workspaceId)
  }

  // ─── Coupon Email ─────────────────────────────────────────

  async sendCouponEmail(
    to: string,
    customerName: string,
    couponCode: string,
    discount: string,
    businessName: string,
    expiresAt: Date,
    workspaceId?: string,
  ) {
    const subject = `Your ${discount} discount from ${businessName}`
    const formattedDate = expiresAt.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })

    const html = this.wrapLayout(`
      <h1 style="color:#1f2937;font-size:24px;margin:0 0 16px;">Thanks, ${this.esc(customerName)}!</h1>
      <p style="color:#4b5563;font-size:16px;line-height:1.6;margin:0 0 24px;">
        As a thank you for your feedback, here's a special offer from <strong>${this.esc(businessName)}</strong>.
      </p>
      <div style="background:#f3f0ff;border:2px dashed #4f46e5;border-radius:12px;padding:24px;text-align:center;margin:0 0 24px;">
        <p style="color:#6b7280;font-size:14px;margin:0 0 8px;">Your coupon code</p>
        <p style="color:#4f46e5;font-size:32px;font-weight:700;letter-spacing:2px;margin:0 0 8px;">${this.esc(couponCode)}</p>
        <p style="color:#1f2937;font-size:20px;font-weight:600;margin:0 0 8px;">${this.esc(discount)} OFF</p>
        <p style="color:#6b7280;font-size:13px;margin:0;">Expires ${formattedDate}</p>
      </div>
      <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0;">
        Present this code at checkout to redeem your discount.
      </p>
    `)

    return this.send(to, subject, html)
  }

  // ─── Escalation Alert ─────────────────────────────────────

  async sendEscalationAlert(
    to: string,
    reviewerName: string,
    rating: number,
    reviewText: string,
    locationName: string,
    workspaceId?: string,
  ) {
    const subject = `Escalation: ${rating}-star review at ${locationName}`
    const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating)

    const html = this.wrapLayout(`
      <h1 style="color:#dc2626;font-size:24px;margin:0 0 16px;">Escalation Alert</h1>
      <p style="color:#4b5563;font-size:16px;line-height:1.6;margin:0 0 24px;">
        A review requires your attention at <strong>${this.esc(locationName)}</strong>.
      </p>
      <div style="background:#fef2f2;border-left:4px solid #dc2626;border-radius:8px;padding:20px;margin:0 0 24px;">
        <p style="color:#1f2937;font-size:16px;font-weight:600;margin:0 0 8px;">${this.esc(reviewerName)}</p>
        <p style="color:#f59e0b;font-size:20px;margin:0 0 8px;">${stars}</p>
        <p style="color:#4b5563;font-size:14px;line-height:1.6;margin:0;font-style:italic;">
          "${this.esc(reviewText.length > 300 ? reviewText.slice(0, 300) + '...' : reviewText)}"
        </p>
      </div>
      <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0;">
        Please review this feedback and take appropriate action promptly.
      </p>
    `)

    return this.send(to, subject, html)
  }

  // ─── Weekly Digest ────────────────────────────────────────

  async sendWeeklyDigest(
    to: string,
    businessName: string,
    stats: {
      totalReviews: number
      avgRating: number
      npsScore: number
      responseRate: number
    },
    workspaceId?: string,
  ) {
    const subject = `Weekly Review Digest for ${businessName}`

    const html = this.wrapLayout(`
      <h1 style="color:#1f2937;font-size:24px;margin:0 0 8px;">Weekly Digest</h1>
      <p style="color:#6b7280;font-size:14px;margin:0 0 24px;">${this.esc(businessName)}</p>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
        <tr>
          ${this.statCell('Total Reviews', String(stats.totalReviews), '#4f46e5')}
          ${this.statCell('Avg Rating', stats.avgRating.toFixed(1), '#059669')}
        </tr>
        <tr>
          ${this.statCell('NPS Score', String(stats.npsScore), '#d97706')}
          ${this.statCell('Response Rate', `${stats.responseRate}%`, '#7c3aed')}
        </tr>
      </table>
      <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0;">
        Log in to your dashboard for the full breakdown.
      </p>
    `)

    return this.send(to, subject, html)
  }

  // ─── Welcome Email ────────────────────────────────────────

  async sendWelcomeEmail(to: string, userName: string, businessName: string, workspaceId?: string) {
    const subject = `Welcome to Rectangled.io, ${userName}!`

    const html = this.wrapLayout(`
      <h1 style="color:#1f2937;font-size:24px;margin:0 0 16px;">Welcome aboard, ${this.esc(userName)}!</h1>
      <p style="color:#4b5563;font-size:16px;line-height:1.6;margin:0 0 24px;">
        You've successfully set up <strong>${this.esc(businessName)}</strong> on Rectangled.io. Here's what to do next:
      </p>
      <ol style="color:#4b5563;font-size:15px;line-height:1.8;margin:0 0 24px;padding-left:20px;">
        <li>Connect your Google Business Profile</li>
        <li>Customize your review journey</li>
        <li>Invite your team members</li>
        <li>Start collecting reviews</li>
      </ol>
      ${this.ctaButton('Go to Dashboard', 'https://app.rectangled.io/dashboard')}
    `)

    return this.send(to, subject, html)
  }

  // ─── Invite Email ─────────────────────────────────────────

  async sendInviteEmail(
    to: string,
    inviterName: string,
    businessName: string,
    inviteLink: string,
    workspaceId?: string,
  ) {
    const subject = `${inviterName} invited you to ${businessName} on Rectangled.io`

    const html = this.wrapLayout(`
      <h1 style="color:#1f2937;font-size:24px;margin:0 0 16px;">You're invited!</h1>
      <p style="color:#4b5563;font-size:16px;line-height:1.6;margin:0 0 24px;">
        <strong>${this.esc(inviterName)}</strong> has invited you to join
        <strong>${this.esc(businessName)}</strong> on Rectangled.io.
      </p>
      ${this.ctaButton('Accept Invitation', inviteLink)}
      <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:24px 0 0;">
        This invitation will expire in 7 days. If you didn't expect this email, you can safely ignore it.
      </p>
    `)

    return this.send(to, subject, html)
  }

  // ─── Password Reset ───────────────────────────────────────

  async sendPasswordResetEmail(to: string, resetLink: string, workspaceId?: string) {
    const subject = 'Reset your Rectangled.io password'

    const html = this.wrapLayout(`
      <h1 style="color:#1f2937;font-size:24px;margin:0 0 16px;">Password Reset</h1>
      <p style="color:#4b5563;font-size:16px;line-height:1.6;margin:0 0 24px;">
        We received a request to reset your password. Click the button below to choose a new one.
      </p>
      ${this.ctaButton('Reset Password', resetLink)}
      <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:24px 0 0;">
        This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.
      </p>
    `)

    return this.send(to, subject, html)
  }

  // ─── Helpers ──────────────────────────────────────────────

  private async send(to: string, subject: string, html: string, workspaceId?: string) {
    try {
      // Check for workspace-level email connector
      if (workspaceId) {
        const wsConfig = await this.getWorkspaceEmailConfig(workspaceId)
        if (wsConfig) {
          return this.sendViaWorkspaceProvider(wsConfig, to, subject, html)
        }
      }

      // Fallback to default system Resend key
      const result = await this.resend.emails.send({
        from: this.from,
        to,
        subject,
        html,
      })
      this.logger.log(`Email sent to ${to}: ${subject}`)
      return result
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}: ${(error as Error).message}`)
      throw error
    }
  }

  private async sendViaWorkspaceProvider(
    config: WorkspaceEmailConfig,
    to: string,
    subject: string,
    html: string,
  ) {
    if (config.provider === 'sendgrid') {
      const result = await this.sendGridAdapter.sendEmail(config.apiKey, {
        to,
        from: config.fromEmail,
        subject,
        html,
      })
      this.logger.log(`Email sent via SendGrid to ${to}: ${subject}`)
      return result
    }

    // Resend with customer's own key
    const customerResend = new Resend(config.apiKey)
    const result = await customerResend.emails.send({
      from: config.fromEmail,
      to,
      subject,
      html,
    })
    this.logger.log(`Email sent via customer Resend to ${to}: ${subject}`)
    return result
  }

  private esc(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  private ctaButton(text: string, href: string): string {
    return `
      <div style="text-align:center;margin:0 0 8px;">
        <a href="${href}" style="display:inline-block;background:#4f46e5;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:8px;">
          ${this.esc(text)}
        </a>
      </div>
    `
  }

  private statCell(label: string, value: string, color: string): string {
    return `
      <td width="50%" style="padding:8px;">
        <div style="background:#f9fafb;border-radius:8px;padding:16px;text-align:center;">
          <p style="color:${color};font-size:28px;font-weight:700;margin:0 0 4px;">${value}</p>
          <p style="color:#6b7280;font-size:13px;margin:0;">${label}</p>
        </div>
      </td>
    `
  }

  private wrapLayout(content: string): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <!-- Header -->
        <tr><td style="background:#4f46e5;padding:24px 32px;border-radius:12px 12px 0 0;">
          <h2 style="color:#ffffff;font-size:20px;font-weight:700;margin:0;">Rectangled.io</h2>
        </td></tr>
        <!-- Body -->
        <tr><td style="background:#ffffff;padding:32px;border-radius:0 0 12px 12px;">
          ${content}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:24px 32px;text-align:center;">
          <p style="color:#9ca3af;font-size:12px;line-height:1.6;margin:0;">
            Rectangled.io &mdash; Review management made simple.<br/>
            <a href="{{unsubscribe_url}}" style="color:#9ca3af;text-decoration:underline;">Unsubscribe</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
  }
}
