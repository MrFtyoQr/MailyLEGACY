/**
 * Modal con el boleto del cupón canjeado y su código de uso.
 */

import React, { useRef, useState } from 'react'
import {
  View,
  Text,
  Modal,
  Image,
  StyleSheet,
  Alert,
  ActivityIndicator,
  type ImageSourcePropType,
} from 'react-native'
import { captureRef } from 'react-native-view-shot'
import * as MediaLibrary from 'expo-media-library'
import * as Haptics from 'expo-haptics'
import { Button } from '@components/ui/Button'
import { AppIcon } from '@components/ui/AppIcon'
import { LOGO } from '@components/gamification/celebrationPrimitives'
import { Colors } from '@constants/colors'
import { DuoColors } from '@constants/duoTheme'
import type { RedemptionRecord, RewardProduct } from '@hooks/useGamification'

interface CouponRedeemedModalProps {
  visible:    boolean
  reward:     RewardProduct | null
  redemption: RedemptionRecord | null
  image:      ImageSourcePropType | null
  onClose:    () => void
}

export function CouponRedeemedModal({
  visible,
  reward,
  redemption,
  image,
  onClose,
}: CouponRedeemedModalProps) {
  const ticketRef = useRef<View>(null)
  const [busy, setBusy] = useState(false)

  if (!reward || !redemption) return null

  async function captureTicket(): Promise<string | null> {
    if (!ticketRef.current) return null
    try {
      return await captureRef(ticketRef, {
        format:  'png',
        quality: 1,
        result:  'tmpfile',
      })
    } catch {
      return null
    }
  }

  async function handleSave() {
    setBusy(true)
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permiso requerido', 'Activa el acceso a fotos para guardar el cupón.')
        return
      }
      const uri = await captureTicket()
      if (!uri) {
        Alert.alert('Error', 'No se pudo generar la imagen del cupón.')
        return
      }
      await MediaLibrary.saveToLibraryAsync(uri)
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      Alert.alert('¡Listo!', 'Tu cupón se guardó en la galería.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>¡Cupón canjeado!</Text>
          <Text style={styles.subtitle}>
            Guarda tu cupón con el código para usarlo en tienda.
          </Text>

          <View ref={ticketRef} collapsable={false} style={styles.ticketCapture}>
            {image ? (
              <Image source={image} style={styles.couponImage} resizeMode="contain" />
            ) : null}

            <Text style={styles.rewardName}>{reward.name}</Text>

            <View style={styles.codeBox}>
              <Text style={styles.codeLabel}>Tu código</Text>
              <Text style={styles.code} selectable>{redemption.code}</Text>
            </View>

            <View style={styles.brandFooter}>
              <Image source={LOGO} style={styles.logo} resizeMode="contain" />
              <Text style={styles.brandName}>MailyT-Cuida</Text>
            </View>
          </View>

          <Text style={styles.spent}>
            Se descontaron {redemption.points_spent.toLocaleString('es-MX')} pts de tu saldo.
          </Text>

          {busy ? (
            <ActivityIndicator color={Colors.brand.primary} style={{ marginVertical: 8 }} />
          ) : (
            <View style={styles.actions}>
              <View style={styles.actionBtn}>
                <Button
                  label="Guardar"
                  variant="primary"
                  fullWidth
                  leftIcon={<AppIcon name="download" size={16} color={DuoColors.button.primaryText} />}
                  onPress={handleSave}
                />
              </View>
              <View style={styles.actionBtn}>
                <Button label="Listo" variant="secondary" fullWidth onPress={onClose} />
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex:            1,
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    justifyContent:  'center',
    alignItems:      'center',
    padding:         20,
  },
  card: {
    width:           '100%',
    maxWidth:        360,
    backgroundColor: Colors.light.surface,
    borderRadius:    20,
    padding:         22,
    alignItems:      'center',
    gap:             10,
  },
  title: {
    fontSize:   20,
    fontWeight: '800',
    color:      Colors.light.textPrimary,
    textAlign:  'center',
  },
  subtitle: {
    fontSize:   14,
    color:      Colors.light.textSecondary,
    textAlign:  'center',
    lineHeight: 20,
  },
  ticketCapture: {
    width:           '100%',
    backgroundColor: Colors.light.surface,
    borderRadius:    16,
    borderWidth:     1,
    borderColor:     Colors.light.border,
    padding:         16,
    alignItems:      'center',
    gap:             10,
  },
  couponImage: {
    width:           '100%',
    height:          140,
    backgroundColor: Colors.light.surface,
  },
  rewardName: {
    fontSize:   15,
    fontWeight: '700',
    color:      Colors.light.textPrimary,
    textAlign:  'center',
  },
  codeBox: {
    width:           '100%',
    backgroundColor: Colors.light.bg,
    borderRadius:    14,
    borderWidth:     1,
    borderColor:     Colors.light.border,
    paddingVertical:   14,
    paddingHorizontal: 16,
    alignItems:      'center',
    gap:             4,
  },
  codeLabel: {
    fontSize:      11,
    fontWeight:    '700',
    letterSpacing: 1,
    color:         Colors.light.textMuted,
    textTransform: 'uppercase',
  },
  code: {
    fontSize:      22,
    fontWeight:    '900',
    letterSpacing: 2,
    color:         Colors.brand.primary,
  },
  brandFooter: {
    alignItems:     'center',
    justifyContent: 'center',
    gap:            4,
    marginTop:      4,
  },
  logo: {
    width:  28,
    height: 28,
  },
  brandName: {
    fontSize:   11,
    fontWeight: '600',
    color:      Colors.light.textMuted,
  },
  spent: {
    fontSize:  12,
    color:     Colors.light.textSecondary,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap:           8,
    width:         '100%',
  },
  actionBtn: { flex: 1 },
})
