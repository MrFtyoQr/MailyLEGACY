import React from 'react'
import { Image, View, StyleSheet, type ImageStyle, type StyleProp } from 'react-native'
import { IconBadge } from '@components/ui/IconBadge'
import { getBadgeImage, getBadgeImageScale } from '@constants/badgeImages'

interface BadgeImageProps {
  code:    string
  size?:   number
  locked?: boolean
  style?:  StyleProp<ImageStyle>
}

export function BadgeImage({ code, size = 48, locked = false, style }: BadgeImageProps) {
  if (locked) {
    return (
      <View style={[styles.wrap, { width: size, height: size }]}>
        <IconBadge name="lock-closed" size={Math.round(size * 0.42)} style={{ opacity: 0.35 }} />
      </View>
    )
  }

  const source = getBadgeImage(code)
  const imageSize = Math.round(size * getBadgeImageScale(code))

  if (!source) {
    return <IconBadge name="medal" size={Math.round(size * 0.46)} />
  }

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Image
        source={source}
        style={[
          styles.image,
          { width: imageSize, height: imageSize },
          style,
        ]}
        resizeMode="contain"
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignItems:     'center',
    justifyContent: 'center',
  },
  image: {},
})
