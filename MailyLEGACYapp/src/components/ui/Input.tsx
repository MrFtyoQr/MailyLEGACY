/**
 * Input.tsx
 * ---------
 * Campo de texto con cápsula 3D plana, iconos vectoriales
 * y toggle de contraseña sin emojis.
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
import { DuoColors, DuoDepth } from '@constants/duoTheme'
import { AppIcon } from '@components/ui/AppIcon'

interface InputProps extends Omit<TextInputProps, 'onChangeText'> {
  label?:       string
  error?:       string
  leftIcon?:    React.ReactNode
  rightIcon?:   React.ReactNode
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
  const [isFocused, setIsFocused] = useState(false)
  const [isSecure,  setIsSecure]  = useState(secureTextEntry ?? false)

  const handleChange = (text: string) => {
    const clean = sanitizeInput(text, maxSanitizeLength)
    onChangeText?.(clean)
  }

  const faceColor   = error ? '#FFF5F5' : DuoColors.input.face
  const shadowColor = error ? '#FECACA' : DuoColors.input.shadow
  const d = DuoDepth.md

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}

      <View style={[styles.wrap, { marginBottom: d }]}>
        <View
          style={[
            styles.shadow,
            { top: d, borderRadius: 14, backgroundColor: shadowColor },
          ]}
        />
        <View
          style={[
            styles.face,
            {
              borderRadius:    14,
              backgroundColor: faceColor,
              marginBottom:    d,
              borderColor:     error
                ? Colors.semantic.error
                : isFocused
                ? Colors.brand.primary
                : DuoColors.input.border,
            },
          ]}
        >
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
              <AppIcon
                name={isSecure ? 'eye-off' : 'eye'}
                size={20}
                color={Colors.light.textMuted}
              />
            </TouchableOpacity>
          ) : rightIcon ? (
            <View style={styles.iconRight}>{rightIcon}</View>
          ) : null}
        </View>
      </View>

      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  )
})

Input.displayName = 'Input'

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  label: {
    fontSize:     14,
    fontWeight:   '600',
    color:        Colors.light.textPrimary,
    marginBottom: 6,
  },
  wrap:     { position: 'relative' },
  shadow:   { position: 'absolute', left: 0, right: 0, bottom: 0 },
  face: {
    flexDirection:  'row',
    alignItems:     'center',
    borderWidth:    2,
    overflow:       'hidden',
  },
  input: {
    flex:              1,
    paddingVertical:   14,
    paddingHorizontal: 16,
    fontSize:          15,
    color:             Colors.light.textPrimary,
  },
  inputWithLeft:  { paddingLeft:  4 },
  inputWithRight: { paddingRight: 4 },
  iconLeft:  { paddingLeft: 14 },
  iconRight: { paddingRight: 14 },
  error: {
    marginTop:  4,
    fontSize:   12,
    color:      Colors.semantic.error,
    fontWeight: '500',
  },
})
