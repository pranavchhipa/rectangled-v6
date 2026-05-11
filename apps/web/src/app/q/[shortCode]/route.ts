import { NextResponse } from 'next/server'

/**
 * QR Code scan endpoint.
 *
 * Public, unauthenticated. Records the click against the persisted
 * `qr_codes` row and 302-redirects to the destination URL. Customers
 * never see this page — it's an invisible hop between the scan and
 * the survey at /j/{slug} or /f/{slug}.
 *
 * Lookup-and-redirect goes through tRPC's `qr.recordClick` mutation
 * which atomically increments the click counter. We use the
 * httpBatchLink format (matches the client in lib/trpc.ts) so the
 * single source-of-truth for the tRPC HTTP shape stays consistent.
 */
export async function GET(
  _req: Request,
  { params }: { params: { shortCode: string } },
) {
  const shortCode = params.shortCode
  if (!shortCode) {
    return NextResponse.json({ error: 'Missing short code' }, { status: 400 })
  }

  const apiUrl =
    process.env.API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:3001'

  try {
    const res = await fetch(`${apiUrl}/trpc/qr.recordClick?batch=1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // httpBatchLink (no transformer in this codebase) expects an
      // indexed map. Input shape comes from recordQrClickSchema.
      body: JSON.stringify({ '0': { shortCode } }),
      // Bypass the Next.js fetch cache — every scan must hit the API
      // so the click counter increments. Without `no-store`, Next will
      // happily serve a memoized response and inflate nothing.
      cache: 'no-store',
    })

    if (!res.ok) {
      return notFoundResponse(shortCode)
    }

    const payload = (await res.json()) as Array<{
      result?: { data?: { destinationUrl?: string; status?: string } }
      error?: unknown
    }>

    const data = payload?.[0]?.result?.data
    if (!data?.destinationUrl) {
      return notFoundResponse(shortCode)
    }

    return NextResponse.redirect(data.destinationUrl, 302)
  } catch (err) {
    console.error('QR scan resolve failed', err)
    return NextResponse.json(
      { error: 'Service unavailable' },
      { status: 503 },
    )
  }
}

function notFoundResponse(shortCode: string) {
  // Minimal text/html so the customer sees a friendly fallback instead
  // of a raw JSON error. No branding here — the QR didn't resolve, so
  // we have no workspace context to brand against.
  return new NextResponse(
    `<!doctype html><html><head><title>Link not found</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="font-family:system-ui,sans-serif;max-width:480px;margin:64px auto;padding:24px;text-align:center;color:#11224f"><h1 style="font-size:22px;margin-bottom:8px">Link not found</h1><p style="opacity:0.7">This QR code may have been archived or the link is mistyped.</p><p style="font-size:12px;opacity:0.4;margin-top:32px">Code: ${shortCode}</p></body></html>`,
    {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    },
  )
}
