import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { ScreenWrapper } from '@components/layout/ScreenWrapper'
import { Colors } from '@constants/colors'
import { useAuthStore } from '@store/auth.store'

export default function DoctorHome() {
  const user = useAuthStore((s) => s.user)

  return (
    <ScreenWrapper>
      <View style={styles.center}>
        <Text style={styles.emoji}>👨‍⚕️</Text>
        <Text style={styles.title}>Dr. {user?.lastName ?? 'Doctor'}</Text>
        <Text style={styles.subtitle}>
          Tu panel médico estará aquí.{'\n'}
          Próximamente: lista de pacientes, citas y alertas.
        </Text>
      </View>
    </ScreenWrapper>
  )
}

const styles = StyleSheet.create({
  center: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            12,
    paddingHorizontal: 24,
  },
  emoji: { fontSize: 56 },
  title: {
    fontSize:   24,
    fontWeight: '700',
    color:      Colors.light.textPrimary,
    textAlign:  'center',
  },
  subtitle: {
    fontSize:  15,
    color:     Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
})
