/**
 * fileGuard.ts
 * ------------
 * Valida archivos ANTES de hacer upload al backend.
 * Previene:
 *   - Archivos demasiado grandes (DoS / costos de storage)
 *   - Tipos MIME no permitidos (XSS via SVG, macros en .doc, etc.)
 */

import { SECURITY } from '@constants/config'

export type FileGuardResult =
  | { ok: true }
  | { ok: false; error: string }

const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic', // iPhone fotos
])

const ALLOWED_DOC_MIMES = new Set([
  'application/pdf',
])

/** Valida imagen para subir como foto de perfil o adjunto */
export function guardImageUpload(file: {
  size?: number | null
  mimeType?: string | null
  fileSize?: number | null  // expo-image-picker usa fileSize
}): FileGuardResult {
  const size = file.size ?? file.fileSize ?? 0
  const mime = (file.mimeType ?? '').toLowerCase()

  if (!ALLOWED_IMAGE_MIMES.has(mime)) {
    return {
      ok: false,
      error: `Tipo de archivo no permitido (${mime || 'desconocido'}). Solo se aceptan: JPEG, PNG, WEBP.`,
    }
  }

  if (size > SECURITY.maxImageBytes) {
    const mb = (size / 1024 / 1024).toFixed(1)
    const max = (SECURITY.maxImageBytes / 1024 / 1024).toFixed(0)
    return {
      ok: false,
      error: `La imagen pesa ${mb} MB. El máximo permitido es ${max} MB.`,
    }
  }

  return { ok: true }
}

/** Valida documento médico (PDF) */
export function guardDocumentUpload(file: {
  size?: number | null
  mimeType?: string | null
}): FileGuardResult {
  const size = file.size ?? 0
  const mime = (file.mimeType ?? '').toLowerCase()

  if (!ALLOWED_DOC_MIMES.has(mime)) {
    return {
      ok: false,
      error: `Tipo de archivo no permitido. Solo se aceptan PDFs.`,
    }
  }

  if (size > SECURITY.maxDocBytes) {
    const mb = (size / 1024 / 1024).toFixed(1)
    const max = (SECURITY.maxDocBytes / 1024 / 1024).toFixed(0)
    return {
      ok: false,
      error: `El documento pesa ${mb} MB. El máximo permitido es ${max} MB.`,
    }
  }

  return { ok: true }
}
