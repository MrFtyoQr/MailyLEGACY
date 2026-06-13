/**
 * Button.tsx
 * ----------
 * Botón con efecto 3D plano estilo Duolingo.
 * Variantes: primary | secondary | ghost | danger
 */

import React, { useState } from 'react'
import {
  Pressable,
  Text,
  ActivityIndicator,
  StyleSheet,
  View,
  type ViewStyle,
  type PressableProps,
} from 'react-native'
import { Colors } from '@constants/colors'
import { DuoColors, DuoDepth } from '@constants/duoTheme'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize    = 'sm' | 'md' | 'lg'

interface ButtonProps extends Omit<PressableProps, 'style'> {
  variant?:   ButtonVariant
  size?:      ButtonSize
  label:      string
  loading?:   boolean
  leftIcon?:  React.ReactNode
  fullWidth?: boolean
  style?:     ViewStyle
}

const FACE: Record<ButtonVariant, string> = {
  primary:   DuoColors.button.primaryFace,
  secondary: DuoColors.button.secondaryFace,
  ghost:     'transparent',
  danger:    DuoColors.button.dangerFace,
}
const SHADOW: Record<ButtonVariant, string> = {
  primary:   DuoColors.button.primaryShadow,
  secondary: DuoColors.button.secondaryShadow,
  ghost:     'transparent',
  danger:    DuoColors.button.dangerShadow,
}
const TEXT: Record<ButtonVariant, string> = {
  primary:   DuoColors.button.primaryText,
  secondary: Colors.brand.primary,
  ghost:     Colors.brand.primary,
  danger:    DuoColors.button.dangerText,
}

export function Button({
  variant   = 'primary',
  size      = 'md',
  label,
  loading   = false,
  leftIcon,
  fullWidth = false,
  disabled,
  onPress,
  style,
  ...rest
}: ButtonProps) {
  const [pressed, setPressed] = useState(false)
  const isDisabled = disabled || loading
  const d = variant === 'ghost' ? 0 : DuoDepth.md
  const offset = pressed && !isDisabled ? d : 0

  const content = (
    <View style={styles.inner}>
      {loading ? (
        <ActivityIndicator
          size="small"
          color={TEXT[variant]}
        />
      ) : (
        <>
          {leftIcon && <View style={styles.iconWrap}>{leftIcon}</View>}
          <Text style={[styles.label, styles[`label_${size}`], { color: TEXT[variant] }]}>
            {label}
          </Text>
        </>
      )}
    </View>
  )

  if (variant === 'ghost') {
    return (
      <Pressable
        onPress={onPress}
        disabled={isDisabled}
        style={[fullWidth && styles.fullWidth, isDisabled && styles.disabled, style]}
        {...rest}
      >
        {content}
      </Pressable>
    )
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[fullWidth && styles.fullWidth, isDisabled && styles.disabled, style]}
      {...rest}
    >
      <View style={[styles.wrap, { marginBottom: d }]}>
        <View
          style={[
            styles.shadowLayer,
            { top: d, borderRadius: 14, backgroundColor: SHADOW[variant] },
          ]}
        />
        <View
          style={[
            styles.face,
            styles[`size_${size}`],
            {
              borderRadius:    14,
              backgroundColor: FACE[variant],
              marginBottom:    d - offset,
              transform:       [{ translateY: offset }],
            },
            variant === 'secondary' && styles.secondaryBorder,
          ]}
        >
          {content}
        </View>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  wrap: { position: 'relative' },
  shadowLayer: {
    position: 'absolute',
    left:     0,
    right:    0,
    bottom:   0,
  },
  face: {
    alignItems:     'center',
    justifyContent: 'center',
  },
  inner: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            8,
  },
  iconWrap: { marginRight: 2 },
  fullWidth: { alignSelf: 'stretch' },
  disabled: { opacity: 0.55 },
  secondaryBorder: {
    borderWidth: 2,
    borderColor: Colors.light.border,
  },
  size_sm: { paddingVertical: 10, paddingHorizontal: 18 },
  size_md: { paddingVertical: 14, paddingHorizontal: 24 },
  size_lg: { paddingVertical: 18, paddingHorizontal: 32 },
  label: { fontWeight: '700', letterSpacing: 0.2 },
  label_sm: { fontSize: 13 },
  label_md: { fontSize: 15 },
  label_lg: { fontSize: 17 },
})
