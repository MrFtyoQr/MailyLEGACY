/**
 * sign-up.tsx
 * -----------
 * Registro con email + contraseña.
 * Llama a POST /api/v1/auth/register/ y guarda los tokens en SecureStore.
 *
 * Rate limit: 2 intentos / 60s
 */

import React, { useState } from 'react'
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
} from 'react-native'
import { router } from 'expo-router'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated'

import { ScreenWrapper }   from '@components/layout/ScreenWrapper'
import { FormField }       from '@components/forms/FormField'
import { ProtectedForm }   from '@components/forms/ProtectedForm'
import { Button }          from '@components/ui/Button'
import { useFormGuard }    from '@hooks/useFormGuard'
import { createRateLimiter } from '@lib/security/rateLimiter'
import {
  signUpSchema,
  getPasswordStrength,
  type SignUpForm,
} from '@schemas/auth.schema'
import { Colors }          from '@constants/colors'
import { API_URL }         from '@constants/config'
import { setTokens }       from '@lib/auth/session'
import { useAuthStore }    from '@store/auth.store'
import type { UserRole }   from '@constants/config'

const { width } = Dimensions.get('window')

const signUpLimiter = createRateLimiter({ maxAttempts: 2, windowMs: 60_000 })

interface RegisterResponse {
  access:  string
  refresh: string
  user: {
    id:    string
    email: string
    role:  UserRole
  }
}

export default function SignUpScreen() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')

  const setSignedIn = useAuthStore((s) => s.setSignedIn)
  const setUser     = useAuthStore((s) => s.setUser)

  // Indicador de fuerza de contraseña
  const strength  = getPasswordStrength(password)
  const barWidth  = useSharedValue(0)
  const barColor  = useSharedValue<string>(Colors.semantic.error)

  const barStyle = useAnimatedStyle(() => ({
    width:           `${barWidth.value}%` as never,
    backgroundColor: barColor.value,
  }))

  const updateStrength = (pw: string) => {
    setPassword(pw)
    const s = getPasswordStrength(pw)
    barWidth.value = withTiming((s.score / 4) * 100, { duration: 300 })
    barColor.value = withTiming(s.color, { duration: 300 })
  }

  const { submit, isSubmitting, formError, fieldErrors, clearErrors } =
    useFormGuard<SignUpForm, SignUpForm>({
      schema:      signUpSchema,
      rateLimiter: signUpLimiter,
      onSubmit: async (data) => {
        const res = await fetch(`${API_URL}/auth/register/`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            email:    data.email,
            password: data.password,
            role:     'PATIENT',   // El rol se configura en role-setup
          }),
        })

        const json = await res.json() as RegisterResponse & { error?: string }

        if (!res.ok) {
          throw new Error(json.error ?? 'No se pudo crear la cuenta.')
        }

        // Guardar tokens en SecureStore
        await setTokens(json.access, json.refresh)

        // Actualizar estado global
        setUser({
          id:        json.user.id,
          email:     json.user.email,
          role:      json.user.role,
          firstName: null,
          lastName:  null,
          photoUrl:  null,
        })
        setSignedIn(true)

        // Ir al setup de rol/perfil
        router.replace('/(auth)/role-setup')
      },
    })

  return (
    <ScreenWrapper>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <View style={styles.header}>
          <Image
            source={require('../../assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>Crear cuenta</Text>
          <Text style={styles.subtitle}>Únete a la comunidad T-Cuida</Text>
        </View>

        <ProtectedForm error={formError} isSubmitting={isSubmitting}>
          <FormField
            label="Correo electrónico"
            placeholder="tu@correo.com"
            value={email}
            onChangeText={(t) => { clearErrors(); setEmail(t) }}
            error={fieldErrors.email}
            keyboardType="email-address"
            autoComplete="email"
            autoCapitalize="none"
            required
          />
          <FormField
            label="Contraseña"
            placeholder="Mínimo 8 caracteres"
            value={password}
            onChangeText={(t) => { clearErrors(); updateStrength(t) }}
            error={fieldErrors.password}
            secureTextEntry
            required
          />

          {/* Indicador de fuerza */}
          {password.length > 0 && (
            <View style={styles.strengthWrap}>
              <View style={styles.strengthTrack}>
                <Animated.View style={[styles.strengthBar, barStyle]} />
              </View>
              <Text style={[styles.strengthLabel, { color: strength.color }]}>
                {strength.label}
              </Text>
            </View>
          )}

          <FormField
            label="Confirmar contraseña"
            placeholder="Repite tu contraseña"
            value={confirm}
            onChangeText={(t) => { clearErrors(); setConfirm(t) }}
            error={fieldErrors.confirmPassword}
            secureTextEntry
            required
          />

          <Button
            label="Crear cuenta"
            onPress={() => submit({ email, password, confirmPassword: confirm } as never)}
            loading={isSubmitting}
            fullWidth
            size="lg"
            style={styles.btn}
          />
        </ProtectedForm>

        <View style={styles.footer}>
          <Text style={styles.footerText}>¿Ya tienes cuenta? </Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.footerLink}>Inicia sesión</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </ScreenWrapper>
  )
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow:          1,
    paddingVertical:   32,
    paddingHorizontal: 4,
  },
  header: {
    alignItems:   'center',
    marginBottom: 32,
    gap:          8,
  },
  logo: {
    width:        width * 0.45,
    height:       80,
    marginBottom: 8,
  },
  title: {
    fontSize:   26,
    fontWeight: '700',
    color:      Colors.light.textPrimary,
  },
  subtitle: {
    fontSize:  15,
    color:     Colors.light.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  strengthWrap: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           10,
    marginTop:     -8,
    marginBottom:  12,
  },
  strengthTrack: {
    flex:            1,
    height:          4,
    borderRadius:    2,
    backgroundColor: Colors.light.border,
    overflow:        'hidden',
  },
  strengthBar: {
    height:       4,
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize:   12,
    fontWeight: '600',
    minWidth:   72,
  },
  btn: {
    marginTop: 8,
  },
  footer: {
    flexDirection:  'row',
    justifyContent: 'center',
    marginTop:      28,
  },
  footerText: {
    fontSize: 14,
    color:    Colors.light.textSecondary,
  },
  footerLink: {
    fontSize:   14,
    color:      Colors.brand.primary,
    fontWeight: '600',
  },
})
