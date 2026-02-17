import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if user is authenticated by looking for the session cookie
  const sessionCookie = request.cookies.get('udayam.session_token');
  const isAuthenticated = !!sessionCookie;

  // Public paths that don't require authentication
  const publicPaths = ['/', '/login', '/signup', '/auth/callback'];
  const isPublicPath = publicPaths.includes(pathname);

  // If trying to access protected route without authentication, redirect to login
  if (!isPublicPath && !isAuthenticated) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // If authenticated and trying to access login/signup, redirect to dashboard
  if (isAuthenticated && (pathname === '/login' || pathname === '/signup')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/login', '/signup', '/auth/callback', '/dashboard/:path*'],
};
