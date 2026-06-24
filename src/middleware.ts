import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Only redirect to HTTPS when the request explicitly came through HTTP
  // via a reverse proxy (x-forwarded-proto: http).  Skip when the header is
  // absent (internal health checks, direct container traffic) so the deploy
  // healthchecker can probe us successfully.
  if (
    process.env.NODE_ENV === 'production' &&
    request.headers.get('x-forwarded-proto') === 'http' &&
    !request.url.includes('localhost')
  ) {
    const httpsUrl = request.url.replace(/^http:/, 'https:');
    return NextResponse.redirect(httpsUrl, 301);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};