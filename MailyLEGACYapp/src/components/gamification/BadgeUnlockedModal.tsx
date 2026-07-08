/**
 * Modal flotante al desbloquear insignia — sin tarjeta sólida; distinto al de nivel.
 */

import React, { useRef, useState, useEffect } from 'react'
import {
  View,
  Text,
  Modal,
  Image,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { captureRef } from 'react-native-view-shot'
import * as Sharing from 'expo-sharing'
import * as MediaLibrary from 'expo-media-library'
import * as Haptics from 'expo-haptics'
import { Button } from '@components/ui/Button'
import { AppIcon } from '@components/ui/AppIcon'
import { ConfettiBurst } from '@components/gamification/ConfettiBurst'
import { LOGO } from '@components/gamification/celebrationPrimitives'
import { Colors } from '@constants/colors'
import { DuoColors } from '@constants/duoTheme'
import {
  getBadgeImage,
  getBadgeImageScale,
  getBadgeAccent,
  getBadgeUnlockReason,
} from '@constants/badgeImages'
import { formatEarnedDate } from '@lib/gamification/formatEarnedDate'
import type { BadgeCelebrationPayload } from '@lib/gamification/badgeCelebrationLogic'

const FLOAT_MAX_W = 320
const BADGE_HERO = 156

interface BadgeUnlockedModalProps {
  badge:     BadgeCelebrationPayload
  firstName: string | null | undefined
  visible:   boolean
  onClose:   () => void
}

export function BadgeUnlockedModal({
  badge,
  firstName,
  visible,
  onClose,
}: BadgeUnlockedModalProps) {
  const cardRef = useRef<View>(null)
  const [busy, setBusy] = useState(false)
  const { width: screenW } = useWindowDimensions()
  const contentW = Math.min(screenW - 40, FLOAT_MAX_W)
  const accent = getBadgeAccent(badge.code, badge.category)
  const imageSource = getBadgeImage(badge.code)
  const imageSize = Math.round(BADGE_HERO * getBadgeImageScale(badge.code))
  const unlockReason = getBadgeUnlockReason(badge.code)

  const scale = useSharedValue(0.88)
  const opacity = useSharedValue(0)
  const badgeY = useSharedValue(14)

  useEffect(() => {
    if (!visible) {
      scale.value = 0.88
      opacity.value = 0
      badgeY.value = 14
      return
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    opacity.value = withTiming(1, { duration: 200 })
    scale.value = withSpring(1, { damping: 15, stiffness: 200 })
    badgeY.value = withSpring(0, { damping: 14, stiffness: 180 })
  }, [visible, scale, opacity, badgeY])

  const popStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity:   opacity.value,
  }))

  const badgeFloatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: badgeY.value }],
  }))

  async function captureCard(): Promise<string | null> {
    if (!cardRef.current) return null
    try {
      return await captureRef(cardRef, {
        format:  'png',
        quality: 1,
        result:  'tmpfile',
      })
    } catch {
      return null
    }
  }

  async function handleShare() {
    setBusy(true)
    try {
      const uri = await captureCard()
      if (!uri) {
        Alert.alert('Error', 'No se pudo generar la imagen.')
        return
      }
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType:    'image/png',
          dialogTitle: badge.name,
        })
      } else {
        Alert.alert('No disponible', 'Compartir no está disponible en este dispositivo.')
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleSave() {
    setBusy(true)
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permiso requerido', 'Activa el acceso a fotos para guardar la imagen.')
        return
      }
      const uri = await captureCard()
      if (!uri) {
        Alert.alert('Error', 'No se pudo generar la imagen.')
        return
      }
      await MediaLibrary.saveToLibraryAsync(uri)
      Alert.alert('¡Listo!', 'Tu insignia se guardó en la galería.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <ConfettiBurst active={visible} />

        <Animated.View style={[styles.modalContent, { width: contentW }, popStyle]}>
          <View
            ref={cardRef}
            collapsable={false}
            style={[styles.floatCapture, { width: contentW }]}
          >
            <Animated.View style={[styles.badgeFloat, badgeFloatStyle]}>
              {imageSource ? (
                <Image
                  source={imageSource}
                  style={{ width: imageSize, height: imageSize }}
                  resizeMode="contain"
                />
              ) : null}
            </Animated.View>

            <Text style={styles.eyebrow}>Insignia desbloqueada</Text>
            <Text style={[styles.badgeName, { color: accent }]}>{badge.name}</Text>

            {firstName ? (
              <Text style={styles.greeting}>¡Felicidades, {firstName}!</Text>
            ) : (
              <Text style={styles.greeting}>¡Felicidades!</Text>
            )}

            <Text style={styles.reason}>{unlockReason}</Text>
            <Text style={styles.earnedDate}>{formatEarnedDate(badge.earnedAt)}</Text>

            <View style={styles.brandFooter}>
              <Image source={LOGO} style={styles.logo} resizeMode="contain" />
              <Text style={styles.brandName}>MailyT-Cuida</Text>
            </View>
          </View>

          {busy ? (
            <ActivityIndicator color="#fff" style={{ marginVertical: 14 }} />
          ) : (
            <View style={styles.actions}>
              <View style={styles.actionBtn}>
                <Button
                  label="Compartir"
                  variant="primary"
                  fullWidth
                  leftIcon={<AppIcon name="share" size={16} color={DuoColors.button.primaryText} />}
                  onPress={handleShare}
                />
              </View>
              <View style={styles.actionBtn}>
                <Button
                  label="Guardar"
                  variant="secondary"
                  fullWidth
                  leftIcon={<AppIcon name="download" size={16} color={Colors.brand.primary} />}
                  onPress={handleSave}
                />
              </View>
            </View>
          )}

          <Pressable onPress={onClose} style={styles.continueBtn} hitSlop={12}>
            <Text style={styles.continueText}>Continuar</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  )
}

const textShadow = {
  textShadowColor:   'rgba(0, 0, 0, 0.45)',
  textShadowOffset:  { width: 0, height: 1 } as const,
  textShadowRadius:  4,
}

const styles = StyleSheet.create({
  overlay: {
    flex:            1,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    justifyContent:  'center',
    alignItems:      'center',
    padding:         20,
  },
  modalContent: {
    alignItems: 'center',
    gap:        14,
  },
  floatCapture: {
    alignItems:        'center',
    paddingVertical:   8,
    paddingHorizontal: 12,
    gap:               6,
    backgroundColor:   'transparent',
  },
  badgeFloat: {
    alignItems:     'center',
    justifyContent: 'center',
    marginBottom:   10,
  },
  eyebrow: {
    fontSize:      12,
    fontWeight:    '600',
    letterSpacing: 1.2,
    color:         'rgba(255, 255, 255, 0.72)',
    textTransform: 'capitalize',
    textAlign:     'center',
    ...textShadow,
  },
  badgeName: {
    fontSize:      26,
    fontWeight:    '900',
    letterSpacing: 0.2,
    textAlign:     'center',
    marginTop:     2,
    ...textShadow,
  },
  greeting: {
    fontSize:   18,
    fontWeight: '800',
    color:      '#FFFFFF',
    textAlign:  'center',
    marginTop:  8,
    ...textShadow,
  },
  reason: {
    fontSize:   14,
    lineHeight: 21,
    fontWeight: '500',
    color:      'rgba(255, 255, 255, 0.82)',
    textAlign:  'center',
    marginTop:  4,
    paddingHorizontal: 8,
    ...textShadow,
  },
  earnedDate: {
    fontSize:      12,
    fontWeight:    '600',
    color:         'rgba(255, 255, 255, 0.55)',
    textAlign:     'center',
    marginTop:     8,
    textTransform: 'capitalize',
    ...textShadow,
  },
  brandFooter: {
    alignItems:        'center',
    justifyContent:    'center',
    gap:               5,
    marginTop:         20,
    paddingHorizontal: 8,
  },
  logo: {
    width:  36,
    height: 36,
  },
  brandName: {
    fontSize:      11,
    fontWeight:    '600',
    color:         '#FFFFFF',
    letterSpacing: 0.3,
    ...textShadow,
  },
  actions: {
    flexDirection: 'row',
    gap:           8,
    width:         '100%',
  },
  actionBtn: { flex: 1 },
  continueBtn: { paddingVertical: 4 },
  continueText: {
    fontSize:   14,
    fontWeight: '600',
    color:      'rgba(255,255,255,0.9)',
  },
})
