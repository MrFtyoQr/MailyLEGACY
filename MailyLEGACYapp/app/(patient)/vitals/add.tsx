/**
 * (patient)/vitals/add.tsx
 * Formulario para registrar nuevos signos vitales.
 */

import React, { useState } from 'react'
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { router } from 'expo-router'
import { ScreenWrapper } from '@components/layout/ScreenWrapper'
import { FormField } from '@components/forms/FormField'
import { Button } from '@components/ui/Button'
import { Colors } from '@constants/colors'
import { useAddVital } from '@hooks/useVitals'

interface FormValues {
  glucose_mgdl:  string
  heart_rate:    string
  systolic_bp:   string
  diastolic_bp:  string
  weight_kg:     string
  notes:         string
}

const EMPTY: FormValues = {
  glucose_mgdl: '',
  heart_rate:   '',
  systolic_bp:  '',
  diastolic_bp: '',
  weight_kg:    '',
  notes:        '',
}

// Rangos de validación clínicamente razonables
const RANGES = {
  glucose_mgdl: { min: 40,  max: 600,  label: 'Glucosa' },
  heart_rate:   { min: 30,  max: 250,  label: 'Frecuencia cardíaca' },
  systolic_bp:  { min: 60,  max: 300,  label: 'Presión sistólica' },
  diastolic_bp: { min: 30,  max: 200,  label: 'Presión diastólica' },
  weight_kg:    { min: 1,   max: 500,  label: 'Peso' },
}

type NumericField = keyof typeof RANGES

export default function AddVitalScreen() {
  const [form, setForm]     = useState<FormValues>(EMPTY)
  const [errors, setErrors] = useState<Partial<FormValues>>({})
  const addVital = useAddVital()

  const set = (field: keyof FormValues) => (value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  function validate(): boolean {
    const newErrors: Partial<FormValues> = {}
    let atLeastOne = false

    for (const [key, range] of Object.entries(RANGES) as [NumericField, typeof RANGES[NumericField]][]) {
      const raw = form[key].trim()
      if (!raw) continue

      atLeastOne = true
      const num = parseFloat(raw)

      if (isNaN(num)) {
        newErrors[key] = 'Ingresa un número válido'
      } else if (num < range.min || num > range.max) {
        newErrors[key] = `${range.label}: rango válido ${range.min}–${range.max}`
      }
    }

    if (!atLeastOne) {
      Alert.alert('Campo requerido', 'Completa al menos un signo vital antes de guardar.')
      return false
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return

    const payload: Record<string, number | string | null> = {}
    const numericFields: NumericField[] = ['glucose_mgdl', 'heart_rate', 'systolic_bp', 'diastolic_bp', 'weight_kg']
    for (const field of numericFields) {
      const raw = form[field].trim()
      payload[field] = raw ? parseFloat(raw) : null
    }
    if (form.notes.trim()) payload.notes = form.notes.trim()

    try {
      await addVital.mutateAsync(payload as Parameters<typeof addVital.mutateAsync>[0])
      Alert.alert('¡Guardado!', 'Signos vitales registrados correctamente.', [
        { text: 'OK', onPress: () => router.back() },
      ])
    } catch {
      Alert.alert('Error', 'No se pudo guardar. Verifica tu conexión e intenta de nuevo.')
    }
  }

  return (
    <ScreenWrapper edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={styles.back}>‹ Volver</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Registrar Vitales</Text>
          <View style={{ width: 64 }} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.hint}>
            Completa al menos un campo. Los rangos se validarán automáticamente.
          </Text>

          <FormField
            label="Glucosa"
            hint="mg/dL · Rango: 40–600"
            error={errors.glucose_mgdl}
            value={form.glucose_mgdl}
            onChangeText={set('glucose_mgdl')}
            keyboardType="decimal-pad"
            placeholder="Ej. 95"
          />

          <FormField
            label="Frecuencia cardíaca"
            hint="lpm · Rango: 30–250"
            error={errors.heart_rate}
            value={form.heart_rate}
            onChangeText={set('heart_rate')}
            keyboardType="number-pad"
            placeholder="Ej. 72"
          />

          <View style={styles.row}>
            <View style={styles.halfField}>
              <FormField
                label="Presión sistólica"
                hint="mmHg"
                error={errors.systolic_bp}
                value={form.systolic_bp}
                onChangeText={set('systolic_bp')}
                keyboardType="number-pad"
                placeholder="Ej. 120"
              />
            </View>
            <View style={styles.halfField}>
              <FormField
                label="Presión diastólica"
                hint="mmHg"
                error={errors.diastolic_bp}
                value={form.diastolic_bp}
                onChangeText={set('diastolic_bp')}
                keyboardType="number-pad"
                placeholder="Ej. 80"
              />
            </View>
          </View>

          <FormField
            label="Peso"
            hint="kg · Rango: 1–500"
            error={errors.weight_kg}
            value={form.weight_kg}
            onChangeText={set('weight_kg')}
            keyboardType="decimal-pad"
            placeholder="Ej. 70.5"
          />

          <FormField
            label="Notas (opcional)"
            value={form.notes}
            onChangeText={set('notes')}
            multiline
            numberOfLines={3}
            placeholder="Observaciones adicionales..."
            style={{ minHeight: 80, textAlignVertical: 'top' }}
          />

          <Button
            label={addVital.isPending ? 'Guardando…' : 'Guardar signos vitales'}
            onPress={handleSubmit}
            disabled={addVital.isPending}
            style={{ marginTop: 8 }}
          />

          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection:   'row',
    alignItems:      'center',
    justifyContent:  'space-between',
    paddingVertical: 12,
  },
  back: {
    fontSize:  17,
    color:     Colors.brand.primary,
    fontWeight: '600',
    minWidth:  64,
  },
  title: {
    fontSize:   18,
    fontWeight: '700',
    color:      Colors.light.textPrimary,
  },
  content: {
    gap: 16,
    paddingBottom: 24,
  },
  hint: {
    fontSize:   13,
    color:      Colors.light.textSecondary,
    lineHeight: 18,
    backgroundColor: Colors.light.surface,
    padding:         12,
    borderRadius:    10,
  },
  row: {
    flexDirection: 'row',
    gap:           12,
  },
  halfField: {
    flex: 1,
  },
})
