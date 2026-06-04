import { NextResponse, type NextRequest } from 'next/server'

/**
 * Middleware de autenticación — reemplaza el de Clerk.
 * Protege las rutas del portal admin verificando la cookie mc_admin_token.
 * La verificación del rol ADMIN se hace en el server component (admin)/layout.tsx.
 */

const PROTECTED = ['/dashboard', '/audit', '/specialists', '/users']

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl
  const isProtected  = PROTECTED.some(r => pathname.startsWith(r))

  if (isProtected) {
    const token = req.cookies.get('mc_admin_token')?.value
    if (!token) {
      const signIn = new URL('/sign-in', req.url)
      return NextResponse.redirect(signIn)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
