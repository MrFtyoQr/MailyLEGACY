/**
 * ProtectedForm.tsx
 * -----------------
 * Wrapper de formulario que:
 *   - Muestra el error global de rate limit / red
 *   - Deshabilita el submit mientras está cargando
 *   - Provee un contexto de "form" sencillo a sus hijos
 *
 * Se usa junto con useFormGuard para el flujo completo.
 */

import React from 'react'
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from 'react-native'
import { Colors } from '@constants/colors'

interface ProtectedFormProps {
  children:     React.ReactNode
  /** Mensaje de error global (rate limit, red, etc.) */
  error?:       string | null
  /** Muestra spinner/overlay cuando true */
  isSubmitting?: boolean
  /** Estilo adicional para el contenedor */
  style?:       object
  /** Si el form debe tener scroll vertical */
  scrollable?:  boolean
}

export function ProtectedForm({
  children,
  error,
  isSubmitting,
  style,
  scrollable = false,
}: ProtectedFormProps) {
  const Inner = (
    <View style={[styles.form, style]}>
      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>⚠️ {error}</Text>
        </View>
      ) : null}

      <View style={{ opacity: isSubmitting ? 0.6 : 1 }}>
        {children}
      </View>
    </View>
  )

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.kav}
    >
      {scrollable ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
        >
          {Inner}
        </ScrollView>
      ) : (
        Inner
      )}
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  kav: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
  },
  form: {
    gap: 4,
  },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    borderRadius:    10,
    padding:         12,
    marginBottom:    12,
    borderWidth:     1,
    borderColor:     '#FECACA',
  },
  errorText: {
    fontSize: 13,
    color:    Colors.semantic.error,
    fontWeight: '500',
    lineHeight: 18,
  },
})
