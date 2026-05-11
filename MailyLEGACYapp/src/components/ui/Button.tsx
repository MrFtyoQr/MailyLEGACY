/**
 * Button.tsx
 * ----------
 * Botón reutilizable con variantes:
 *   primary   → gradiente azul-cyan (brand)
 *   secondary → borde brand, fondo transparente
 *   ghost     → solo texto
 *   danger    → rojo semántico
 *
 * Usa LinearGradient para la variante primary.
 */

import React from 'react'
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  View,
  type ViewStyle,
  type TouchableOpacityProps,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated'
import { Colors } from '@constants/colors'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize    = 'sm' | 'md' | 'lg'

interface ButtonProps extends Omit<TouchableOpacityProps, 'style'> {
  variant?:  ButtonVariant
  size?:     ButtonSize
  label:     string
  loading?:  boolean
  leftIcon?: React.ReactNode
  fullWidth?: boolean
  style?:    ViewStyle
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity)

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
  const scale = useSharedValue(1)

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const handlePressIn = () => {
    scale.value = withSpring(0.96, { damping: 15, stiffness: 300 })
  }
  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 })
  }

  const isDisabled = disabled || loading

  const content = (
    <View style={styles.inner}>
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? '#fff' : Colors.brand.primary}
        />
      ) : (
        <>
          {leftIcon && <View style={styles.iconWrap}>{leftIcon}</View>}
          <Text style={[styles.label, styles[`label_${variant}`], styles[`label_${size}`]]}>
            {label}
          </Text>
        </>
      )}
    </View>
  )

  if (variant === 'primary') {
    return (
      <AnimatedTouchable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        activeOpacity={1}
        style={[animStyle, fullWidth && styles.fullWidth, style]}
        {...rest}
      >
        <LinearGradient
          colors={Colors.gradients.primary as [string, string]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[
            styles.base,
            styles[`size_${size}`],
            isDisabled && styles.disabled,
          ]}
        >
          {content}
        </LinearGradient>
      </AnimatedTouchable>
    )
  }

  return (
    <AnimatedTouchable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={isDisabled}
      activeOpacity={1}
      style={[
        animStyle,
        styles.base,
        styles[`size_${size}`],
        styles[`variant_${variant}`],
        isDisabled && styles.disabled,
        fullWidth && styles.fullWidth,
        style,
      ]}
      {...rest}
    >
      {content}
    </AnimatedTouchable>
  )
}

const styles = StyleSheet.create({
  base: {
    borderRadius:   12,
    alignItems:     'center',
    justifyContent: 'center',
    overflow:       'hidden',
  },
  inner: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            8,
  },
  iconWrap: {
    marginRight: 4,
  },
  fullWidth: {
    alignSelf: 'stretch',
  },
  disabled: {
    opacity: 0.5,
  },

  // Sizes
  size_sm: { paddingVertical: 8,  paddingHorizontal: 16 },
  size_md: { paddingVertical: 14, paddingHorizontal: 24 },
  size_lg: { paddingVertical: 18, paddingHorizontal: 32 },

  // Variant backgrounds (non-primary)
  variant_secondary: {
    borderWidth: 1.5,
    borderColor: Colors.brand.primary,
    backgroundColor: 'transparent',
  },
  variant_ghost: {
    backgroundColor: 'transparent',
  },
  variant_danger: {
    backgroundColor: Colors.semantic.error,
  },

  // Label base
  label: {
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  label_primary:   { color: '#FFFFFF' },
  label_secondary: { color: Colors.brand.primary },
  label_ghost:     { color: Colors.brand.primary },
  label_danger:    { color: '#FFFFFF' },

  // Label sizes
  label_sm: { fontSize: 13 },
  label_md: { fontSize: 15 },
  label_lg: { fontSize: 17 },
})
