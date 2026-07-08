/**
 * Modal de celebración al subir de nivel.
 * Tarjeta 3D elegante, un acento de color y confeti capturable.
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
  Dimensions,
  type ViewStyle,
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
import { Colors } from '@constants/colors'
import { DuoColors, DuoDepth, shadeColor, lightenColor } from '@constants/duoTheme'
import { getLevelMeta } from '@constants/levelBadges'
import { formatEarnedDate } from '@lib/gamification/formatEarnedDate'

const LOGO = require('../../../assets/images/logo.png')
const { width: SCREEN_W } = Dimensions.get('window')
const CARD_W = Math.min(SCREEN_W - 40, 360)
const DEPTH = DuoDepth.md

interface LevelUpModalProps {
  level:     number
  firstName: string | null | undefined
  earnedAt:  string
  visible:   boolean
  onClose:   () => void
}

function Card3D({
  faceColor,
  shadowColor,
  radius = 20,
  style,
  children,
}: {
  faceColor:   string
  shadowColor: string
  radius?:     number
  style?:      ViewStyle
  children:    React.ReactNode
}) {
  return (
    <View style={[card3d.wrap, { marginBottom: DEPTH }, style]}>
      <View
        style={[
          card3d.shadow,
          { top: DEPTH, borderRadius: radius, backgroundColor: shadowColor },
        ]}
      />
      <View
        style={[
          card3d.face,
          { borderRadius: radius, backgroundColor: faceColor, marginBottom: DEPTH },
        ]}
      >
        {children}
      </View>
    </View>
  )
}

function DiagonalSplitBackground({ light, dark }: { light: string; dark: string }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[StyleSheet.absoluteFill, { backgroundColor: light }]} />
      <View style={split.wedgeWrap}>
        <View style={[split.wedge, { backgroundColor: dark }]} />
      </View>
    </View>
  )
}

export function LevelUpModal({ level, firstName, earnedAt, visible, onClose }: LevelUpModalProps) {
  const cardRef = useRef<View>(null)
  const [busy, setBusy] = useState(false)
  const meta = getLevelMeta(level)
  const splitLight = lightenColor(meta.accent, 0.2)
  const splitDark  = shadeColor(meta.accent, 0.12)
  const cardDepth  = shadeColor(meta.accent, 0.22)

  const scale = useSharedValue(0.6)
  const opacity = useSharedValue(0)

  useEffect(() => {
    if (!visible) {
      scale.value = 0.6
      opacity.value = 0
      return
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    opacity.value = withTiming(1, { duration: 200 })
    scale.value = withSpring(1, { damping: 14, stiffness: 200 })
  }, [visible, scale, opacity])

  const popStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity:   opacity.value,
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
          dialogTitle: `Nivel ${level} — ${meta.name}`,
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
      Alert.alert('¡Listo!', 'Tu insignia de nivel se guardó en la galería.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <ConfettiBurst active={visible} />

        <Animated.View style={[styles.modalContent, popStyle]}>
          <View ref={cardRef} collapsable={false} style={styles.captureWrap}>
            <Card3D faceColor={splitLight} shadowColor={cardDepth} radius={24}>
              <DiagonalSplitBackground light={splitLight} dark={splitDark} />
              <View style={styles.body}>
                <Text style={styles.headerEyebrow}>Nuevo logro</Text>
                <Text style={styles.headerTitle}>Subiste de nivel</Text>

                <Image
                  source={meta.image}
                  style={styles.badgeImage}
                  resizeMode="contain"
                />

                <Text style={styles.levelLabel}>NIVEL {level}</Text>

                <Card3D
                  faceColor="#FFFFFF"
                  shadowColor={shadeColor(meta.accent, 0.18)}
                  radius={18}
                  style={styles.phraseCard}
                >
                  <View style={styles.phraseInner}>
                    {firstName ? (
                      <Text style={[styles.greeting, { color: meta.accent }]}>
                        Felicidades, {firstName}
                      </Text>
                    ) : null}
                    <Text style={styles.phrase}>{meta.phrase}</Text>
                    <Text style={styles.earnedDate}>{formatEarnedDate(earnedAt)}</Text>
                  </View>
                </Card3D>

                <View style={styles.brandFooter}>
                  <Image source={LOGO} style={styles.logo} resizeMode="contain" />
                  <Text style={styles.brandTag}>MailyT-Cuida</Text>
                </View>
              </View>
            </Card3D>
          </View>

          {busy ? (
            <ActivityIndicator color="#fff" style={{ marginVertical: 16 }} />
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

const card3d = StyleSheet.create({
  wrap:   { position: 'relative' },
  shadow: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  face:   { overflow: 'hidden' },
})

const split = StyleSheet.create({
  wedgeWrap: {
    position: 'absolute',
    left:     0,
    bottom:   0,
    width:    '100%',
    height:   '58%',
    overflow: 'hidden',
  },
  wedge: {
    position:        'absolute',
    left:            -CARD_W * 0.08,
    bottom:          -CARD_W * 0.22,
    width:           CARD_W * 1.35,
    height:          CARD_W * 0.95,
    transform:       [{ rotate: '-17deg' }],
  },
})

const styles = StyleSheet.create({
  overlay: {
    flex:            1,
    backgroundColor: 'rgba(15, 23, 42, 0.78)',
    justifyContent:  'center',
    alignItems:      'center',
    padding:         16,
  },
  modalContent: {
    width:      CARD_W,
    alignItems: 'center',
    gap:        14,
  },
  captureWrap: {
    width: CARD_W,
  },
  body: {
    alignItems:        'center',
    paddingTop:        24,
    paddingBottom:     24,
    paddingHorizontal: 22,
    gap:               12,
    zIndex:            1,
  },
  headerEyebrow: {
    fontSize:      11,
    fontWeight:    '700',
    letterSpacing: 2,
    color:         'rgba(255,255,255,0.78)',
    textTransform: 'uppercase',
  },
  headerTitle: {
    fontSize:      22,
    fontWeight:    '900',
    color:         '#FFFFFF',
    letterSpacing: 0.3,
    marginBottom:  4,
  },
  badgeImage: {
    width:  164,
    height: 164,
  },
  levelLabel: {
    fontSize:      13,
    fontWeight:    '900',
    letterSpacing: 3,
    color:         'rgba(255,255,255,0.95)',
  },
  phraseCard: {
    width: '100%',
  },
  phraseInner: {
    paddingVertical:   18,
    paddingHorizontal: 20,
    alignItems:        'center',
    gap:               8,
  },
  greeting: {
    fontSize:   15,
    fontWeight: '800',
    textAlign:  'center',
  },
  phrase: {
    fontSize:   17,
    lineHeight: 25,
    fontWeight: '700',
    color:      Colors.light.textPrimary,
    textAlign:  'center',
  },
  earnedDate: {
    fontSize:      12,
    fontWeight:    '600',
    color:         Colors.light.textMuted,
    textAlign:     'center',
    marginTop:     4,
    textTransform: 'capitalize',
  },
  brandFooter: {
    alignItems: 'center',
    gap:        6,
    marginTop:  8,
    paddingTop: 12,
  },
  logo: {
    width:  116,
    height: 26,
  },
  brandTag: {
    fontSize:      11,
    color:         'rgba(255,255,255,0.72)',
    fontWeight:    '600',
    letterSpacing: 0.4,
  },
  actions: {
    flexDirection: 'row',
    gap:           10,
    width:         '100%',
  },
  actionBtn: {
    flex: 1,
  },
  continueBtn: {
    paddingVertical: 6,
  },
  continueText: {
    fontSize:   15,
    fontWeight: '600',
    color:      'rgba(255,255,255,0.9)',
  },
})
