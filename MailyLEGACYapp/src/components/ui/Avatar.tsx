import React from 'react'
import { View, Text, Image, StyleSheet } from 'react-native'
import { Colors } from '@constants/colors'

interface AvatarProps {
  uri?:      string | null
  name?:     string | null
  size?:     number
  /** Color de fondo cuando no hay imagen */
  bgColor?:  string
}

export function Avatar({ uri, name, size = 40, bgColor = Colors.brand.primary }: AvatarProps) {
  const initials = name
    ? name
        .split(' ')
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? '')
        .join('')
    : '?'

  const containerStyle = {
    width:        size,
    height:       size,
    borderRadius: size / 2,
    backgroundColor: bgColor,
  }

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.image, containerStyle]}
        resizeMode="cover"
      />
    )
  }

  return (
    <View style={[styles.fallback, containerStyle]}>
      <Text style={[styles.initials, { fontSize: size * 0.36 }]}>{initials}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  image: {
    overflow: 'hidden',
  },
  fallback: {
    alignItems:     'center',
    justifyContent: 'center',
  },
  initials: {
    color:      '#FFFFFF',
    fontWeight: '700',
  },
})
