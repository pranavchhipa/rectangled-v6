import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Middleware runs on the edge — we can't access localStorage here.
  // Auth checks happen client-side via useAuthGuard.
  // This middleware just ensures proper routing.
  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/login'],
}
