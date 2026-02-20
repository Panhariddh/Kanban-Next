import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('jwt'); // your cookie name

  const { pathname } = request.nextUrl;

  const isAuthPage = pathname === '/login';
  const isProtected =
    pathname.startsWith('/home') ||
    pathname.startsWith('/board');

  // Not logged in → block protected routes
  if (!token && isProtected) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // ✅ Logged in → prevent going back to login
  if (token && isAuthPage) {
    return NextResponse.redirect(new URL('/home', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/home/:path*', '/board/:path*', '/login'],
};