/**
 * (patient)/ai-chat.tsx
 * ---------------------
 * Pantalla del Asistente IA de Salud — interfaz de voz.
 * El usuario habla; la app transcribe (Speech-to-Text nativo) y muestra
 * la respuesta en burbujas de chat.
 *
 * ESTADO ACTUAL: UI completa con mock de respuestas.
 * Pendiente de integración con backend (ver /docs/modules/M24-propuesta-chat-ia.txt)
 *
 * Dependencia futura: expo-speech, expo-av para grabación de audio.
 * Por ahora usa TextInput como fallback hasta que se instalen los módulos.
 */

import React, { useState, useRef, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
} from 'react-native'
import { router } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { ScreenWrapper } from '@components/layout/ScreenWrapper'
import { Colors } from '@constants/colors'

// ─── Tipos ────────────────────────────────────────────────────────────────────

type MessageRole = 'user' | 'assistant'

interface Message {
  id:        string
  role:      MessageRole
  text:      string
  timestamp: Date
  isVoice?:  boolean   // true si fue enviado por voz
}

// ─── Respuestas mock (se reemplazarán con el endpoint real) ───────────────────

const MOCK_RESPONSES = [
  'Entiendo tu consulta. Basándome en los datos de tu perfil de salud, te recomiendo consultar con tu médico para obtener una evaluación personalizada.',
  'Según la Organización Mundial de la Salud (OMS), los valores que describes pueden variar según factores individuales. Te sugiero registrar este dato en tus signos vitales para que tu médico pueda revisarlo.',
  'Esa es una buena pregunta. Recuerda que soy un asistente de orientación — no reemplazo la consulta médica. ¿Quieres que te ayude a preparar preguntas para tu próxima cita?',
  'He revisado tus datos recientes. Todo parece estar dentro de los rangos esperados, pero siempre es bueno mantener un seguimiento constante con tu médico de cabecera.',
]

let mockIdx = 0
function getMockResponse(): string {
  const r = MOCK_RESPONSES[mockIdx % MOCK_RESPONSES.length]
  mockIdx++
  return r
}

// ─── Sugerencias rápidas ──────────────────────────────────────────────────────

const QUICK_SUGGESTIONS = [
  '¿Cómo están mis signos vitales?',
  '¿Tomé todos mis medicamentos hoy?',
  '¿Qué significa mi último análisis?',
  'Tengo dolor de cabeza',
]

// ─── Componente principal ─────────────────────────────────────────────────────

export default function AiChatScreen() {
  const [messages,    setMessages]    = useState<Message[]>([
    {
      id:        '0',
      role:      'assistant',
      text:      '¡Hola! Soy tu asistente de salud. Puedes hablarme o escribirme sobre tus síntomas, medicamentos o dudas de salud. Recuerda que mis respuestas son orientativas y no reemplazan la consulta médica. 😊',
      timestamp: new Date(),
    },
  ])
  const [inputText,   setInputText]   = useState('')
  const [isListening, setIsListening] = useState(false)
  const [isThinking,  setIsThinking]  = useState(false)
  const scrollRef = useRef<ScrollView>(null)
  const pulseAnim = useRef(new Animated.Value(1)).current

  // Animación del botón de voz
  const startPulse = useCallback(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.18, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 600, useNativeDriver: true }),
      ])
    ).start()
  }, [pulseAnim])

  const stopPulse = useCallback(() => {
    pulseAnim.stopAnimation()
    Animated.timing(pulseAnim, { toValue: 1, duration: 200, useNativeDriver: true }).start()
  }, [pulseAnim])

  function sendMessage(text: string, isVoice = false) {
    if (!text.trim()) return

    const userMsg: Message = {
      id:        Date.now().toString(),
      role:      'user',
      text:      text.trim(),
      timestamp: new Date(),
      isVoice,
    }

    setMessages((prev) => [...prev, userMsg])
    setInputText('')
    setIsThinking(true)

    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)

    // Simula latencia de red (600-1200ms)
    setTimeout(() => {
      const botMsg: Message = {
        id:        (Date.now() + 1).toString(),
        role:      'assistant',
        text:      getMockResponse(),
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, botMsg])
      setIsThinking(false)
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)
    }, 800 + Math.random() * 400)
  }

  function toggleVoice() {
    if (isListening) {
      // Detener grabación — en la implementación real aquí va expo-av stop()
      stopPulse()
      setIsListening(false)
      // Mock: simula transcripción recibida
      sendMessage('¿Cómo están mis signos vitales esta semana?', true)
    } else {
      setIsListening(true)
      startPulse()
      // En la implementación real: iniciar expo-av Recording aquí
      // y llamar a Speech-to-Text cuando pare
    }
  }

  return (
    <ScreenWrapper noPadding edges={['top', 'left', 'right']}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <LinearGradient colors={['#0A0F1E', '#131B2E']} style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.backIcon}>‹</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>🤖 Asistente IA de salud</Text>
          <View style={styles.onlineRow}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>En línea · Orientación general</Text>
          </View>
        </View>
      </LinearGradient>

      {/* ── Aviso médico ───────────────────────────────────────────── */}
      <View style={styles.disclaimer}>
        <Text style={styles.disclaimerText}>
          ⚕️ Este asistente es orientativo. No reemplaza la consulta médica profesional.
        </Text>
      </View>

      {/* ── Mensajes ───────────────────────────────────────────────── */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.messages}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        >
          {messages.map((msg) => (
            <View
              key={msg.id}
              style={[
                styles.bubbleWrap,
                msg.role === 'user' ? styles.bubbleWrapUser : styles.bubbleWrapBot,
              ]}
            >
              {msg.role === 'assistant' && (
                <View style={styles.botAvatar}>
                  <Text style={styles.botAvatarEmoji}>🤖</Text>
                </View>
              )}
              <View style={[
                styles.bubble,
                msg.role === 'user' ? styles.bubbleUser : styles.bubbleBot,
              ]}>
                {msg.isVoice && (
                  <Text style={styles.voiceTag}>🎙️ </Text>
                )}
                <Text style={[
                  styles.bubbleText,
                  msg.role === 'user' ? styles.bubbleTextUser : styles.bubbleTextBot,
                ]}>
                  {msg.isVoice && <Text style={styles.voiceTag}>🎙️  </Text>}
                  {msg.text}
                </Text>
                <Text style={[
                  styles.bubbleTime,
                  msg.role === 'user' ? { color: 'rgba(255,255,255,0.55)' } : {},
                ]}>
                  {msg.timestamp.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </View>
          ))}

          {/* Indicador de "está escribiendo" */}
          {isThinking && (
            <View style={[styles.bubbleWrap, styles.bubbleWrapBot]}>
              <View style={styles.botAvatar}>
                <Text style={styles.botAvatarEmoji}>🤖</Text>
              </View>
              <View style={[styles.bubble, styles.bubbleBot, styles.thinkingBubble]}>
                <ActivityIndicator size="small" color={Colors.brand.primary} />
                <Text style={styles.thinkingText}>Analizando…</Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* ── Sugerencias rápidas ────────────────────────────────────── */}
        {messages.length <= 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.suggestions}
          >
            {QUICK_SUGGESTIONS.map((s) => (
              <TouchableOpacity
                key={s}
                style={styles.suggestionChip}
                onPress={() => sendMessage(s)}
                activeOpacity={0.7}
              >
                <Text style={styles.suggestionText}>{s}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* ── Input + botón de voz ────────────────────────────────────── */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Escribe tu consulta…"
            placeholderTextColor={Colors.light.textMuted}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={() => sendMessage(inputText)}
          />

          {inputText.trim() ? (
            <TouchableOpacity
              style={styles.sendBtn}
              onPress={() => sendMessage(inputText)}
              activeOpacity={0.8}
            >
              <Text style={styles.sendBtnIcon}>➤</Text>
            </TouchableOpacity>
          ) : (
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <TouchableOpacity
                style={[styles.voiceBtn, isListening && styles.voiceBtnActive]}
                onPress={toggleVoice}
                activeOpacity={0.85}
              >
                <Text style={styles.voiceBtnIcon}>{isListening ? '⏹' : '🎙️'}</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>

        {isListening && (
          <View style={styles.listeningBar}>
            <View style={styles.listeningDot} />
            <Text style={styles.listeningText}>Escuchando… toca ⏹ para enviar</Text>
          </View>
        )}
      </KeyboardAvoidingView>
    </ScreenWrapper>
  )
}

// ─── Estilos ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 16,
    paddingVertical:   14,
    gap:               12,
  },
  backBtn:    { padding: 4 },
  backIcon:   { fontSize: 28, color: '#fff', lineHeight: 32 },
  headerInfo: { flex: 1 },
  headerTitle:{ fontSize: 16, fontWeight: '700', color: '#fff' },
  onlineRow:  { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  onlineDot:  { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.semantic.success },
  onlineText: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },

  disclaimer: {
    backgroundColor: Colors.semantic.warningBg,
    paddingHorizontal: 16,
    paddingVertical:   8,
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
  },
  disclaimerText: {
    fontSize:  12,
    color:     '#92400E',
    textAlign: 'center',
    lineHeight: 17,
  },

  messages:        { flex: 1 },
  messagesContent: { padding: 16, gap: 12, paddingBottom: 8 },

  bubbleWrap:     { flexDirection: 'row', gap: 8, maxWidth: '88%' },
  bubbleWrapUser: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  bubbleWrapBot:  { alignSelf: 'flex-start' },

  botAvatar: {
    width:          34,
    height:         34,
    borderRadius:   17,
    backgroundColor: Colors.dark.surface,
    alignItems:     'center',
    justifyContent: 'center',
    marginTop:      4,
  },
  botAvatarEmoji: { fontSize: 18 },

  bubble: {
    borderRadius:  18,
    paddingVertical:   10,
    paddingHorizontal: 14,
    gap:           4,
    maxWidth:      '100%',
  },
  bubbleUser: {
    backgroundColor: Colors.brand.primary,
    borderBottomRightRadius: 4,
  },
  bubbleBot: {
    backgroundColor: '#F1F5F9',
    borderBottomLeftRadius: 4,
  },
  bubbleText:     { fontSize: 14, lineHeight: 20 },
  bubbleTextUser: { color: '#fff' },
  bubbleTextBot:  { color: Colors.light.textPrimary },
  bubbleTime:     { fontSize: 10, color: Colors.light.textMuted, alignSelf: 'flex-end' },
  voiceTag:       { fontSize: 12 },

  thinkingBubble: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
  thinkingText:   { fontSize: 13, color: Colors.light.textMuted },

  suggestions:        { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  suggestionChip: {
    paddingVertical:   8,
    paddingHorizontal: 14,
    borderRadius:      20,
    backgroundColor:   Colors.light.surface,
    borderWidth:       1,
    borderColor:       Colors.light.border,
  },
  suggestionText: { fontSize: 13, color: Colors.brand.primary, fontWeight: '500' },

  inputBar: {
    flexDirection:     'row',
    alignItems:        'flex-end',
    gap:               10,
    paddingHorizontal: 16,
    paddingVertical:   10,
    backgroundColor:   '#fff',
    borderTopWidth:    1,
    borderTopColor:    Colors.light.border,
  },
  textInput: {
    flex:            1,
    minHeight:       42,
    maxHeight:       120,
    backgroundColor: Colors.light.surface,
    borderRadius:    21,
    paddingHorizontal: 16,
    paddingVertical:   10,
    fontSize:        14,
    color:           Colors.light.textPrimary,
    borderWidth:     1,
    borderColor:     Colors.light.border,
  },
  sendBtn: {
    width:           42,
    height:          42,
    borderRadius:    21,
    backgroundColor: Colors.brand.primary,
    alignItems:      'center',
    justifyContent:  'center',
  },
  sendBtnIcon: { fontSize: 16, color: '#fff', marginLeft: 2 },

  voiceBtn: {
    width:           52,
    height:          52,
    borderRadius:    26,
    backgroundColor: Colors.light.surface,
    borderWidth:     2,
    borderColor:     Colors.brand.primary,
    alignItems:      'center',
    justifyContent:  'center',
  },
  voiceBtnActive: {
    backgroundColor: '#FFE4E4',
    borderColor:     Colors.semantic.error,
  },
  voiceBtnIcon: { fontSize: 22 },

  listeningBar: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    gap:               8,
    paddingVertical:   8,
    backgroundColor:   '#FFF0F0',
    borderTopWidth:    1,
    borderTopColor:    '#FECACA',
  },
  listeningDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.semantic.error },
  listeningText: { fontSize: 13, color: Colors.semantic.error, fontWeight: '500' },
})
