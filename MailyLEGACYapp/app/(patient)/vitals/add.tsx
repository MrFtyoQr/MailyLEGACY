/**
 * (patient)/vitals/add.tsx
 * Registra signos vitales — 13 tipos (BMI se calcula, no se sube).
 * Cada signo rellenado genera un POST con { vital_type, value, recorded_at }.
 * Foto de evidencia opcional por signo: flujo presigned-upload → R2 → photo_url.
 */

import React, { useState } from 'react'
import {
  ScrollView, View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView, Platform,
  ActivityIndicator, Image,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { router } from 'expo-router'
import { ScreenWrapper } from '@components/layout/ScreenWrapper'
import { Colors } from '@constants/colors'
import { post } from '@lib/api/client'
import { EP } from '@lib/api/endpoints'
import {
  useAddVitals,
  VITAL_META,
  VITAL_TYPES_ORDERED,
  type VitalType,
  type AddVitalPayload,
} from '@hooks/useVitals'

type FormState      = Partial<Record<VitalType, string>>
type SecondaryState = Partial<Record<VitalType, string>>
type PhotoState     = Partial<Record<VitalType, string>>   // uri local
type PhotoUrlState  = Partial<Record<VitalType, string>>   // URL R2 ya subida

// ── Subida de foto a R2 via presigned URL ─────────────────────────────────────
async function uploadPhotoToR2(localUri: string): Promise<string> {
  const ext      = localUri.split('.').pop()?.toLowerCase() ?? 'jpg'
  const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg'
  const fileName = `vital_${Date.now()}.${ext}`

  // 1. Pedir URL presignada al backend
  const { upload_url, file_url } = await post<{ upload_url: string; file_url: string }>(
    EP.documentUploadUrl, { file_name: fileName, mime_type: mimeType },
  )

  // 2. Subir directamente a R2
  const blob = await fetch(localUri).then(r => r.blob())
  const res  = await fetch(upload_url, {
    method:  'PUT',
    body:    blob,
    headers: { 'Content-Type': mimeType },
  })
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`)
  return file_url
}

// ── Pantalla ──────────────────────────────────────────────────────────────────
export default function AddVitalScreen() {
  const [values,    setValues]    = useState<FormState>({})
  const [secondary, setSecondary] = useState<SecondaryState>({})
  const [notes,     setNotes]     = useState('')
  const [photos,    setPhotos]    = useState<PhotoState>({})
  const [photoUrls, setPhotoUrls] = useState<PhotoUrlState>({})
  const [uploading, setUploading] = useState<Partial<Record<VitalType, boolean>>>({})

  const addVitals = useAddVitals()

  const setValue  = (type: VitalType, val: string) =>
    setValues(p => ({ ...p, [type]: val }))
  const setSecVal = (type: VitalType, val: string) =>
    setSecondary(p => ({ ...p, [type]: val }))

  // ── Seleccionar y subir foto ────────────────────────────────────────────────
  async function pickPhoto(type: VitalType) {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería para adjuntar evidencia.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality:    0.75,
      allowsEditing: true,
    })
    if (result.canceled || !result.assets[0]) return

    const uri = result.assets[0].uri
    setPhotos(p => ({ ...p, [type]: uri }))
    setUploading(p => ({ ...p, [type]: true }))

    try {
      const url = await uploadPhotoToR2(uri)
      setPhotoUrls(p => ({ ...p, [type]: url }))
    } catch (e) {
      Alert.alert('Error de subida', 'No se pudo subir la foto. Puedes intentarlo de nuevo.')
      setPhotos(p => { const n = { ...p }; delete n[type]; return n })
    } finally {
      setUploading(p => ({ ...p, [type]: false }))
    }
  }

  function removePhoto(type: VitalType) {
    setPhotos(p    => { const n = { ...p }; delete n[type]; return n })
    setPhotoUrls(p => { const n = { ...p }; delete n[type]; return n })
  }

  // ── Construir payloads ─────────────────────────────────────────────────────
  function buildPayloads(): AddVitalPayload[] | null {
    const now = new Date().toISOString()
    const payloads: AddVitalPayload[] = []
    const errors: string[] = []

    for (const type of VITAL_TYPES_ORDERED) {
      const raw = values[type]?.trim()
      if (!raw) continue

      const meta = VITAL_META[type]
      const val  = parseFloat(raw)

      if (isNaN(val)) { errors.push(`${meta.label}: valor inválido`); continue }
      if (val < meta.min || val > meta.max) {
        errors.push(`${meta.label}: debe estar entre ${meta.min} y ${meta.max} ${meta.unit}`)
        continue
      }

      const payload: AddVitalPayload = {
        vital_type:  type,
        value:       val,
        recorded_at: now,
        source:      'MANUAL',
      }

      if (meta.secondary) {
        const rawSec = secondary[type]?.trim()
        if (!rawSec) { errors.push(`${meta.label}: también ingresa la diastólica`); continue }
        const secVal = parseFloat(rawSec)
        if (isNaN(secVal) || secVal < meta.secondary.min || secVal > meta.secondary.max) {
          errors.push(`Diastólica: debe estar entre ${meta.secondary.min} y ${meta.secondary.max}`)
          continue
        }
        payload.secondary_value = secVal
      }

      if (notes.trim())     payload.notes     = notes.trim()
      if (photoUrls[type])  payload.photo_url = photoUrls[type]

      payloads.push(payload)
    }

    if (errors.length > 0) {
      Alert.alert('Valores fuera de rango', errors.join('\n'))
      return null
    }
    if (payloads.length === 0) {
      Alert.alert('Sin datos', 'Ingresa al menos un signo vital antes de guardar.')
      return null
    }
    return payloads
  }

  async function handleSubmit() {
    // Verificar que no haya fotos pendientes de subir
    const stillUploading = VITAL_TYPES_ORDERED.some(t => uploading[t])
    if (stillUploading) {
      Alert.alert('Espera', 'Todavía se están subiendo fotos. Espera un momento.')
      return
    }

    const payloads = buildPayloads()
    if (!payloads) return

    try {
      const { ok, failed } = await addVitals.mutateAsync(payloads)
      if (failed === 0) {
        Alert.alert(
          '¡Guardado!',
          `${ok} signo${ok > 1 ? 's' : ''} vital${ok > 1 ? 'es' : ''} registrado${ok > 1 ? 's' : ''}.`,
          [{ text: 'OK', onPress: () => router.back() }],
        )
      } else {
        Alert.alert(
          'Guardado parcial',
          `${ok} registrado${ok > 1 ? 's' : ''}, ${failed} con error. Intenta de nuevo.`,
          [{ text: 'OK', onPress: () => router.back() }],
        )
      }
    } catch {
      Alert.alert('Error', 'No se pudieron guardar los signos vitales.')
    }
  }

  const filledCount = VITAL_TYPES_ORDERED.filter(t => values[t]?.trim()).length

  return (
    <ScreenWrapper edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={styles.back}>‹ Volver</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Registrar Vitales</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{filledCount}</Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.hint}>
            Ingresa solo los signos que mediste. Puedes adjuntar una foto de evidencia por cada uno.
          </Text>

          {VITAL_TYPES_ORDERED.map(type => {
            const meta    = VITAL_META[type]
            const val     = values[type] ?? ''
            const secVal  = secondary[type] ?? ''
            const filled  = val.trim().length > 0
            const photo   = photos[type]
            const isUp    = !!uploading[type]

            return (
              <View key={type} style={[styles.vitalCard, filled && styles.vitalCardFilled]}>
                {/* Cabecera */}
                <View style={styles.vitalHeader}>
                  <Text style={styles.vitalIcon}>{meta.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.vitalLabel}>{meta.label}</Text>
                    <Text style={styles.vitalHint}>
                      {meta.unit} · Normal: {meta.normal.min}–{meta.normal.max}
                    </Text>
                  </View>
                  {filled && <Text style={styles.filledCheck}>✓</Text>}
                </View>

                {/* Input valor */}
                <TextInput
                  style={[styles.input, filled && styles.inputFilled]}
                  value={val}
                  onChangeText={v => setValue(type, v)}
                  keyboardType="decimal-pad"
                  placeholder={`Rango: ${meta.min}–${meta.max}`}
                  placeholderTextColor={Colors.light.textMuted}
                  returnKeyType="next"
                />

                {/* Campo secundario (presión arterial diastólica) */}
                {meta.secondary && (
                  <TextInput
                    style={[styles.input, styles.inputSecondary,
                            secondary[type]?.trim() && styles.inputFilled]}
                    value={secVal}
                    onChangeText={v => setSecVal(type, v)}
                    keyboardType="decimal-pad"
                    placeholder={`${meta.secondary.label} (${meta.secondary.min}–${meta.secondary.max})`}
                    placeholderTextColor={Colors.light.textMuted}
                    returnKeyType="next"
                  />
                )}

                {/* Foto de evidencia */}
                {photo ? (
                  <View style={styles.photoPreviewWrap}>
                    <Image source={{ uri: photo }} style={styles.photoPreview} />
                    <View style={styles.photoOverlay}>
                      {isUp ? (
                        <View style={styles.photoUploadingBadge}>
                          <ActivityIndicator size="small" color="#fff" />
                          <Text style={styles.photoUploadingText}>Subiendo…</Text>
                        </View>
                      ) : (
                        <View style={styles.photoReadyBadge}>
                          <Text style={styles.photoReadyText}>✓ Listo</Text>
                        </View>
                      )}
                      <TouchableOpacity
                        style={styles.photoRemoveBtn}
                        onPress={() => removePhoto(type)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.photoRemoveText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.photoBtn}
                    onPress={() => pickPhoto(type)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.photoBtnText}>📷 Adjuntar foto de evidencia</Text>
                  </TouchableOpacity>
                )}
              </View>
            )
          })}

          {/* Notas globales */}
          <View style={styles.notesCard}>
            <Text style={styles.vitalLabel}>Notas (opcional)</Text>
            <TextInput
              style={[styles.input, styles.notesInput]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Observaciones, contexto, síntomas…"
              placeholderTextColor={Colors.light.textMuted}
              multiline
              maxLength={300}
            />
          </View>

          {/* Botón guardar */}
          <TouchableOpacity
            style={[styles.saveBtn,
              (addVitals.isPending || filledCount === 0 ||
               VITAL_TYPES_ORDERED.some(t => uploading[t])) && styles.saveBtnDisabled]}
            onPress={handleSubmit}
            activeOpacity={0.85}
            disabled={addVitals.isPending || filledCount === 0 ||
                      VITAL_TYPES_ORDERED.some(t => uploading[t])}
          >
            {addVitals.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>
                Guardar {filledCount > 0
                  ? `${filledCount} signo${filledCount > 1 ? 's' : ''}`
                  : 'signos vitales'}
              </Text>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'space-between',
    paddingVertical:   12,
    paddingHorizontal: 4,
  },
  back:  { fontSize: 17, color: Colors.brand.primary, fontWeight: '600', minWidth: 64 },
  title: { fontSize: 17, fontWeight: '700', color: Colors.light.textPrimary },
  countBadge: {
    minWidth: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.brand.primary,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
  },
  countText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  content: { gap: 10, paddingBottom: 24, paddingHorizontal: 2 },
  hint: {
    fontSize: 13, color: Colors.light.textSecondary, lineHeight: 18,
    backgroundColor: Colors.light.surface, padding: 12, borderRadius: 10,
  },

  vitalCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    gap: 8, borderWidth: 1.5, borderColor: Colors.light.border,
  },
  vitalCardFilled: {
    borderColor: Colors.brand.primary + '60',
    backgroundColor: Colors.brand.primary + '05',
  },
  vitalHeader:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  vitalIcon:    { fontSize: 22 },
  vitalLabel:   { fontSize: 14, fontWeight: '600', color: Colors.light.textPrimary },
  vitalHint:    { fontSize: 11, color: Colors.light.textMuted, marginTop: 1 },
  filledCheck:  { fontSize: 16, color: Colors.brand.primary, fontWeight: '700' },

  input: {
    borderWidth: 1, borderColor: Colors.light.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, color: Colors.light.textPrimary,
    backgroundColor: Colors.light.bg,
  },
  inputFilled:    { borderColor: Colors.brand.primary, backgroundColor: '#fff' },
  inputSecondary: { marginTop: 2 },

  // Foto
  photoBtn: {
    borderWidth: 1, borderColor: Colors.light.border, borderRadius: 10,
    borderStyle: 'dashed', paddingVertical: 10,
    alignItems: 'center', backgroundColor: Colors.light.bg,
  },
  photoBtnText: { fontSize: 13, color: Colors.light.textSecondary },

  photoPreviewWrap: { borderRadius: 10, overflow: 'hidden', height: 140 },
  photoPreview:     { width: '100%', height: '100%', resizeMode: 'cover' },
  photoOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: 8,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  photoUploadingBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  photoUploadingText:  { color: '#fff', fontSize: 12, fontWeight: '600' },
  photoReadyBadge:     {},
  photoReadyText:      { color: '#fff', fontSize: 13, fontWeight: '700' },
  photoRemoveBtn: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  photoRemoveText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  notesCard: {
    backgroundColor: '#fff', borderRadius: 14, padding: 14,
    gap: 8, borderWidth: 1.5, borderColor: Colors.light.border,
  },
  notesInput: { minHeight: 72, textAlignVertical: 'top' },

  saveBtn: {
    backgroundColor: Colors.brand.primary, borderRadius: 16,
    paddingVertical: 16, alignItems: 'center', marginTop: 4,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText:     { fontSize: 16, fontWeight: '700', color: '#fff' },
})
