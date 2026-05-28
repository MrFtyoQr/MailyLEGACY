/**
 * sign-in.tsx
 * -----------
 * Pantalla de inicio de sesión con email + contraseña.
 * Llama a POST /api/v1/auth/login/ y guarda los tokens en SecureStore.
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
  Alert,
} from 'react-native'
import { router } from 'expo-router'

import { ScreenWrapper }   from '@components/layout/ScreenWrapper'
import { FormField }       from '@components/forms/FormField'
import { ProtectedForm }   from '@components/forms/ProtectedForm'
import { Button }          from '@components/ui/Button'
import { useFormGuard }    from '@hooks/useFormGuard'
import { createRateLimiter } from '@lib/security/rateLimiter'
import { signInSchema, type SignInForm } from '@schemas/auth.schema'
import { Colors }          from '@constants/colors'
import { API_URL }         from '@constants/config'
import { setTokens }       from '@lib/auth/session'
import { useAuthStore }    from '@store/auth.store'
import type { UserRole }   from '@constants/config'

const { width } = Dimensions.get('window')

const signInLimiter = createRateLimiter({ maxAttempts: 5, windowMs: 60_000 })

interface LoginResponse {
  access:  string
  refresh: string
  user: {
    id:    string
    email: string
    role:  UserRole
  }
}

export default function SignInScreen() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const setSignedIn = useAuthStore((s) => s.setSignedIn)
  const setUser     = useAuthStore((s) => s.setUser)

  const { submit, isSubmitting, formError, fieldErrors, clearErrors } =
    useFormGuard<SignInForm, SignInForm>({
      schema:      signInSchema,
      rateLimiter: signInLimiter,
      onSubmit: async (data) => {
        const res = await fetch(`${API_URL}/auth/login/`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ email: data.email, password: data.password }),
        })

        const json = await res.json() as LoginResponse & { error?: string }

        if (!res.ok) {
          throw new Error(json.error ?? 'Credenciales incorrectas.')
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

        // El splash (index.tsx) ya cargó; navegar directo según rol
        const roleMap: Record<string, string> = {
          PATIENT:    '/(patient)',
          DOCTOR:     '/(doctor)',
          SPECIALIST: '/(specialist)',
        }
        router.replace((roleMap[json.user.role] ?? '/(auth)/role-setup') as never)
      },
    })

  return (
    <ScreenWrapper>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* ── Header / Marca ─────────────────────────────── */}
        <View style={styles.header}>
          <Image
            source={require('../../assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.title}>Bienvenido a maily</Text>
          <Text style={styles.subtitle}>
            Tu salud y la de tu familia, siempre conectada
          </Text>
        </View>

        {/* ── Formulario ─────────────────────────────────── */}
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
            placeholder="Tu contraseña"
            value={password}
            onChangeText={(t) => { clearErrors(); setPassword(t) }}
            error={fieldErrors.password}
            secureTextEntry
            required
          />

          <Button
            label="Iniciar sesión"
            onPress={() => submit({ email, password } as never)}
            loading={isSubmitting}
            fullWidth
            size="lg"
            style={styles.btn}
          />
        </ProtectedForm>

        {/* ── Footer — registro ───────────────────────────── */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>¿No tienes cuenta? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/sign-up')}>
            <Text style={styles.footerLink}>Crear cuenta</Text>
          </TouchableOpacity>
        </View>

        {/* ── Footer legal ────────────────────────────────── */}
        <Text style={styles.legal}>
          Al continuar aceptas nuestros{' '}
          <Text style={styles.legalLink}>Términos de uso</Text>
          {' '}y{' '}
          <Text style={styles.legalLink}>Política de privacidad</Text>
        </Text>
      </ScrollView>
    </ScreenWrapper>
  )
}

const styles = StyleSheet.create({
  scroll: {
    flexGrow:          1,
    paddingVertical:   32,
    paddingHorizontal: 4,
    justifyContent:    'space-between',
  },
  header: {
    alignItems:   'center',
    gap:          12,
    marginTop:    16,
    marginBottom: 36,
  },
  logo: {
    width:        width * 0.55,
    height:       90,
    marginBottom: 12,
  },
  title: {
    fontSize:   26,
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
  btn: {
    marginTop: 8,
  },
  footer: {
    flexDirection:  'row',
    justifyContent: 'center',
    marginTop:      28,
    marginBottom:   8,
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
  legal: {
    fontSize:  12,
    color:     Colors.light.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginTop:  16,
  },
  legalLink: {
    color:      Colors.brand.primary,
    fontWeight: '500',
  },
})
