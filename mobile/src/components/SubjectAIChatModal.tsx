/**
 * SubjectAIChatModal.tsx
 *
 * Modal de chat conversacional con Zyren, el asistente educativo de Threshold.
 * Recibe el contexto académico ya ensamblado (texto OCR, transcripciones, captions)
 * y gestiona el historial de mensajes con el modelo Groq LLaMA en el backend.
 *
 * Características:
 * - Historial de mensajes en burbuja (usuario / Zyren).
 * - Indicador de "pensando..." animado mientras espera la respuesta.
 * - Chip de fuentes activas (cuántos archivos alimentan el contexto).
 * - Botón de nueva conversación para limpiar el historial.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, Modal, TouchableOpacity, ScrollView,
  TextInput, KeyboardAvoidingView, Platform, StyleSheet,
  Animated, ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sendAIChatMessage, getChatHistory, clearChatHistory } from '../services/api/ai';
import { LLMProvider, getPreferredLLMProvider } from '../utils/llmProviderManager';

// ─── Tokens de color (misma paleta que SubjectAIContextModal) ─────────────────
const PRIMARY  = '#7B72FF';
const ASK_CLR  = '#00C896';
const BG_SHEET = '#0E0E18';
const BORDER   = 'rgba(255,255,255,0.08)';
const TXT_PRI  = '#F0F0F8';
const TXT_SEC  = 'rgba(240,240,248,0.45)';
const USER_BG  = '#1E1E30';
const AI_BG    = `${PRIMARY}18`;

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface SubjectAIChatModalProps {
  /** Controla si el modal está visible */
  isVisible: boolean;
  /** Callback para cerrar el modal */
  onClose: () => void;
  /** ID de la materia */
  subjectId?: number;
  /** ID del usuario */
  userId?: number;
  /** Nombre de la materia para el encabezado */
  subjectName: string;
  /** Contexto académico ensamblado por el backend */
  contextText: string;
  /** Número de archivos que alimentan el contexto */
  contextItemCount: number;
}

// ─── Burbuja de mensaje ───────────────────────────────────────────────────────
const MessageBubble: React.FC<{ msg: Message }> = ({ msg }) => {
  const isUser = msg.role === 'user';
  return (
    <View style={[s.bubbleRow, isUser ? s.bubbleRowUser : s.bubbleRowAI]}>
      {/* Ícono del asistente solo para mensajes IA */}
      {!isUser && (
        <View style={s.aiAvatar}>
          <MaterialCommunityIcons name="auto-fix" size={14} color={PRIMARY} />
        </View>
      )}
      <View style={[s.bubble, isUser ? s.bubbleUser : s.bubbleAI]}>
        <Text style={[s.bubbleText, isUser ? s.bubbleTextUser : s.bubbleTextAI]}>
          {msg.content}
        </Text>
      </View>
    </View>
  );
};

// ─── Indicador de escritura animado ──────────────────────────────────────────
const TypingIndicator: React.FC = () => {
  // Tres puntos que pulsan en secuencia
  const anims = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

  useEffect(() => {
    const sequence = anims.map((anim, i) =>
      Animated.sequence([
        Animated.delay(i * 150),
        Animated.loop(
          Animated.sequence([
            Animated.timing(anim, { toValue: 1, duration: 400, useNativeDriver: true }),
            Animated.timing(anim, { toValue: 0, duration: 400, useNativeDriver: true }),
          ])
        ),
      ])
    );
    Animated.parallel(sequence).start();
    return () => anims.forEach(a => a.stopAnimation());
  }, []);

  return (
    <View style={[s.bubbleRow, s.bubbleRowAI]}>
      <View style={s.aiAvatar}>
        <MaterialCommunityIcons name="auto-fix" size={14} color={PRIMARY} />
      </View>
      <View style={[s.bubble, s.bubbleAI, { paddingVertical: 12, paddingHorizontal: 16 }]}>
        <View style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
          {anims.map((anim, i) => (
            <Animated.View
              key={i}
              style={{
                width: 6, height: 6, borderRadius: 3,
                backgroundColor: PRIMARY,
                opacity: anim,
                transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
              }}
            />
          ))}
        </View>
      </View>
    </View>
  );
};

// ─── Componente principal ─────────────────────────────────────────────────────
export const SubjectAIChatModal: React.FC<SubjectAIChatModalProps> = ({
  isVisible, onClose, subjectName, subjectId, userId, contextText, contextItemCount,
}) => {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);

  const [messages, setMessages]   = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<number | undefined>();
  const [isTruncated, setIsTruncated] = useState(false);
  const [currentProvider, setCurrentProvider] = useState<LLMProvider>('groq');

  /** Cargar historial y preferencia de proveedor cuando se abre el modal */
  useEffect(() => {
    const effectiveUserId = userId || 1; // Fallback para desarrollo/testing
    if (isVisible && subjectId) {
      setIsLoading(true);
      Promise.all([
        getChatHistory(effectiveUserId, subjectId),
        getPreferredLLMProvider(),
      ])
        .then(([data, provider]) => {
          setSessionId(data.session_id);
          setMessages(data.messages || []);
          setCurrentProvider(provider);
        })
        .catch(err => console.warn('[AIChat] Error cargando historial:', err))
        .finally(() => setIsLoading(false));
    }
  }, [isVisible, subjectId, userId]);

  /** Scroll automático al último mensaje */
  const scrollToBottom = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  useEffect(() => {
    if (messages.length > 0) scrollToBottom();
  }, [messages, isLoading]);

  /** Limpiar historial al cerrar */
  const handleClose = useCallback(() => {
    setMessages([]);
    setInputText('');
    onClose();
  }, [onClose]);

  /** Enviar un mensaje a Zyren */
  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isLoading) return;

    // Agregar mensaje del usuario al historial
    const userMsg: Message = { role: 'user', content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInputText('');
    setIsLoading(true);

    try {
      // Enviar al backend con el contexto, historial, session_id y proveedor seleccionado
      const data = await sendAIChatMessage(contextText, updatedMessages, sessionId, currentProvider);
      
      // Verificar si el contexto fue truncado
      if (data?.context_truncated) {
        setIsTruncated(true);
      }

      const aiMsg: Message = {
        role: 'assistant',
        content: data?.reply?.content || 'Lo siento, no pude procesar tu pregunta.',
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err: any) {
      console.error('[AIChatTelemetry] Error crítico al enviar mensaje:', err);
      if (err.details) {
        console.error('[AIChatTelemetry] Detalles del error:', JSON.stringify(err.details, null, 2));
      }

      // Mostrar error como mensaje de Zyren
      const errMsg: Message = {
        role: 'assistant',
        content: `⚠️ Error al conectar con Zyren (${currentProvider}): ${err.message || 'Error desconocido'}. Revisa la consola para más detalles.`,
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [inputText, isLoading, messages, contextText, sessionId, currentProvider]);

  /** Limpiar la conversación actual y crear una nueva */
  const handleClearHistory = useCallback(async () => {
    const effectiveUserId = userId || 1;
    if (!subjectId) {
      setMessages([]);
      return;
    }
    try {
      setIsLoading(true);
      const data = await clearChatHistory(effectiveUserId, subjectId);
      setSessionId(data.session_id);
      setMessages([]);
    } catch (err) {
      console.warn('[AIChat] Error limpiando historial:', err);
      setMessages([]); // fallback
    } finally {
      setIsLoading(false);
    }
  }, [subjectId, userId]);

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <View style={s.backdrop}>
          <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]}>

            {/* Asa de arrastre */}
            <View style={s.handle} />

            {/* Encabezado */}
            <View style={s.header}>
              <View style={s.aiIconWrap}>
                <MaterialCommunityIcons name="auto-fix" size={17} color={PRIMARY} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.title}>Zyren</Text>
                <Text style={s.subtitle} numberOfLines={1}>{subjectName}</Text>
              </View>

              {/* Selector de proveedor LLM compacto */}
              <View style={s.providerSelector}>
                <TouchableOpacity
                  style={[s.providerOption, currentProvider === 'groq' && s.providerOptionActive]}
                  onPress={() => setCurrentProvider('groq')}
                  activeOpacity={0.7}
                >
                  <Text style={[s.providerLabel, currentProvider === 'groq' && s.providerLabelActive]}>
                    ⚡
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.providerOption, currentProvider === 'gemini' && s.providerOptionActive]}
                  onPress={() => setCurrentProvider('gemini')}
                  activeOpacity={0.7}
                >
                  <Text style={[s.providerLabel, currentProvider === 'gemini' && s.providerLabelActive]}>
                    🧠
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Chip de contexto activo */}
              {contextItemCount > 0 && (
                <View style={s.contextChip}>
                  <Ionicons name="layers-outline" size={11} color={ASK_CLR} />
                  <Text style={s.contextChipText}>
                    {contextItemCount} {contextItemCount === 1 ? 'fuente' : 'fuentes'}
                  </Text>
                </View>
              )}

              {/* Botón nueva conversación */}
              {messages.length > 0 && (
                <TouchableOpacity
                  style={s.clearBtn}
                  onPress={handleClearHistory}
                  disabled={isLoading}
                  activeOpacity={0.7}
                >
                  <Ionicons name="refresh-outline" size={16} color={TXT_SEC} />
                </TouchableOpacity>
              )}

              {/* Cerrar */}
              <TouchableOpacity style={s.closeBtn} onPress={handleClose} activeOpacity={0.7}>
                <Ionicons name="close" size={18} color={TXT_PRI} />
              </TouchableOpacity>
            </View>

            {/* Área de mensajes */}
            <ScrollView
              ref={scrollRef}
              style={{ flex: 1 }}
              contentContainerStyle={s.messageList}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Banner de seguridad 24hrs */}
              <View style={s.infoBanner}>
                <Ionicons name="information-circle-outline" size={14} color={TXT_SEC} />
                <Text style={s.infoBannerText}>
                  Por seguridad y rendimiento, los mensajes de más de 24 horas se eliminan automáticamente.
                </Text>
              </View>

              {/* Aviso de documento truncado */}
              {isTruncated && (
                <View style={[s.infoBanner, { backgroundColor: 'rgba(255, 149, 0, 0.12)', borderColor: 'rgba(255, 149, 0, 0.25)', borderWidth: 1, paddingVertical: 10 }]}>
                  <Ionicons name="warning-outline" size={16} color="#FF9500" />
                  <Text style={[s.infoBannerText, { color: '#FF9500', fontWeight: '600' }]}>
                    No pude leer todo el documento ya que es muy extenso, sin embargo tengo algo de información para ayudarte.
                  </Text>
                </View>
              )}

              {messages.length === 0 ? (
                /* Estado vacío — sugerencias iniciales */
                <View style={s.emptyState}>
                  <View style={s.emptyIconWrap}>
                    <MaterialCommunityIcons name="auto-fix" size={32} color={PRIMARY} />
                  </View>
                  <Text style={s.emptyTitle}>¿Qué quieres saber?</Text>
                  <Text style={s.emptySubtitle}>
                    Tengo acceso a {contextItemCount > 0 ? `${contextItemCount} archivo${contextItemCount > 1 ? 's' : ''}` : 'tus materiales'} de {subjectName}.
                  </Text>

                  {/* Sugerencias de preguntas */}
                  {[
                    '¿Cuáles son los conceptos más importantes?',
                    '¿Puedes hacer un resumen de los temas?',
                    'Explícame el tema principal con ejemplos.',
                  ].map((q, i) => (
                    <TouchableOpacity
                      key={i}
                      style={s.suggestionChip}
                      onPress={() => {
                        setInputText(q);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={s.suggestionText}>{q}</Text>
                      <Ionicons name="arrow-forward" size={13} color={PRIMARY} />
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)
              )}

              {/* Indicador de "pensando..." */}
              {isLoading && <TypingIndicator />}
            </ScrollView>

            {/* Input de texto */}
            <View style={s.inputRow}>
              <TextInput
                style={s.input}
                placeholder="Haz una pregunta..."
                placeholderTextColor={TXT_SEC}
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={1000}
                returnKeyType="send"
                blurOnSubmit
                onSubmitEditing={handleSend}
              />
              <TouchableOpacity
                style={[s.sendBtn, (!inputText.trim() || isLoading) && s.sendBtnDisabled]}
                onPress={handleSend}
                disabled={!inputText.trim() || isLoading}
                activeOpacity={0.8}
              >
                {isLoading
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="send" size={18} color="#fff" />
                }
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

// ─── Estilos ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.62)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: BG_SHEET,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    height: '92%',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  handle: {
    width: 38, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignSelf: 'center', marginBottom: 16,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10, marginBottom: 12,
    paddingHorizontal: 20,
  },
  aiIconWrap: {
    width: 34, height: 34, borderRadius: 11,
    backgroundColor: `${PRIMARY}20`,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: `${PRIMARY}30`,
  },
  title: {
    fontSize: 16, fontWeight: '800', color: TXT_PRI, letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 11, color: TXT_SEC,
  },
  contextChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: `${ASK_CLR}14`,
    borderRadius: 12, borderWidth: 1, borderColor: `${ASK_CLR}30`,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  contextChipText: {
    fontSize: 11, fontWeight: '700', color: ASK_CLR,
  },
  clearBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: BORDER,
  },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: BORDER,
  },

  // Lista de mensajes
  messageList: {
    paddingHorizontal: 16, paddingBottom: 12, paddingTop: 4,
    flexGrow: 1,
  },
  infoBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 8, paddingHorizontal: 16, marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12, alignSelf: 'center',
  },
  infoBannerText: {
    fontSize: 11, color: TXT_SEC, textAlign: 'center', flexShrink: 1,
  },

  // Estado vacío
  emptyState: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingTop: 40, gap: 12, paddingHorizontal: 24,
  },
  emptyIconWrap: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: `${PRIMARY}18`,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: `${PRIMARY}30`,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 18, fontWeight: '800', color: TXT_PRI, letterSpacing: -0.4,
  },
  emptySubtitle: {
    fontSize: 13, color: TXT_SEC, textAlign: 'center', lineHeight: 20,
    marginBottom: 12,
  },
  suggestionChip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    width: '100%', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14, borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  suggestionText: {
    flex: 1, fontSize: 13, color: TXT_PRI, fontWeight: '500',
  },

  // Burbujas de chat
  bubbleRow: {
    flexDirection: 'row', marginBottom: 10, alignItems: 'flex-end',
  },
  bubbleRowUser: { justifyContent: 'flex-end' },
  bubbleRowAI:   { justifyContent: 'flex-start', gap: 8 },
  aiAvatar: {
    width: 26, height: 26, borderRadius: 9,
    backgroundColor: `${PRIMARY}20`,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: `${PRIMARY}30`,
  },
  bubble: {
    maxWidth: '78%', borderRadius: 18,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  bubbleUser: {
    backgroundColor: USER_BG,
    borderBottomRightRadius: 4,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  bubbleAI: {
    backgroundColor: AI_BG,
    borderBottomLeftRadius: 4,
    borderWidth: 1, borderColor: `${PRIMARY}25`,
  },
  bubbleText: { fontSize: 14, lineHeight: 21 },
  bubbleTextUser: { color: TXT_PRI },
  bubbleTextAI:   { color: TXT_PRI },

  // Input
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4,
    borderTopWidth: 1, borderTopColor: BORDER,
    backgroundColor: 'rgba(14,14,24,0.95)',
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 18, borderWidth: 1, borderColor: BORDER,
    color: TXT_PRI, fontSize: 14,
    paddingHorizontal: 14, paddingVertical: 10,
    maxHeight: 100,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 14,
    backgroundColor: PRIMARY,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5, shadowRadius: 10, elevation: 8,
  },
  sendBtnDisabled: {
    opacity: 0.35, shadowOpacity: 0, elevation: 0,
  },
  
  // Selector de proveedor LLM
  providerSelector: {
    flexDirection: 'row', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8, padding: 4,
    borderWidth: 1, borderColor: BORDER,
  },
  providerOption: {
    width: 28, height: 28,
    borderRadius: 6,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  providerOptionActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  providerLabel: {
    fontSize: 14,
  },
  providerLabelActive: {
    fontSize: 14,
  },
});
