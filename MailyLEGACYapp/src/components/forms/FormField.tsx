/**
 * FormField.tsx
 * -------------
 * Wrapper de Input con label, error y sanitización integrada.
 * Se conecta directamente con react-hook-form o con useFormGuard.
 */

import React, { forwardRef } from 'react'
import { View, Text, StyleSheet, type TextInput } from 'react-native'
import { Input } from '@components/ui/Input'
import { Colors } from '@constants/colors'
import type { TextInputProps } from 'react-native'

interface FormFieldProps extends Omit<TextInputProps, 'onChangeText'> {
  label:       string
  error?:      string
  hint?:       string
  required?:   boolean
  onChangeText?: (text: string) => void
  secureTextEntry?: boolean
  leftIcon?:   React.ReactNode
  maxSanitizeLength?: number
}

export const FormField = forwardRef<TextInput, FormFieldProps>(
  ({ label, error, hint, required, ...inputProps }, ref) => {
    return (
      <View style={styles.wrapper}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label}</Text>
          {required && <Text style={styles.required}> *</Text>}
        </View>

        <Input
          ref={ref}
          error={error}
          {...inputProps}
        />

        {hint && !error && (
          <Text style={styles.hint}>{hint}</Text>
        )}
      </View>
    )
  },
)

FormField.displayName = 'FormField'

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 4,
  },
  labelRow: {
    flexDirection: 'row',
    marginBottom:  6,
  },
  label: {
    fontSize:   14,
    fontWeight: '500',
    color:      Colors.light.textPrimary,
  },
  required: {
    color:      Colors.semantic.error,
    fontWeight: '600',
  },
  hint: {
    marginTop:  4,
    fontSize:   12,
    color:      Colors.light.textSecondary,
  },
})
