import React from 'react'
import { View, StyleSheet, type ViewProps } from 'react-native'
import { Colors } from '@constants/colors'

interface CardProps extends ViewProps {
  variant?: 'default' | 'elevated' | 'outlined'
  padding?: number
}

export function Card({ variant = 'default', padding = 16, style, children, ...rest }: CardProps) {
  return (
    <View
      style={[
        styles.base,
        styles[variant],
        { padding },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 16,
    backgroundColor: Colors.light.card,
  },
  default: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius:  8,
    elevation:     3,
  },
  elevated: {
    shadowColor:   '#000',
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius:  16,
    elevation:     6,
  },
  outlined: {
    borderWidth:    1,
    borderColor:    Colors.light.border,
    shadowOpacity:  0,
    elevation:      0,
  },
})
