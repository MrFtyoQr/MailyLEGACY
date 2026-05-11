/**
 * ScreenWrapper.tsx
 * -----------------
 * Envuelve cada pantalla con:
 *   - SafeAreaView
 *   - StatusBar
 *   - Sentry ErrorBoundary
 *   - Fondo configurable
 */

import React from 'react'
import {
  View,
  StyleSheet,
  type ViewStyle,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { SentryErrorBoundary } from '@lib/sentry'
import { Colors } from '@constants/colors'

interface ScreenWrapperProps {
  children:       React.ReactNode
  bg?:            string
  statusBarStyle?: 'light' | 'dark' | 'auto'
  edges?:         ('top' | 'bottom' | 'left' | 'right')[]
  style?:         ViewStyle
  /** Si true, quita el padding horizontal estándar */
  noPadding?:     boolean
}

export function ScreenWrapper({
  children,
  bg             = Colors.light.bg,
  statusBarStyle = 'dark',
  edges          = ['top', 'bottom', 'left', 'right'],
  style,
  noPadding      = false,
}: ScreenWrapperProps) {
  return (
    <SentryErrorBoundary fallback={<ErrorFallback />}>
      <SafeAreaView style={[styles.safe, { backgroundColor: bg }]} edges={edges}>
        <StatusBar style={statusBarStyle} backgroundColor={bg} />
        <View style={[styles.content, noPadding && styles.noPadding, style]}>
          {children}
        </View>
      </SafeAreaView>
    </SentryErrorBoundary>
  )
}

function ErrorFallback() {
  return (
    <View style={styles.error}>
      {/* Importar Text inline para evitar dependencias circulares */}
      {React.createElement(
        require('react-native').Text,
        { style: styles.errorText },
        'Ocurrió un error inesperado. Reinicia la app.',
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  content: {
    flex:              1,
    paddingHorizontal: 20,
  },
  noPadding: {
    paddingHorizontal: 0,
  },
  error: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    padding:        24,
  },
  errorText: {
    fontSize:  16,
    color:     Colors.semantic.error,
    textAlign: 'center',
  },
})
