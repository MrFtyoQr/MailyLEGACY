import { Stack } from 'expo-router'
import { Colors } from '@constants/colors'

export default function DoctorLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle:     { backgroundColor: Colors.light.bg },
        headerTintColor: Colors.light.textPrimary,
        headerTitleStyle: { fontWeight: '600', fontSize: 17 },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Mis Pacientes' }} />
    </Stack>
  )
}
