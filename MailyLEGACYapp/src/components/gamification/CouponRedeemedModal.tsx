/**
 * Modal con el boleto del cupón canjeado y su código de uso.
 */

import React from 'react'
import {
  View,
  Text,
  Modal,
  Image,
  StyleSheet,
  Pressable,
  Alert,
  type ImageSourcePropType,
} from 'react-native'
import * as Clipboard from 'expo-clipboard'
import * as Haptics from 'expo-haptics'
import { Button } from '@components/ui/Button'
import { AppIcon } from '@components/ui/AppIcon'
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
  if (!reward || !redemption) return null

  async function handleCopy() {
    await Clipboard.setStringAsync(redemption!.code)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    Alert.alert('Copiado', 'El código se copió al portapapeles.')
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>¡Cupón canjeado!</Text>
          <Text style={styles.subtitle}>
            Presenta este código para usar tu descuento.
          </Text>

          {image ? (
            <Image source={image} style={styles.couponImage} resizeMode="contain" />
          ) : null}

          <Text style={styles.rewardName}>{reward.name}</Text>

          <Pressable style={styles.codeBox} onPress={handleCopy}>
            <Text style={styles.codeLabel}>Tu código</Text>
            <Text style={styles.code} selectable>{redemption.code}</Text>
            <Text style={styles.codeHint}>Toca para copiar</Text>
          </Pressable>

          <Text style={styles.spent}>
            Se descontaron {redemption.points_spent.toLocaleString('es-MX')} pts de tu saldo.
          </Text>

          <View style={styles.actions}>
            <View style={styles.actionBtn}>
              <Button
                label="Copiar código"
                variant="primary"
                fullWidth
                leftIcon={<AppIcon name="clipboard" size={16} color={DuoColors.button.primaryText} />}
                onPress={handleCopy}
              />
            </View>
            <View style={styles.actionBtn}>
              <Button label="Listo" variant="secondary" fullWidth onPress={onClose} />
            </View>
          </View>
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
    gap:             12,
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
  couponImage: {
    width:           '100%',
    height:          140,
    marginTop:       4,
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
    paddingVertical:   16,
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
  codeHint: {
    fontSize: 11,
    color:    Colors.light.textMuted,
    marginTop: 2,
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
    marginTop:     4,
  },
  actionBtn: { flex: 1 },
})
