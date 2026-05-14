/**
 * (patient)/vitals/add.tsx
 * Registra signos vitales — todos los 14 tipos, registro parcial.
 * Cada signo ingresado genera un POST separado con { vital_type, value, recorded_at }.
 */

import React, { useState } from 'react'
import {
  ScrollView, View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { ScreenWrapper } from '@components/layout/ScreenWrapper'
import { Colors } from '@constants/colors'
import {
  useAddVitals,
  VITAL_META,
  VITAL_TYPES_ORDERED,
  type VitalType,
  type AddVitalPayload,
} from '@hooks/useVitals'

type FormState = Partial<Record<VitalType, string>>
type SecondaryState = Partial<Record<VitalType, string>>

export default function AddVitalScreen() {
  const [values,    setValues]    = useState<FormState>({})
  const [secondary, setSecondary] = useState<SecondaryState>({})
  const [notes,     setNotes]     = useState('')
  const addVitals = useAddVitals()

  const setValue = (type: VitalType, val: string) =>
    setValues(p => ({ ...p, [type]: val }))
  const setSecVal = (type: VitalType, val: string) =>
    setSecondary(p => ({ ...p, [type]: val }))

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

      if (notes.trim()) payload.notes = notes.trim()
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
            Ingresa solo los signos que mediste. Los demás mantienen su último valor registrado.
          </Text>

          {VITAL_TYPES_ORDERED.map(type => {
            const meta    = VITAL_META[type]
            const val     = values[type] ?? ''
            const secVal  = secondary[type] ?? ''
            const filled  = val.trim().length > 0

            return (
              <View key={type} style={[styles.vitalCard, filled && styles.vitalCardFilled]}>
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

                <TextInput
                  style={[styles.input, filled && styles.inputFilled]}
                  value={val}
                  onChangeText={v => setValue(type, v)}
                  keyboardType="decimal-pad"
                  placeholder={`Rango: ${meta.min}–${meta.max}`}
                  placeholderTextColor={Colors.light.textMuted}
                  returnKeyType="next"
                />

                {/* Campo secundario solo para presión arterial */}
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
            style={[styles.saveBtn, (addVitals.isPending || filledCount === 0) && styles.saveBtnDisabled]}
            onPress={handleSubmit}
            activeOpacity={0.85}
            disabled={addVitals.isPending || filledCount === 0}
          >
            {addVitals.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>
                Guardar {filledCount > 0 ? `${filledCount} signo${filledCount > 1 ? 's' : ''}` : 'signos vitales'}
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
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  back: {
    fontSize: 17, color: Colors.brand.primary, fontWeight: '600', minWidth: 64,
  },
  title: {
    fontSize: 17, fontWeight: '700', color: Colors.light.textPrimary,
  },
  countBadge: {
    minWidth: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.brand.primary,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 6,
  },
  countText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  content: { gap: 10, paddingBottom: 24, paddingHorizontal: 2 },
  hint: {
    fontSize: 13, color: Colors.light.textSecondary, lineHeight: 18,
    backgroundColor: Colors.light.surface, padding: 12, borderRadius: 10,
  },

  vitalCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    gap: 8,
    borderWidth: 1.5,
    borderColor: Colors.light.border,
  },
  vitalCardFilled: {
    borderColor: Colors.brand.primary + '60',
    backgroundColor: Colors.brand.primary + '05',
  },
  vitalHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  vitalIcon:   { fontSize: 22 },
  vitalLabel:  { fontSize: 14, fontWeight: '600', color: Colors.light.textPrimary },
  vitalHint:   { fontSize: 11, color: Colors.light.textMuted, marginTop: 1 },
  filledCheck: { fontSize: 16, color: Colors.brand.primary, fontWeight: '700' },

  input: {
    borderWidth: 1, borderColor: Colors.light.border,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 15, color: Colors.light.textPrimary,
    backgroundColor: Colors.light.bg,
  },
  inputFilled: {
    borderColor: Colors.brand.primary,
    backgroundColor: '#fff',
  },
  inputSecondary: { marginTop: 2 },

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
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
})
