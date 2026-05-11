/**
 * (patient)/_layout.tsx
 * ---------------------
 * Placeholder Fase 1 — Las tabs de paciente se implementarán en la próxima fase.
 * Incluye: Inicio, Signos vitales, Medicamentos, Citas, Perfil
 */

import { Stack } from 'expo-router'
import { Colors } from '@constants/colors'

export default function PatientLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle:     { backgroundColor: Colors.light.bg },
        headerTintColor: Colors.light.textPrimary,
        headerTitleStyle: { fontWeight: '600', fontSize: 17 },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Mi Salud' }} />
    </Stack>
  )
}
