# Ruta del backend — MailyT-Cuida (CAMSA)

## Repositorio

`https://github.com/MrFtyoQr/MailyT-CuidaLEGACY.git`

Monorepo: backend Django + app Android + iOS bajo la misma raíz.

## Carpeta raíz del proyecto Django

```
mailytcuida_backend/
├── config/
│   ├── settings/
│   │   ├── base.py
│   │   ├── development.py
│   │   └── production.py
│   ├── urls.py
│   ├── celery.py
│   └── wsgi.py
│
├── apps/
│   ├── accounts/          # Users, roles, Clerk sync
│   ├── patients/          # Perfiles paciente, relación doctor-paciente
│   ├── medications/       # Medicamentos, patrones, horarios, historial
│   ├── vitals/            # Signos vitales + labs, TimescaleDB hypertable
│   ├── prescriptions/     # Recetas digitales, resultados lab
│   ├── calendar_events/   # Eventos y recordatorios
│   ├── surveys/           # Encuestas, códigos de acceso, respuestas
│   ├── subscriptions/     # Planes FREE/SILVER/GOLD/PLATINUM, Stripe billing
│   ├── ai_engine/         # OpenAI (estándar) + Claude (PLATINUM), refs OMS
│   ├── gamification/      # Wallet de puntos, transacciones, niveles
│   ├── coupons/           # Motor de cupones: clínica + empresas externas
│   ├── store/             # Productos clínica, carrito, órdenes
│   ├── specialists/       # Nutriólogos, fisios, booking
│   ├── telemedicine/      # Link externo Zoom/Meet (fase 1, sin Twilio)
│   ├── nutrition/         # Planes de comida, seguimiento macros
│   ├── wellness/          # Sueño, agua, pasos, estado de ánimo
│   ├── notifications/     # Push, email, SMS — centro unificado
│   ├── analytics/         # Métricas, KPIs, vistas materializadas
│   ├── audit_logs/        # Panel de logs custom + sync con Sentry
│   ├── dashboard/         # Vistas doctor y especialista
│   └── partner_portal/    # Portal empresas externas (Cinepolis, farmacias…)
│
├── core/
│   ├── permissions.py     # Permisos por rol
│   ├── pagination.py
│   ├── exceptions.py
│   └── utils.py
│
└── requirements/
    ├── base.txt
    ├── development.txt
    └── production.txt
```

## Prefijo de la API REST

**`/api/v1/`**

Ejemplos del dashboard:

```
GET  /api/v1/dashboard/overview/
GET  /api/v1/dashboard/patients/
GET  /api/v1/dashboard/patients/{id}/
GET  /api/v1/dashboard/patients/{id}/vitals/?from=&to=&type=
GET  /api/v1/dashboard/patients/{id}/adherence/?period=30d
GET  /api/v1/dashboard/alerts/
GET  /api/v1/dashboard/analytics/
GET  /api/v1/dashboard/logs/?severity=&from=&to=&patient=
WS   /ws/dashboard/alerts/    ← alertas en tiempo real
```

## Decisiones arquitectónicas confirmadas

| Punto | Decisión |
|-------|----------|
| **Pagos** | Stripe Internacional + México. Sin Conekta por ahora. |
| **Mercado** | México como mercado principal; extensión a Latinoamérica es la intención futura. |
| **Modelo de negocio** | CAMSA: corporativo médico intermediario. El doctor puede agregar especialistas, clínicas y laboratorios. Comisión por booking o acceso gratuito (a definir). |
| **IA vitales** | OpenAI para planes FREE/SILVER/GOLD. Claude (Anthropic) para PLATINUM. |
| **Video consultas** | Link externo (Zoom/Meet) en fase 1. Sin Twilio/Daily.co. |
| **Repo** | `https://github.com/MrFtyoQr/MailyT-CuidaLEGACY.git` |

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Backend | Python 3.12 + Django 5.x + DRF + Channels (WebSocket) |
| DB principal | PostgreSQL 16 + TimescaleDB |
| Cache / Cola | Redis 7 |
| Workers | Celery 5 |
| Auth | Clerk (JWT + roles + Google/Apple login) |
| Logging | Sentry SDK + audit_logs custom |
| Storage | Cloudflare R2 o AWS S3 |
| Android | Kotlin/Compose (actual) + Retrofit → migrar a Django API |
| Dashboard | Django Admin customizado (fase 1) → Next.js (fase 2) |
| Infra | Docker + Nginx + Gunicorn |
| CI/CD | GitHub Actions |

## Plan de sprints (migración Firestore → PostgreSQL)

| Sprint | Acción |
|--------|--------|
| 1 | Setup Django + Postgres + Clerk + Sentry. Modelos, migraciones, endpoints Auth. |
| 2 | API Medicamentos + Vitals + sync Android. |
| 3 | Doctor Dashboard (Next.js o Django Templates). Migración datos Firestore → Postgres. |
| 4 | Custom Log Dashboard. Notificaciones (Celery + FCM/Expo Push). |
| 5 | Analytics, vistas materializadas, alertas. |
| 6 | QA, hardening seguridad, go-live. |

## Roles de usuario

- `PATIENT` → acceso solo a sus propios datos
- `DOCTOR` → acceso a sus pacientes asignados + gestión de especialistas/clínicas/laboratorios
- `SPECIALIST` (nutriólogo, fisio) → sus pacientes asignados
- `PARTNER` → portal empresas externas
- `ADMIN` → acceso total + gestión de usuarios

## Planes de membresía

| Plan | Precio | Multiplicador puntos |
|------|--------|---------------------|
| FREE | $0/mes | 1x |
| SILVER | $99/mes | 2x |
| GOLD | $249/mes | 3x |
| PLATINUM | $499/mes | 5x |
