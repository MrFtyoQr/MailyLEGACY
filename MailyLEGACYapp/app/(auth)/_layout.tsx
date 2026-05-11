import { Stack } from 'expo-router'
import { Colors } from '@constants/colors'

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown:     false,
        contentStyle:    { backgroundColor: Colors.light.bg },
        animation:       'slide_from_right',
      }}
    />
  )
}
