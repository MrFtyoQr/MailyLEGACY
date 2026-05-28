const pptxgen = require("pptxgenjs");

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9"; // 10" x 5.625"
pres.title = "MailyT-Cuida — Estado actual y propuesta de unificación";
pres.author = "MailyT-Cuida Team";

// ── Paleta ────────────────────────────────────────────────────────────────────
const C = {
  dark:    "0F172A",
  navy:    "1E293B",
  cyan:    "00C5E3",
  cyanDim: "0891B2",
  light:   "F8FAFC",
  white:   "FFFFFF",
  border:  "E2E8F0",
  muted:   "64748B",
  text:    "1E293B",
  green:   "10B981",
  amber:   "F59E0B",
  red:     "EF4444",
  orange:  "F97316",
  purple:  "8B5CF6",
  slate:   "475569",
};

const makeShadow = () => ({
  type: "outer", blur: 8, offset: 2, angle: 135, color: "000000", opacity: 0.10
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function darkSlide(s) {
  s.background = { color: C.dark };
}

function lightSlide(s) {
  s.background = { color: C.light };
}

// Barra superior cyan para slides de contenido
function topBar(s, label) {
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 0.07, fill: { color: C.cyan }, line: { color: C.cyan } });
  if (label) {
    s.addText(label.toUpperCase(), {
      x: 0.45, y: 0.14, w: 9, h: 0.28,
      fontSize: 8, color: C.cyan, bold: true, charSpacing: 3, align: "left", margin: 0,
    });
  }
}

// Título principal de slide de contenido
function slideTitle(s, title) {
  s.addText(title, {
    x: 0.45, y: 0.5, w: 9.1, h: 0.55,
    fontSize: 24, fontFace: "Calibri", bold: true, color: C.text, align: "left", margin: 0,
  });
}

// Tarjeta KPI
function kpiCard(s, x, y, w, h, num, label, accent, sub) {
  s.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: C.white }, line: { color: C.border, width: 0.5 }, shadow: makeShadow() });
  s.addShape(pres.shapes.RECTANGLE, { x, y, w: 0.05, h, fill: { color: accent }, line: { color: accent } });
  s.addText(num, { x: x + 0.15, y: y + 0.13, w: w - 0.2, h: 0.48, fontSize: 30, fontFace: "Calibri", bold: true, color: accent, align: "left", margin: 0 });
  s.addText(label, { x: x + 0.15, y: y + 0.58, w: w - 0.2, h: 0.22, fontSize: 11, fontFace: "Calibri", color: C.navy, bold: true, align: "left", margin: 0 });
  if (sub) s.addText(sub, { x: x + 0.15, y: y + 0.78, w: w - 0.2, h: 0.18, fontSize: 9, fontFace: "Calibri", color: C.muted, align: "left", margin: 0 });
}

// Tarjeta de módulo
function modCard(s, x, y, w, h, name, status) {
  const col = status === "✓" ? C.green : status === "~" ? C.amber : C.slate;
  s.addShape(pres.shapes.RECTANGLE, { x, y, w, h, fill: { color: C.white }, line: { color: col, width: 0.8 } });
  s.addText(name, { x: x + 0.07, y: y + 0.05, w: w - 0.1, h: 0.22, fontSize: 8.5, fontFace: "Calibri", color: C.navy, bold: true, align: "left", margin: 0 });
  s.addShape(pres.shapes.OVAL, { x: x + w - 0.2, y: y + 0.05, w: 0.13, h: 0.13, fill: { color: col }, line: { color: col } });
}

// Badge de esfuerzo/prioridad
function badge(s, x, y, label, color) {
  s.addShape(pres.shapes.RECTANGLE, { x, y, w: 0.7, h: 0.22, fill: { color: color }, line: { color: color }, rectRadius: 0.04 });
  s.addText(label, { x, y: y + 0.02, w: 0.7, h: 0.18, fontSize: 8, fontFace: "Calibri", color: C.white, bold: true, align: "center", margin: 0 });
}

// Fila de cambio propuesto
function cambioRow(s, x, y, w, code, titulo, esfuerzo, color) {
  s.addShape(pres.shapes.RECTANGLE, { x, y, w, h: 0.35, fill: { color: C.white }, line: { color: C.border, width: 0.5 }, shadow: makeShadow() });
  s.addShape(pres.shapes.RECTANGLE, { x, y, w: 0.05, h: 0.35, fill: { color: color }, line: { color: color } });
  s.addText(code, { x: x + 0.12, y: y + 0.08, w: 0.3, h: 0.2, fontSize: 9, fontFace: "Calibri", bold: true, color: color, align: "left", margin: 0 });
  s.addText(titulo, { x: x + 0.5, y: y + 0.08, w: w - 1.1, h: 0.2, fontSize: 10, fontFace: "Calibri", color: C.text, align: "left", margin: 0 });
  s.addText(esfuerzo, { x: x + w - 0.55, y: y + 0.08, w: 0.5, h: 0.2, fontSize: 9, fontFace: "Calibri", bold: true, color: color, align: "right", margin: 0 });
}


// ════════════════════════════════════════════════════════════════════
// SLIDE 1 — Portada
// ════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  darkSlide(s);

  // Banda lateral cyan izquierda
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.35, h: 5.625, fill: { color: C.cyan }, line: { color: C.cyan } });

  // Logo / nombre grande
  s.addText("MailyT-Cuida", {
    x: 0.6, y: 1.3, w: 8.5, h: 1.1,
    fontSize: 52, fontFace: "Calibri", bold: true, color: C.white, align: "left", margin: 0,
  });
  s.addText("Estado actual del sistema", {
    x: 0.6, y: 2.45, w: 8.5, h: 0.5,
    fontSize: 22, fontFace: "Calibri", color: C.cyan, align: "left", margin: 0,
  });
  s.addText("y propuesta de unificación a Maily Platform", {
    x: 0.6, y: 2.9, w: 8.5, h: 0.45,
    fontSize: 18, fontFace: "Calibri", color: "94A3B8", align: "left", margin: 0,
  });

  // Línea divisora
  s.addShape(pres.shapes.LINE, { x: 0.6, y: 3.45, w: 5, h: 0, line: { color: C.cyan, width: 1.5 } });

  // Fecha y versión
  s.addText("Mayo 2026  ·  v0.1", {
    x: 0.6, y: 3.65, w: 6, h: 0.28,
    fontSize: 11, fontFace: "Calibri", color: "475569", align: "left", margin: 0,
  });

  // Tags
  const tags = ["Backend Django", "App Móvil React Native", "Admin Portal Next.js"];
  tags.forEach((t, i) => {
    const tx = 0.6 + i * 2.8;
    s.addShape(pres.shapes.RECTANGLE, { x: tx, y: 4.1, w: 2.5, h: 0.3, fill: { color: "1E293B" }, line: { color: "334155", width: 0.5 } });
    s.addText(t, { x: tx, y: 4.13, w: 2.5, h: 0.24, fontSize: 9.5, fontFace: "Calibri", color: "94A3B8", align: "center", margin: 0 });
  });
}


// ════════════════════════════════════════════════════════════════════
// SLIDE 2 — Resumen ejecutivo: lo que tenemos
// ════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  lightSlide(s);
  topBar(s, "Resumen ejecutivo");
  slideTitle(s, "Lo que tenemos hoy");

  // 4 KPI cards en fila
  kpiCard(s, 0.3,  1.2, 2.15, 1.15, "22",  "Módulos de backend",  C.cyan,   "Django REST Framework");
  kpiCard(s, 2.62, 1.2, 2.15, 1.15, "15+", "Pantallas mobile",    C.green,  "React Native / Expo");
  kpiCard(s, 4.94, 1.2, 2.15, 1.15, "80%", "Completitud del back",C.orange, "~7/10 calidad técnica");
  kpiCard(s, 7.26, 1.2, 2.15, 1.15, "2",   "Portales conectados", C.purple, "Mobile + Admin Web");

  // Descripción en 2 columnas
  s.addText("El sistema actual", {
    x: 0.3, y: 2.6, w: 4.5, h: 0.3, fontSize: 13, fontFace: "Calibri", bold: true, color: C.navy, align: "left", margin: 0,
  });
  s.addText([
    { text: "MailyT-Cuida es una plataforma de salud B2C para pacientes crónicos. El backend en Django REST Framework gestiona 22 módulos independientes incluyendo vitales, medicamentos, citas, gamificación, documentos médicos, IA de análisis y más.", options: { breakLine: false } }
  ], {
    x: 0.3, y: 2.95, w: 4.5, h: 1.1,
    fontSize: 11, fontFace: "Calibri", color: C.slate, align: "left",
  });

  s.addText("Estado general", {
    x: 5.2, y: 2.6, w: 4.5, h: 0.3, fontSize: 13, fontFace: "Calibri", bold: true, color: C.navy, align: "left", margin: 0,
  });

  const items = [
    { text: "Backend: 22/22 módulos implementados", color: C.green },
    { text: "Auth con Clerk JWT + webhooks de sincronización", color: C.green },
    { text: "App móvil: conectada al 85% de endpoints clave", color: C.amber },
    { text: "Admin portal web (Next.js 16) — Fase 1 lista", color: C.green },
    { text: "Multi-tenant: no implementado (arquitectura B2C)", color: C.orange },
    { text: "3 issues de seguridad identificados externamente", color: C.red },
  ];
  items.forEach((item, i) => {
    const dotY = 3.05 + i * 0.32;
    s.addShape(pres.shapes.OVAL, { x: 5.2, y: dotY + 0.06, w: 0.1, h: 0.1, fill: { color: item.color }, line: { color: item.color } });
    s.addText(item.text, { x: 5.38, y: dotY, w: 4.2, h: 0.25, fontSize: 10.5, fontFace: "Calibri", color: C.navy, align: "left", margin: 0 });
  });
}


// ════════════════════════════════════════════════════════════════════
// SLIDE 3 — Stack técnico
// ════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  lightSlide(s);
  topBar(s, "Arquitectura actual");
  slideTitle(s, "Stack técnico del sistema");

  const cols = [
    {
      title: "Backend API",
      color: C.cyan,
      items: ["Django 5.1 + DRF", "PostgreSQL + Redis", "Celery (tareas async)", "Cloudflare R2 (media)", "Clerk JWT auth", "Stripe (pagos)", "OpenAI / Claude IA", "Sevalla (hosting)"],
    },
    {
      title: "App Móvil",
      color: C.orange,
      items: ["React Native + Expo", "TypeScript", "TanStack Query v5", "Expo Router (file-based)", "Clerk expo SDK", "Axios + interceptors", "Zustand (estado global)", "expo-document-picker"],
    },
    {
      title: "Admin Portal",
      color: C.purple,
      items: ["Next.js 16 (App Router)", "TypeScript + Tailwind v4", "Clerk Next.js v7", "TanStack Query v5", "Recharts (gráficas)", "Axios", "Protegido: rol ADMIN", "Fase 2: especialistas"],
    },
  ];

  cols.forEach((col, ci) => {
    const cx = 0.3 + ci * 3.2;
    s.addShape(pres.shapes.RECTANGLE, { x: cx, y: 1.25, w: 3.0, h: 3.85, fill: { color: C.white }, line: { color: col.color, width: 1 }, shadow: makeShadow() });
    s.addShape(pres.shapes.RECTANGLE, { x: cx, y: 1.25, w: 3.0, h: 0.38, fill: { color: col.color }, line: { color: col.color } });
    s.addText(col.title, { x: cx, y: 1.28, w: 3.0, h: 0.32, fontSize: 13, fontFace: "Calibri", bold: true, color: C.white, align: "center", margin: 0 });
    col.items.forEach((item, ii) => {
      s.addShape(pres.shapes.OVAL, { x: cx + 0.18, y: 1.77 + ii * 0.38 + 0.06, w: 0.08, h: 0.08, fill: { color: col.color }, line: { color: col.color } });
      s.addText(item, { x: cx + 0.32, y: 1.77 + ii * 0.38, w: 2.6, h: 0.3, fontSize: 10, fontFace: "Calibri", color: C.navy, align: "left", margin: 0 });
    });
  });
}


// ════════════════════════════════════════════════════════════════════
// SLIDE 4 — Los 22 módulos del backend
// ════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  lightSlide(s);
  topBar(s, "Backend — módulos");
  slideTitle(s, "22 módulos implementados");

  // Leyenda
  [
    { col: C.green, label: "Conectado al mobile" },
    { col: C.amber, label: "Parcial / en proceso" },
    { col: C.slate, label: "Backend only" },
  ].forEach((l, i) => {
    const lx = 0.45 + i * 2.5;
    s.addShape(pres.shapes.OVAL, { x: lx, y: 1.2, w: 0.13, h: 0.13, fill: { color: l.col }, line: { color: l.col } });
    s.addText(l.label, { x: lx + 0.18, y: 1.16, w: 2.2, h: 0.22, fontSize: 9, fontFace: "Calibri", color: C.muted, align: "left", margin: 0 });
  });

  const modules = [
    // [nombre, status]  ✓=done ~=partial
    ["M01 Auth",          "✓"], ["M02 Perfiles",     "✓"], ["M03 Vitales",       "✓"],
    ["M04 Medicamentos",  "✓"], ["M05 Lab Results",  "✓"], ["M06 Citas",         "✓"],
    ["M07 Notificaciones","✓"], ["M08 Chat",         "~"], ["M09 Pagos",         "~"],
    ["M10 Analytics IA",  "✓"], ["M11 Documentos",   "✓"], ["M12 Audit Log",     "~"],
    ["M13 Recetas",       "✓"], ["M14 Especialistas","~"], ["M15 Gamificación",  "✓"],
    ["M16 Partners",      " "], ["M17 Cupones",      " "], ["M18 Telemedicina",  " "],
    ["M19 Encuestas",     " "], ["M20 Nutrición",    " "], ["M21 Wellness",      "✓"],
    ["M22 Familia",       "✓"],
  ];

  const cols = 7;
  const cw = 1.28, ch = 0.52, gap = 0.06;
  const startX = 0.28, startY = 1.48;

  modules.forEach(([name, st], i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    modCard(s, startX + col * (cw + gap), startY + row * (ch + gap), cw, ch, name, st);
  });

  // Resumen
  s.addText("11 conectados al móvil  ·  5 parciales  ·  6 pendientes de pantalla", {
    x: 0.3, y: 5.2, w: 9.4, h: 0.25,
    fontSize: 9.5, fontFace: "Calibri", color: C.muted, align: "center", margin: 0,
  });
}


// ════════════════════════════════════════════════════════════════════
// SLIDE 5 — App móvil: pantallas
// ════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  lightSlide(s);
  topBar(s, "App móvil — React Native / Expo");
  slideTitle(s, "Pantallas implementadas y conectadas");

  const secciones = [
    { title: "Auth & Onboarding", color: C.cyan,   items: ["sign-in / sign-up", "role-setup (3 roles)", "Redirección por rol"] },
    { title: "Dashboard & Vitales",color: C.green,  items: ["Home con IA insights", "Registro multi-vital", "Historial + fotos OCR", "Metas personales"] },
    { title: "Medicamentos & Labs",color: C.orange, items: ["Lista + calendario", "Tomar / omitir / postponer", "Resultados de laboratorio", "Subida de PDF a R2"] },
    { title: "Citas & Notifs",     color: C.purple, items: ["Próxima cita en home", "Cancelar / confirmar", "Centro de notificaciones", "Contador unread"] },
    { title: "Bienestar",          color: C.amber,  items: ["Check-in diario", "Registro sueño / ánimo", "Gráfica de ánimo", "Programas de bienestar"] },
    { title: "Perfil & Extras",    color: C.cyanDim,items: ["Gamificación + estrellas", "Documentos médicos", "Familia (cuidadores)", "Plan de suscripción"] },
  ];

  const cols = 3;
  const cw = 2.9, ch = 1.45, gapX = 0.3, gapY = 0.2;
  const startX = 0.3, startY = 1.2;

  secciones.forEach((sec, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = startX + col * (cw + gapX);
    const cy = startY + row * (ch + gapY);

    s.addShape(pres.shapes.RECTANGLE, { x: cx, y: cy, w: cw, h: ch, fill: { color: C.white }, line: { color: sec.color, width: 0.8 }, shadow: makeShadow() });
    s.addShape(pres.shapes.RECTANGLE, { x: cx, y: cy, w: cw, h: 0.3, fill: { color: sec.color }, line: { color: sec.color } });
    s.addText(sec.title, { x: cx, y: cy + 0.04, w: cw, h: 0.22, fontSize: 10, fontFace: "Calibri", bold: true, color: C.white, align: "center", margin: 0 });
    sec.items.forEach((item, ii) => {
      s.addText("›  " + item, { x: cx + 0.12, y: cy + 0.38 + ii * 0.25, w: cw - 0.2, h: 0.22, fontSize: 9.5, fontFace: "Calibri", color: C.navy, align: "left", margin: 0 });
    });
  });
}


// ════════════════════════════════════════════════════════════════════
// SLIDE 6 — Admin Portal
// ════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: "0F172A" };

  // Banda superior
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 0.07, fill: { color: C.purple }, line: { color: C.purple } });
  s.addText("ADMIN PORTAL WEB — FASE 1 COMPLETADA", {
    x: 0.45, y: 0.14, w: 9, h: 0.28,
    fontSize: 8, color: C.purple, bold: true, charSpacing: 3, align: "left", margin: 0,
  });
  s.addText("Portal de Administración", {
    x: 0.45, y: 0.55, w: 9, h: 0.55,
    fontSize: 26, fontFace: "Calibri", bold: true, color: C.white, align: "left", margin: 0,
  });
  s.addText("Next.js 16 + Clerk + TanStack Query + Recharts · admin-portal/", {
    x: 0.45, y: 1.12, w: 9, h: 0.3,
    fontSize: 11, fontFace: "Calibri", color: "94A3B8", align: "left", margin: 0,
  });

  // 2 pantallas implementadas
  const screens = [
    {
      title: "Dashboard KPIs",
      icon: "📊",
      items: ["4 tarjetas KPI (usuarios, especialistas, suscripciones, hoy)", "PieChart de usuarios por rol", "BarChart de suscripciones por tier", "Endpoint nuevo: GET /auth/admin/dashboard/"],
    },
    {
      title: "Audit Log",
      icon: "📋",
      items: ["Tabla paginada (50 registros/pág)", "Filtros: acción, email, recurso, fechas", "Badges por status HTTP (2xx verde / 4xx rojo)", "Rows de error destacados en rojo tenue"],
    },
  ];

  screens.forEach((sc, i) => {
    const sx = 0.45 + i * 4.65;
    s.addShape(pres.shapes.RECTANGLE, { x: sx, y: 1.58, w: 4.35, h: 3.55, fill: { color: "1E293B" }, line: { color: "334155", width: 0.5 }, shadow: makeShadow() });
    s.addShape(pres.shapes.RECTANGLE, { x: sx, y: 1.58, w: 4.35, h: 0.4, fill: { color: C.purple }, line: { color: C.purple } });
    s.addText(sc.icon + "  " + sc.title, { x: sx + 0.15, y: 1.62, w: 4.1, h: 0.32, fontSize: 13, fontFace: "Calibri", bold: true, color: C.white, align: "left", margin: 0 });
    sc.items.forEach((item, ii) => {
      s.addShape(pres.shapes.OVAL, { x: sx + 0.2, y: 2.15 + ii * 0.68 + 0.06, w: 0.1, h: 0.1, fill: { color: C.purple }, line: { color: C.purple } });
      s.addText(item, { x: sx + 0.38, y: 2.13 + ii * 0.68, w: 3.8, h: 0.52, fontSize: 10, fontFace: "Calibri", color: "CBD5E1", align: "left", margin: 0 });
    });
  });

  // Auth note
  s.addText("🔐  Guard de rol ADMIN: verifica en el backend en cada carga de página", {
    x: 0.45, y: 5.2, w: 9.1, h: 0.25,
    fontSize: 9.5, fontFace: "Calibri", color: "64748B", align: "center", margin: 0,
  });
}


// ════════════════════════════════════════════════════════════════════
// SLIDE 7 — El diagnóstico externo (divider oscuro)
// ════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.navy };

  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.08, h: 5.625, fill: { color: C.cyan }, line: { color: C.cyan } });

  s.addText("SECCIÓN 2", {
    x: 0.5, y: 1.4, w: 9, h: 0.3,
    fontSize: 11, fontFace: "Calibri", color: C.cyan, bold: true, charSpacing: 4, align: "left", margin: 0,
  });
  s.addText("El diagnóstico externo", {
    x: 0.5, y: 1.75, w: 9, h: 0.85,
    fontSize: 42, fontFace: "Calibri", bold: true, color: C.white, align: "left", margin: 0,
  });
  s.addText("Análisis de \"joseph cambios.pdf\" — Plan de Unificación del Backend", {
    x: 0.5, y: 2.7, w: 9, h: 0.4,
    fontSize: 16, fontFace: "Calibri", color: "94A3B8", align: "left", margin: 0,
  });

  // Rating card
  s.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: 3.3, w: 9, h: 1.6, fill: { color: "0F172A" }, line: { color: "334155", width: 0.5 } });
  s.addText("Calificación del sistema actual:", { x: 0.8, y: 3.5, w: 4, h: 0.3, fontSize: 11, fontFace: "Calibri", color: "94A3B8", align: "left", margin: 0 });
  s.addText("7 / 10", { x: 0.8, y: 3.8, w: 2.5, h: 0.7, fontSize: 44, fontFace: "Calibri", bold: true, color: C.cyan, align: "left", margin: 0 });
  s.addText("calidad técnica", { x: 3.1, y: 4.0, w: 2.5, h: 0.35, fontSize: 12, fontFace: "Calibri", color: "94A3B8", align: "left", margin: 0 });

  s.addText("~80% completo", { x: 5.5, y: 3.5, w: 3.5, h: 0.3, fontSize: 11, fontFace: "Calibri", color: "94A3B8", align: "left", margin: 0 });
  s.addText("80%", { x: 5.5, y: 3.78, w: 2, h: 0.65, fontSize: 40, fontFace: "Calibri", bold: true, color: C.green, align: "left", margin: 0 });
  s.addText("completitud", { x: 7.3, y: 4.0, w: 2, h: 0.35, fontSize: 12, fontFace: "Calibri", color: "94A3B8", align: "left", margin: 0 });
}


// ════════════════════════════════════════════════════════════════════
// SLIDE 8 — Mapa de brechas: hoy vs. objetivo
// ════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  lightSlide(s);
  topBar(s, "Propuesta de unificación — contexto");
  slideTitle(s, "Hoy vs. Objetivo: Maily Platform");

  const rows = [
    ["Multi-tenant",      "No existe",                         "Toda entidad con tenant_id + RLS"],
    ["Identidad",         "1:1 usuario ↔ paciente (1 clínica)","Global (MPI) — múltiples clínicas"],
    ["Especialidades",    "Apps Django fijas hardcodeadas",     "Plugins + JSON Schema por especialidad"],
    ["Autenticación",     "Clerk acoplado directamente",        "JWT propio o Clerk tras abstracción"],
    ["Modelo de negocio", "B2C mensual (paciente paga)",        "B2B anual (clínica) + B2C opcional"],
    ["Arquitectura",      "Lógica en views/serializers",        "Capa services / selectors"],
  ];

  // Headers
  const headers = ["Dimensión", "HOY — MailyT-Cuida", "OBJETIVO — Maily Platform"];
  const colW = [1.8, 3.6, 3.6];
  const colX = [0.3, 2.15, 5.8];

  // Header row
  [C.slate, C.orange, C.cyan].forEach((col, ci) => {
    s.addShape(pres.shapes.RECTANGLE, { x: colX[ci], y: 1.25, w: colW[ci], h: 0.35, fill: { color: col }, line: { color: col } });
    s.addText(headers[ci], { x: colX[ci], y: 1.28, w: colW[ci], h: 0.28, fontSize: 10, fontFace: "Calibri", bold: true, color: C.white, align: "center", margin: 0 });
  });

  rows.forEach((row, ri) => {
    const ry = 1.65 + ri * 0.57;
    const bgCol = ri % 2 === 0 ? C.white : "F1F5F9";
    s.addShape(pres.shapes.RECTANGLE, { x: 0.3, y: ry, w: 9.1, h: 0.52, fill: { color: bgCol }, line: { color: C.border, width: 0.3 } });

    // Dimension
    s.addText(row[0], { x: colX[0] + 0.1, y: ry + 0.13, w: colW[0] - 0.15, h: 0.26, fontSize: 10, fontFace: "Calibri", bold: true, color: C.navy, align: "left", margin: 0 });
    // Hoy
    s.addText(row[1], { x: colX[1] + 0.1, y: ry + 0.13, w: colW[1] - 0.15, h: 0.26, fontSize: 9.5, fontFace: "Calibri", color: C.slate, align: "left", margin: 0 });
    // Objetivo
    s.addText(row[2], { x: colX[2] + 0.1, y: ry + 0.13, w: colW[2] - 0.15, h: 0.26, fontSize: 9.5, fontFace: "Calibri", color: C.cyanDim, bold: true, align: "left", margin: 0 });
  });
}


// ════════════════════════════════════════════════════════════════════
// SLIDE 9 — Los 9 cambios propuestos
// ════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  lightSlide(s);
  topBar(s, "Propuesta de unificación — bloques de cambio");
  slideTitle(s, "Los 9 cambios propuestos");

  const cambios = [
    ["C1", "Modelo base abstracto + multi-tenant (tenant_id en todo)",            "ALTO",  C.red],
    ["C2", "Identidad global del paciente — Master Patient Index (MPI)",           "ALTO",  C.red],
    ["C3", "Especialidades como sistema de plugins (JSON Schema)",                  "MEDIO", C.amber],
    ["C4", "Auth unificada (Clerk → JWT propio o abstracción)",                    "MEDIO", C.amber],
    ["C5", "Modelo de negocio unificado (B2B clínica + B2C paciente premium)",     "MEDIO", C.amber],
    ["C6", "Capa de servicios/selectors (alinear arquitectura interna)",            "MEDIO", C.amber],
    ["C7", "Resolver solapamiento de apps con Maily Soft (dueño del dato)",        "ALTO",  C.red],
    ["C8", "🔴 Correcciones de seguridad BLOQUEANTES (JWT, webhook, Sentry)",      "BAJO",  C.red],
    ["C9", "Calidad y herramientas (mypy, N+1, factory_boy, pyproject.toml)",      "BAJO",  C.green],
  ];

  cambios.forEach(([code, title, effort, color], i) => {
    const col = i < 5 ? 0 : 1;
    const row = i < 5 ? i : i - 5;
    const cx = col === 0 ? 0.3 : 5.1;
    const cy = 1.25 + row * 0.78;
    const w  = 4.55;

    cambioRow(s, cx, cy, w, code, title, effort, color);
  });

  // Estimación
  s.addShape(pres.shapes.RECTANGLE, { x: 0.3, y: 5.1, w: 9.4, h: 0.3, fill: { color: "EFF6FF" }, line: { color: "BFDBFE", width: 0.5 } });
  s.addText("⏱  Estimación con 2 devs senior: 6-10 semanas de refactor para base unificada estable", {
    x: 0.4, y: 5.13, w: 9.2, h: 0.23,
    fontSize: 9.5, fontFace: "Calibri", color: C.cyanDim, align: "center", margin: 0,
  });
}


// ════════════════════════════════════════════════════════════════════
// SLIDE 10 — C8: Seguridad urgente
// ════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: "FFF5F5" };

  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 0.07, fill: { color: C.red }, line: { color: C.red } });
  s.addText("C8 — BLOQUEANTE · HACER ESTA SEMANA", {
    x: 0.45, y: 0.14, w: 9, h: 0.28,
    fontSize: 8, color: C.red, bold: true, charSpacing: 3, align: "left", margin: 0,
  });
  s.addText("Seguridad: 3 hallazgos críticos", {
    x: 0.45, y: 0.55, w: 9, h: 0.55,
    fontSize: 26, fontFace: "Calibri", bold: true, color: C.text, align: "left", margin: 0,
  });

  const findings = [
    {
      sev: "CRÍTICO",
      sevCol: C.red,
      code: "A1",
      title: "Webhook omite la firma si no hay secreto",
      detail: "Usa una variable de entorno inexistente → acepta requests sin validar → se pueden falsificar recetas",
      fix: "Fallar cerrado: rechazar si no hay secreto. Usar la variable ENVIRONMENT correcta. Exigir secreto en producción.",
    },
    {
      sev: "CRÍTICO",
      sevCol: C.red,
      code: "A2",
      title: "JWT de Clerk no valida iss ni azp",
      detail: "Acepta tokens de cualquier instancia de Clerk → acceso no autorizado posible",
      fix: "Validar issuer y authorized-party en el middleware ClerkAuthMiddleware. Cachear JWKS con TTL.",
    },
    {
      sev: "MEDIO",
      sevCol: C.amber,
      code: "M1",
      title: "DSN de Sentry hardcodeado en base.py",
      detail: "Datos de telemetría expuestos en el código fuente",
      fix: "Mover a variable de entorno. Rotar el DSN actual.",
    },
    {
      sev: "BUG",
      sevCol: C.orange,
      code: "Bug",
      title: "notify() no acepta extra_data → TypeError en runtime",
      detail: "Notificaciones que nunca se mandan sin error visible",
      fix: "Corregir la firma de notify() + añadir test de regresión.",
    },
  ];

  findings.forEach((f, i) => {
    const fy = 1.27 + i * 0.97;
    s.addShape(pres.shapes.RECTANGLE, { x: 0.3, y: fy, w: 9.4, h: 0.88, fill: { color: C.white }, line: { color: f.sevCol, width: 0.8 }, shadow: makeShadow() });
    s.addShape(pres.shapes.RECTANGLE, { x: 0.3, y: fy, w: 0.06, h: 0.88, fill: { color: f.sevCol }, line: { color: f.sevCol } });
    // sev badge
    s.addShape(pres.shapes.RECTANGLE, { x: 0.5, y: fy + 0.08, w: 0.7, h: 0.2, fill: { color: f.sevCol }, line: { color: f.sevCol } });
    s.addText(f.sev, { x: 0.5, y: fy + 0.1, w: 0.7, h: 0.16, fontSize: 7.5, fontFace: "Calibri", bold: true, color: C.white, align: "center", margin: 0 });
    s.addText(f.code + " · " + f.title, { x: 1.28, y: fy + 0.08, w: 7.5, h: 0.24, fontSize: 11, fontFace: "Calibri", bold: true, color: C.navy, align: "left", margin: 0 });
    s.addText("⚠ " + f.detail, { x: 1.28, y: fy + 0.32, w: 7.5, h: 0.22, fontSize: 9.5, fontFace: "Calibri", color: C.slate, align: "left", margin: 0 });
    s.addText("✓ " + f.fix, { x: 1.28, y: fy + 0.56, w: 7.5, h: 0.22, fontSize: 9.5, fontFace: "Calibri", color: C.green, align: "left", margin: 0 });
  });
}


// ════════════════════════════════════════════════════════════════════
// SLIDE 11 — La gran decisión: Unificar vs. API entre backends
// ════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  lightSlide(s);
  topBar(s, "Decisión estratégica");
  slideTitle(s, "¿Unificar o dos backends por API?");

  // Opción A
  s.addShape(pres.shapes.RECTANGLE, { x: 0.3, y: 1.2, w: 4.35, h: 3.95, fill: { color: C.white }, line: { color: C.orange, width: 1.2 }, shadow: makeShadow() });
  s.addShape(pres.shapes.RECTANGLE, { x: 0.3, y: 1.2, w: 4.35, h: 0.42, fill: { color: C.orange }, line: { color: C.orange } });
  s.addText("Opción A — UN backend unificado", { x: 0.3, y: 1.25, w: 4.35, h: 0.32, fontSize: 12, fontFace: "Calibri", bold: true, color: C.white, align: "center", margin: 0 });

  const opA = [
    ["✓", "Una sola base de código a largo plazo", C.green],
    ["✓", "Multi-tenant real + MPI global", C.green],
    ["✓", "Un sistema de cobro y auth", C.green],
    ["✗", "6-10 semanas de refactor", C.red],
    ["✗", "Pausa total de features nuevas", C.red],
    ["✗", "Requiere que Maily Soft exista ya", C.red],
    ["✗", "Riesgo de romper producción", C.red],
    ["!", "Este documento asume esta opción", C.amber],
  ];
  opA.forEach(([icon, text, col], ii) => {
    s.addText(icon, { x: 0.5, y: 1.75 + ii * 0.38, w: 0.22, h: 0.28, fontSize: 11, fontFace: "Calibri", bold: true, color: col, align: "center", margin: 0 });
    s.addText(text, { x: 0.78, y: 1.77 + ii * 0.38, w: 3.7, h: 0.26, fontSize: 10, fontFace: "Calibri", color: C.navy, align: "left", margin: 0 });
  });

  // Opción B
  s.addShape(pres.shapes.RECTANGLE, { x: 5.2, y: 1.2, w: 4.5, h: 3.95, fill: { color: C.white }, line: { color: C.cyan, width: 1.2 }, shadow: makeShadow() });
  s.addShape(pres.shapes.RECTANGLE, { x: 5.2, y: 1.2, w: 4.5, h: 0.42, fill: { color: C.cyan }, line: { color: C.cyan } });
  s.addText("Opción B — Dos backends por API", { x: 5.2, y: 1.25, w: 4.5, h: 0.32, fontSize: 12, fontFace: "Calibri", bold: true, color: C.white, align: "center", margin: 0 });

  const opB = [
    ["✓", "Desarrollo de features no se pausa", C.green],
    ["✓", "Menor riesgo para usuarios actuales", C.green],
    ["✓", "Equivale a microservicios (patrón válido)", C.green],
    ["✓", "Integración gradual cuando Maily Soft madure", C.green],
    ["✗", "Dos codebases que mantener", C.red],
    ["✗", "Contratos de API adicionales", C.red],
    ["!", "Recomendado para equipo pequeño", C.cyan],
    ["!", "Especialmente si Maily Soft no existe aún", C.cyan],
  ];
  opB.forEach(([icon, text, col], ii) => {
    s.addText(icon, { x: 5.38, y: 1.75 + ii * 0.38, w: 0.22, h: 0.28, fontSize: 11, fontFace: "Calibri", bold: true, color: col, align: "center", margin: 0 });
    s.addText(text, { x: 5.66, y: 1.77 + ii * 0.38, w: 3.85, h: 0.26, fontSize: 10, fontFace: "Calibri", color: C.navy, align: "left", margin: 0 });
  });

  // Pregunta clave
  s.addShape(pres.shapes.RECTANGLE, { x: 0.3, y: 5.15, w: 9.4, h: 0.28, fill: { color: "EFF6FF" }, line: { color: "BFDBFE", width: 0.5 } });
  s.addText("🔑  Pregunta clave: ¿Existe Maily Soft como codebase activo hoy? Si no — la Opción B es la correcta.", {
    x: 0.4, y: 5.18, w: 9.2, h: 0.22,
    fontSize: 9.5, fontFace: "Calibri", color: C.cyanDim, bold: true, align: "center", margin: 0,
  });
}


// ════════════════════════════════════════════════════════════════════
// SLIDE 12 — Plan por fases propuesto
// ════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  lightSlide(s);
  topBar(s, "Hoja de ruta de unificación");
  slideTitle(s, "Plan por fases — si se elige Opción A");

  const fases = [
    {
      num: "0",
      title: "Seguridad + Tooling",
      period: "Semana 1 · BLOQUEANTE",
      color: C.red,
      items: ["C8: Todos los fixes de seguridad", "Bug extra_data en notify()", "pyproject.toml + mypy + pip-audit en CI"],
    },
    {
      num: "1",
      title: "Cimientos unificados",
      period: "Semanas 2-4 · EL GRUESO",
      color: C.orange,
      items: ["C1: Modelo base + multi-tenant (módulo a módulo)", "C4: Corregir validación JWT + decidir JWT vs abstracción", "C2 inicio: separar PatientAccount de ClinicPatientLink"],
    },
    {
      num: "2",
      title: "Reubicación de dominios",
      period: "Semanas 4-7",
      color: C.amber,
      items: ["C7: Resolver dueño de cada app (recetas/citas/labs → Maily Soft)", "C2 completo: repuntar datos clínicos a patient_link", "C5: Cobro dual (B2B clínica vs B2C paciente premium)"],
    },
    {
      num: "3",
      title: "Especialidades y limpieza",
      period: "Semanas 7-10",
      color: C.green,
      items: ["C3: Nutrición como plugin de referencia", "C6: Capa de servicios (gradual, app por app)", "C9: N+1, factories, modelo base en todos los modelos"],
    },
  ];

  fases.forEach((f, i) => {
    const cx = 0.3 + i * 2.38;
    s.addShape(pres.shapes.RECTANGLE, { x: cx, y: 1.2, w: 2.2, h: 3.9, fill: { color: C.white }, line: { color: f.color, width: 1 }, shadow: makeShadow() });
    s.addShape(pres.shapes.RECTANGLE, { x: cx, y: 1.2, w: 2.2, h: 0.5, fill: { color: f.color }, line: { color: f.color } });

    // Número
    s.addShape(pres.shapes.OVAL, { x: cx + 0.8, y: 1.0, w: 0.58, h: 0.58, fill: { color: f.color }, line: { color: f.color } });
    s.addText(f.num, { x: cx + 0.8, y: 1.02, w: 0.58, h: 0.54, fontSize: 18, fontFace: "Calibri", bold: true, color: C.white, align: "center", margin: 0 });

    s.addText(f.title, { x: cx + 0.1, y: 1.25, w: 2.0, h: 0.28, fontSize: 11, fontFace: "Calibri", bold: true, color: C.white, align: "center", margin: 0 });
    s.addText(f.period, { x: cx + 0.05, y: 1.72, w: 2.1, h: 0.22, fontSize: 8.5, fontFace: "Calibri", color: C.muted, align: "center", margin: 0 });
    f.items.forEach((item, ii) => {
      s.addText("›  " + item, { x: cx + 0.1, y: 2.0 + ii * 0.95, w: 2.0, h: 0.85, fontSize: 9, fontFace: "Calibri", color: C.navy, align: "left", margin: 0 });
    });
  });

  s.addShape(pres.shapes.RECTANGLE, { x: 0.3, y: 5.15, w: 9.4, h: 0.28, fill: { color: "F0FDF4" }, line: { color: "BBF7D0", width: 0.5 } });
  s.addText("Estrategia: módulo por módulo, nunca big bang — cada fase deja el sistema funcionando", {
    x: 0.4, y: 5.18, w: 9.2, h: 0.22,
    fontSize: 9.5, fontFace: "Calibri", color: C.green, align: "center", margin: 0,
  });
}


// ════════════════════════════════════════════════════════════════════
// SLIDE 13 — Dueño de cada app (C7)
// ════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  lightSlide(s);
  topBar(s, "C7 — Resolución de solapamiento de apps");
  slideTitle(s, "¿Quién es dueño del dato? — App por app");

  const apps = [
    ["🔄 Fusionar",    "F7FEE7", "15803D", ["accounts","payments","specialists"]],
    ["⬅ Maily Soft",   "FFF7ED", "9A3412", ["prescriptions","appointments","lab_results / documents"]],
    ["↔ Compartida",   "EFF6FF", "1E40AF", ["medications / vitals","chat / telemedicine"]],
    ["✅ Se quedan",   "F0FDF4", "14532D", ["wellness / gamification","family_care / surveys","coupons / partners"]],
    ["✂ Dividir",      "FAF5FF", "6B21A8", ["analytics"]],
    ["🔄 A plugin",    "FFFBEB", "92400E", ["nutrition"]],
  ];

  const cols = 3;
  const cw = 2.9, ch = 1.78, gX = 0.2, gY = 0.18;
  const sx = 0.3, sy = 1.2;

  apps.forEach(([disp, bg, fg, modules], i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = sx + col * (cw + gX);
    const cy = sy + row * (ch + gY);

    s.addShape(pres.shapes.RECTANGLE, { x: cx, y: cy, w: cw, h: ch, fill: { color: bg }, line: { color: "E2E8F0", width: 0.5 }, shadow: makeShadow() });
    s.addText(disp, { x: cx + 0.12, y: cy + 0.1, w: cw - 0.2, h: 0.3, fontSize: 12, fontFace: "Calibri", bold: true, color: fg, align: "left", margin: 0 });
    s.addShape(pres.shapes.LINE, { x: cx + 0.12, y: cy + 0.45, w: cw - 0.24, h: 0, line: { color: "E2E8F0", width: 0.5 } });
    modules.forEach((mod, mi) => {
      s.addText("›  " + mod, { x: cx + 0.12, y: cy + 0.52 + mi * 0.38, w: cw - 0.24, h: 0.3, fontSize: 10, fontFace: "Calibri", color: "374151", align: "left", margin: 0 });
    });
  });
}


// ════════════════════════════════════════════════════════════════════
// SLIDE 14 — Recomendación
// ════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.dark };
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 0.07, fill: { color: C.cyan }, line: { color: C.cyan } });

  s.addText("RECOMENDACIÓN", {
    x: 0.45, y: 0.18, w: 9, h: 0.28,
    fontSize: 8, color: C.cyan, bold: true, charSpacing: 4, align: "left", margin: 0,
  });
  s.addText("Nuestra postura", {
    x: 0.45, y: 0.55, w: 9, h: 0.55,
    fontSize: 28, fontFace: "Calibri", bold: true, color: C.white, align: "left", margin: 0,
  });

  const recs = [
    {
      emoji: "🔴",
      title: "Inmediato (esta semana)",
      items: [
        "Corregir validación iss/azp en el JWT de Clerk",
        "Corregir webhook con firma omisible (riesgo de falsificar recetas)",
        "Mover DSN de Sentry a variable de entorno",
        "Fix bug notify() con extra_data",
      ],
      color: C.red,
    },
    {
      emoji: "⚙️",
      title: "Decisión estratégica (esta semana)",
      items: [
        "¿Existe Maily Soft como codebase real hoy?",
        "Si SÍ → comenzar Fase 1 (C1 + C2) en paralelo con features",
        "Si NO → Opción B (dos backends por API) hasta que Maily Soft madure",
        "El documento asume Opción A; justifica re-evaluarla",
      ],
      color: C.cyan,
    },
    {
      emoji: "✅",
      title: "Lo que NO toca de inmediato",
      items: [
        "C3 Plugins, C5 Cobro dual, C6 Servicios → son Fase 2-3",
        "La app móvil sigue funcionando en cualquier escenario",
        "El admin portal web está listo y no depende de la decisión",
      ],
      color: C.green,
    },
  ];

  recs.forEach((rec, i) => {
    const ry = 1.22 + i * 1.38;
    s.addShape(pres.shapes.RECTANGLE, { x: 0.3, y: ry, w: 9.4, h: 1.2, fill: { color: "1E293B" }, line: { color: rec.color, width: 0.8 } });
    s.addShape(pres.shapes.RECTANGLE, { x: 0.3, y: ry, w: 0.06, h: 1.2, fill: { color: rec.color }, line: { color: rec.color } });
    s.addText(rec.emoji + "  " + rec.title, { x: 0.5, y: ry + 0.08, w: 8.8, h: 0.28, fontSize: 12, fontFace: "Calibri", bold: true, color: rec.color, align: "left", margin: 0 });
    s.addText(rec.items.map(t => "›  " + t).join("\n"), {
      x: 0.5, y: ry + 0.38, w: 8.8, h: 0.75,
      fontSize: 10, fontFace: "Calibri", color: "CBD5E1", align: "left", margin: 0,
    });
  });
}


// ════════════════════════════════════════════════════════════════════
// SLIDE 15 — Próximos pasos
// ════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide();
  s.background = { color: C.dark };
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 5.35, w: 10, h: 0.28, fill: { color: C.navy }, line: { color: C.navy } });

  // Banda lateral
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.08, h: 5.625, fill: { color: C.cyan }, line: { color: C.cyan } });

  s.addText("Próximos pasos", {
    x: 0.4, y: 0.8, w: 9.2, h: 0.75,
    fontSize: 38, fontFace: "Calibri", bold: true, color: C.white, align: "left", margin: 0,
  });

  const steps = [
    { n: "1", text: "Aplicar C8 (seguridad) — sin discusión, esta semana, esfuerzo bajo, impacto crítico", color: C.red },
    { n: "2", text: "Resolver ¿existe Maily Soft? → decide Opción A vs. B", color: C.amber },
    { n: "3", text: "Si Opción A: arrancar C1 (TenantAwareModel) módulo por módulo, empezando por accounts", color: C.cyan },
    { n: "4", text: "Si Opción B: definir contrato API entre MailyT-Cuida y Maily Soft; continuar con features del paciente", color: C.cyan },
    { n: "5", text: "En cualquier caso: completar módulos M08 Chat, M09 Suscripción, M18 Telemedicina en el mobile", color: C.green },
  ];

  steps.forEach((st, i) => {
    const sy = 1.8 + i * 0.68;
    s.addShape(pres.shapes.OVAL, { x: 0.38, y: sy + 0.04, w: 0.38, h: 0.38, fill: { color: st.color }, line: { color: st.color } });
    s.addText(st.n, { x: 0.38, y: sy + 0.06, w: 0.38, h: 0.32, fontSize: 13, fontFace: "Calibri", bold: true, color: C.dark, align: "center", margin: 0 });
    s.addText(st.text, { x: 0.92, y: sy + 0.05, w: 8.7, h: 0.5, fontSize: 11, fontFace: "Calibri", color: "CBD5E1", align: "left", margin: 0 });
  });

  // Footer
  s.addText("MailyT-Cuida  ·  Mayo 2026  ·  Basado en análisis de joseph cambios.pdf", {
    x: 0.4, y: 5.37, w: 9.2, h: 0.2,
    fontSize: 8.5, fontFace: "Calibri", color: "475569", align: "center", margin: 0,
  });
}


// ── Generar archivo ───────────────────────────────────────────────────────────
pres.writeFile({ fileName: "E:\\GitHub\\MailyT-CuidaLEGACY\\docs\\MailyTCuida_Estado_y_Unificacion.pptx" })
  .then(() => console.log("✅ Presentación generada: MailyTCuida_Estado_y_Unificacion.pptx"))
  .catch((e) => console.error("❌ Error:", e));
