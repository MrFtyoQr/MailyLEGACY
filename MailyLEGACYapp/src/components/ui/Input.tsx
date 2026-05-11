/**
 * Input.tsx
 * ---------
 * Campo de texto con sanitización inline, soporte para password,
 * iconos y estado de error.
 */

import React, { useState, forwardRef } from 'react'
import {
  TextInput,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  type TextInputProps,
} from 'react-native'
import { sanitizeInput } from '@lib/security/sanitize'
import { Colors } from '@constants/colors'

interface InputProps extends Omit<TextInputProps, 'onChangeText'> {
  label?:       string
  error?:       string
  leftIcon?:    React.ReactNode
  rightIcon?:   React.ReactNode
  /** Longitud máxima para sanitización (default 500) */
  maxSanitizeLength?: number
  onChangeText?: (text: string) => void
}

export const Input = forwardRef<TextInput, InputProps>(({
  label,
  error,
  leftIcon,
  rightIcon,
  secureTextEntry,
  maxSanitizeLength = 500,
  onChangeText,
  ...rest
}, ref) => {
  const [isFocused,  setIsFocused]  = useState(false)
  const [isSecure,   setIsSecure]   = useState(secureTextEntry ?? false)

  const handleChange = (text: string) => {
    const clean = sanitizeInput(text, maxSanitizeLength)
    onChangeText?.(clean)
  }

  const borderColor = error
    ? Colors.semantic.error
    : isFocused
    ? Colors.brand.primary
    : Colors.light.border

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}

      <View style={[styles.inputWrap, { borderColor }]}>
        {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}

        <TextInput
          ref={ref}
          style={[
            styles.input,
            leftIcon  ? styles.inputWithLeft  : undefined,
            (rightIcon || secureTextEntry) ? styles.inputWithRight : undefined,
          ]}
          placeholderTextColor={Colors.light.textMuted}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onChangeText={handleChange}
          secureTextEntry={isSecure}
          autoCapitalize="none"
          autoCorrect={false}
          {...rest}
        />

        {secureTextEntry ? (
          <TouchableOpacity
            style={styles.iconRight}
            onPress={() => setIsSecure((v) => !v)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.eyeIcon}>{isSecure ? '🙈' : '👁️'}</Text>
          </TouchableOpacity>
        ) : rightIcon ? (
          <View style={styles.iconRight}>{rightIcon}</View>
        ) : null}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  )
})

Input.displayName = 'Input'

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize:    14,
    fontWeight:  '500',
    color:       Colors.light.textPrimary,
    marginBottom: 6,
  },
  inputWrap: {
    flexDirection:  'row',
    alignItems:     'center',
    borderWidth:    1.5,
    borderRadius:   12,
    backgroundColor: Colors.light.surface,
    overflow:       'hidden',
  },
  input: {
    flex:          1,
    paddingVertical:   14,
    paddingHorizontal: 16,
    fontSize:      15,
    color:         Colors.light.textPrimary,
  },
  inputWithLeft:  { paddingLeft:  8 },
  inputWithRight: { paddingRight: 8 },
  iconLeft: {
    paddingLeft: 14,
  },
  iconRight: {
    paddingRight: 14,
  },
  eyeIcon: {
    fontSize: 18,
  },
  error: {
    marginTop: 4,
    fontSize:  12,
    color:     Colors.semantic.error,
    fontWeight: '400',
  },
})
