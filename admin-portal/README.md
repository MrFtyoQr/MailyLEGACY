# MailyT-Cuida — Portal de Administración

Portal web Next.js 16 para el rol ADMIN de la plataforma MailyT-Cuida CAMSA.

## Stack

| Tech | Versión |
|------|---------|
| Next.js (App Router) | 16 |
| React | 19 |
| TypeScript | 5 |
| Tailwind CSS | 4 |
| @clerk/nextjs | 7 |
| TanStack Query | 5 |
| Recharts | 3 |
| Axios | 1 |

## Setup

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
# Editar .env.local con las claves de Clerk y la URL del backend

# 3. Ejecutar en desarrollo
npm run dev
```

## Variables de entorno (.env.local)

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_API_URL=https://mailytcuida-iihlu.sevalla.app/api/v1
```

## Pantallas — Fase 1

| Ruta | Descripción |
|------|-------------|
| `/dashboard` | KPIs de la plataforma (usuarios, especialistas, suscripciones) + charts |
| `/audit` | Audit log inmutable con filtros por acción, email, recurso y fechas |

## Pantallas — Fase 2 (pendiente)

| Ruta | Descripción |
|------|-------------|
| `/specialists` | Lista de especialistas con tabs Pendiente/Verificado/Rechazado |
| `/specialists/[id]` | Perfil de especialista + botones Verificar/Rechazar |
| `/users` | Lista de todos los usuarios de la plataforma |

## Auth

Solo usuarios con `role = 'ADMIN'` en el backend tienen acceso.
El check ocurre en `app/(admin)/layout.tsx` (server component):

1. Clerk token presente → OK
2. GET `/api/v1/auth/me/` → verificar `role === 'ADMIN'`
3. Si no → redirect a `/sign-in?error=unauthorized`

## Credenciales de admin (desarrollo)

- Email: `admin@mailyt.dev`  
- Password: `Admin1234!`  
- Cambiar después del primer acceso en producción.

## Backend — endpoint nuevo

```
GET /api/v1/auth/admin/dashboard/
```

Requiere `IsAdmin`. Devuelve KPIs de usuarios, especialistas, suscripciones y referidos.  
Implementado en: `mailytcuida_backend/apps/accounts/admin_views.py`
