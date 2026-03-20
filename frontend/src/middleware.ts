import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME } from './lib/auth-cookies';

export function middleware(request: NextRequest) {
  const hasAccessCookie = request.cookies.has(ACCESS_COOKIE_NAME);
  const hasRefreshCookie = request.cookies.has(REFRESH_COOKIE_NAME);

  if (hasAccessCookie || hasRefreshCookie) {
    return NextResponse.next();
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = '/login';
  loginUrl.searchParams.set('next', `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
