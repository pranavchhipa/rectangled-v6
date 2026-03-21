import { Injectable, Logger } from '@nestjs/common'

interface CalendarEvent {
  id?: string
  summary: string
  description?: string
  start: { dateTime: string; timeZone: string }
  end: { dateTime: string; timeZone: string }
  attendees?: Array<{ email: string; displayName?: string }>
}

interface FreeBusySlot {
  start: string
  end: string
}

@Injectable()
export class CalendarAdapter {
  private readonly logger = new Logger(CalendarAdapter.name)
  private readonly CALENDAR_API = 'https://www.googleapis.com/calendar/v3'

  getAuthUrl(redirectUrl: string, state: string): string {
    const clientId = process.env.GOOGLE_CLIENT_ID
    const scopes = [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
    ]
    const params = new URLSearchParams({
      client_id: clientId!,
      redirect_uri: redirectUrl,
      response_type: 'code',
      scope: scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state,
    })
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  }

  async exchangeCode(code: string, redirectUrl: string) {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUrl,
        grant_type: 'authorization_code',
      }),
    })
    const data = (await response.json()) as Record<string, any>
    if (!response.ok) throw new Error(`Token exchange failed: ${JSON.stringify(data)}`)
    return {
      accessToken: data.access_token as string,
      refreshToken: data.refresh_token as string,
      expiresAt: new Date(Date.now() + (data.expires_in as number) * 1000).toISOString(),
    }
  }

  async refreshAccessToken(refreshToken: string) {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: 'refresh_token',
      }),
    })
    const data = (await response.json()) as Record<string, any>
    if (!response.ok) throw new Error(`Token refresh failed: ${JSON.stringify(data)}`)
    return {
      accessToken: data.access_token as string,
      expiresAt: new Date(Date.now() + (data.expires_in as number) * 1000).toISOString(),
    }
  }

  async listCalendars(accessToken: string) {
    const response = await fetch(`${this.CALENDAR_API}/users/me/calendarList`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    const data = (await response.json()) as Record<string, any>
    return ((data.items as any[]) ?? []).map((cal: any) => ({
      id: cal.id,
      summary: cal.summary,
      primary: cal.primary ?? false,
    }))
  }

  async getFreeBusy(accessToken: string, calendarId: string, timeMin: Date, timeMax: Date): Promise<FreeBusySlot[]> {
    const response = await fetch(`${this.CALENDAR_API}/freeBusy`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        items: [{ id: calendarId }],
      }),
    })
    const data = (await response.json()) as Record<string, any>
    return (data.calendars?.[calendarId]?.busy as FreeBusySlot[]) ?? []
  }

  async createEvent(accessToken: string, calendarId: string, event: CalendarEvent) {
    const response = await fetch(
      `${this.CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      }
    )
    const data = (await response.json()) as Record<string, any>
    if (!response.ok) throw new Error(`Create event failed: ${JSON.stringify(data)}`)
    return data
  }

  async cancelEvent(accessToken: string, calendarId: string, eventId: string) {
    const response = await fetch(
      `${this.CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    )
    if (!response.ok && response.status !== 410) {
      throw new Error(`Cancel event failed: ${response.status}`)
    }
    return { success: true }
  }
}
