# Bugs de backend — reporte desde frontend

**Fecha:** 7 de julio de 2026  
**Reportado por:** Madeline (trabajo en `MailyLEGACYapp/`, solo frontend)  
**Asignado a:** Backend / infra (R2, Cloudflare, Django)  
**Estado general:** Pendiente — no se modificará backend desde este branch de UI.

---

## Resumen rápido

| # | Área | Severidad | Síntoma |
|---|------|-----------|---------|
| 2 | Foto de perfil | Media | La subida no muestra error, pero el avatar no refleja la imagen |
| 3 | Mis documentos | Alta | Subida OK; abrir/descargar falla con error de autorización en Cloudflare |

> **Nota:** El Bug #1 (JSON Parse en registro) ya está documentado en `docs/modules/Bugs`.

---

## Bug #2 — Foto de perfil no se muestra tras subirla

**Severidad:** Media  
**Pantalla:** Perfil del paciente → tocar avatar → elegir imagen de galería  
**Reproducido:** Sí, en 2 intentos con imágenes distintas  
**Frontend tocado:** No requiere cambios hasta confirmar respuesta del backend.

### Síntoma visible

1. El usuario selecciona una foto desde la galería.
2. No aparece alerta de error (la petición parece exitosa).
3. El avatar sigue mostrando iniciales / imagen anterior.
4. Al recargar o volver a entrar al perfil, la foto tampoco aparece.

### Flujo en frontend (referencia)

| Paso | Detalle |
|------|---------|
| Archivo | `MailyLEGACYapp/app/(patient)/profile.tsx` |
| Petición | `POST {API_URL}/auth/profiles/patient/photo/` |
| Auth | `Authorization: Bearer <access_token>` |
| Body | `multipart/form-data`, campo `photo` |
| Éxito esperado | `{ "photo_url": "https://..." }` → `updateUser({ photoUrl })` |
| Render | `<Avatar uri={user?.photoUrl} />` en perfil y home |

### Endpoints y backend involucrado

- `POST /api/v1/auth/profiles/patient/photo/`
- Vista: `mailytcuida_backend/apps/accounts/views.py` → `PatientPhotoView`
- Helper: `_upload_photo()` (misma vista, ~línea 279)
- Modelo: `PatientProfile.photo_url`

### Hipótesis para revisar (backend / infra)

1. **`photo_url` devuelta no es accesible públicamente**
   - `_upload_photo` construye la URL como `{AWS_S3_ENDPOINT_URL}/{key}` con `ACL: public-read`.
   - Si R2 no permite `public-read` o el bucket es privado, la URL guardada existe pero la imagen no carga en `<Image source={{ uri }} />`.

2. **URL mal formada**
   - Si `AWS_S3_ENDPOINT_URL` apunta al endpoint S3 API (no CDN/custom domain), el navegador/app puede no poder servir la imagen al usuario final.

3. **Dominio custom / CORS**
   - Falta `AWS_S3_CUSTOM_DOMAIN` o política CORS en R2 para lectura desde la app móvil / Expo web.

4. **Respuesta 200 con URL vacía o incorrecta**
   - Verificar en Network tab qué `photo_url` exacta devuelve el POST y probarla en el navegador.

5. **`GET /api/v1/auth/me/` no devuelve el `photo_url` actualizado**
   - Tras subir, si el usuario reinicia sesión, `auth/me` debe traer el mismo `photo_url` persistido en `PatientProfile`.

### Cómo reproducir

1. Iniciar sesión como paciente.
2. Ir a **Perfil** → tocar el avatar.
3. Elegir una imagen (JPG/PNG).
4. Observar si el avatar cambia.
5. Cerrar y reabrir la app; revisar de nuevo.

### Criterios de aceptación

- [ ] `POST .../patient/photo/` responde 200 con `photo_url` válida y pública.
- [ ] Abrir `photo_url` en navegador muestra la imagen sin login.
- [ ] `GET /api/v1/auth/me/` incluye el mismo `photo_url` después de subir.
- [ ] La app muestra la foto en perfil y en el saludo del home sin recargar manualmente.

### Verificación sugerida (curl)

```bash
# Tras subir foto, probar la URL devuelta:
curl -I "<photo_url_devuelta>"

# Debe responder 200 y Content-Type image/*
```

---

## Bug #3 — Documentos: subida OK, pero abrir/descargar falla (Cloudflare)

**Severidad:** Alta  
**Pantalla:** Mis documentos → botones **Abrir** / **Descargar**  
**Reproducido:** Sí  
**Frontend tocado:** No requiere cambios hasta que `file_url` sea legible.

### Síntoma visible

1. El usuario sube un documento (PDF o imagen) correctamente.
2. El documento aparece en el listado.
3. Al pulsar **Abrir** o **Descargar**, se abre una página de **Cloudflare** con mensaje de **argumento de autorización inválido** (o equivalente).
4. El archivo no se visualiza ni se descarga.

### Flujo en frontend (referencia)

| Paso | Detalle |
|------|---------|
| Archivo | `MailyLEGACYapp/app/(patient)/documents/index.tsx` |
| Subida | 1) `POST /documents/upload-url/` → `{ upload_url, file_url }` |
|        | 2) `PUT upload_url` directo a R2 |
|        | 3) `POST /documents/` con `file_url` guardado en BD |
| Lectura | `Linking.openURL(doc.file_url)` en botones Abrir / Descargar |

### Endpoints y backend involucrado

- `POST /api/v1/documents/upload-url/` → `PresignedUploadUrlView`
- `POST /api/v1/documents/` → registro del documento
- Storage: `mailytcuida_backend/apps/documents/storage.py` → `generate_presigned_upload()`
- Campo persistido: `MedicalDocument.file_url`

### Comportamiento actual del storage (clave)

En `generate_presigned_upload()`:

- Si existe `AWS_S3_CUSTOM_DOMAIN` → `file_url = https://{custom_domain}/{key}` (URL pública).
- Si **no** existe → `file_url` es un **presigned GET** con expiración de **7 días**.

El frontend abre `file_url` tal cual, **sin** re-firmar ni pasar por un proxy autenticado del backend.

### Hipótesis para revisar (backend / infra)

1. **Se guarda un presigned URL expirado o corrupto**
   - Si la URL firmada se copió mal, se truncó, o expiró, Cloudflare/R2 responde error de autorización.

2. **`AWS_S3_CUSTOM_DOMAIN` mal configurado**
   - Dominio público apunta al bucket pero sin acceso de lectura pública, o con reglas WAF que bloquean.

3. **Bucket privado sin endpoint de descarga autenticado**
   - Subida funciona (presigned PUT), pero lectura requiere otro presigned GET generado on-demand o un endpoint Django `GET /documents/{id}/download/`.

4. **Mismatch de key / bucket entre upload y URL pública**
   - El `file_url` almacenado no coincide con el objeto real en R2.

5. **Cloudflare Access o token en la URL**
   - Algún proxy intermedio invalida query params de la firma AWS (`X-Amz-*`).

### Cómo reproducir

1. Iniciar sesión como paciente.
2. Ir a **Mis documentos** → subir un PDF o imagen.
3. Confirmar que aparece en la lista.
4. Pulsar **Abrir** o **Descargar**.
5. Observar redirección a Cloudflare con error de autorización.

### Criterios de aceptación

- [ ] Todo documento subido tiene un `file_url` que abre correctamente en navegador.
- [ ] Abrir/Descargar desde la app funciona en iOS, Android y web (Expo).
- [ ] Si el bucket es privado: el backend expone un endpoint de descarga autenticado (recomendado) o regenera presigned GET al vuelo.
- [ ] Si el bucket es público: `AWS_S3_CUSTOM_DOMAIN` + permisos de lectura configurados y documentados.

### Verificación sugerida

```bash
# 1. Listar documentos del paciente (con token)
GET /api/v1/documents/

# 2. Copiar file_url de un documento recién subido
curl -I "<file_url>"

# 3. Si falla, revisar en Django admin el file_url guardado vs. objeto en R2
```

### Posible solución de diseño (para backend)

| Opción | Descripción |
|--------|-------------|
| A | Bucket público + `AWS_S3_CUSTOM_DOMAIN` + URLs estables `https://cdn.../patients/{id}/docs/{uuid}.pdf` |
| B | Bucket privado + `GET /api/v1/documents/{id}/download/` que genere presigned GET fresco (recomendado) |
| C | Proxy de archivos vía Django con `IsAuthenticated` + validación de ownership |

---

## Archivos de referencia en el repo

| Tema | Ruta |
|------|------|
| Subida foto perfil (app) | `MailyLEGACYapp/app/(patient)/profile.tsx` |
| Avatar | `MailyLEGACYapp/src/components/ui/Avatar.tsx` |
| Documentos (app) | `MailyLEGACYapp/app/(patient)/documents/index.tsx` |
| Endpoints API (app) | `MailyLEGACYapp/src/lib/api/endpoints.ts` |
| Foto perfil (backend) | `mailytcuida_backend/apps/accounts/views.py` |
| Presigned docs (backend) | `mailytcuida_backend/apps/documents/storage.py` |
| Variables R2 | `mailytcuida_backend/config/settings/` (`AWS_*`) |

---

## Plantilla para agregar más bugs

```markdown
## Bug #N — Título corto

**Severidad:**  
**Pantalla:**  
**Síntoma:**  
**Endpoint(s):**  
**Pasos para reproducir:**  
**Esperado / Actual:**  
**Notas frontend:**  
```

---

*Última actualización: 7 jul 2026. Agregar nuevos hallazgos al final de este archivo.*
