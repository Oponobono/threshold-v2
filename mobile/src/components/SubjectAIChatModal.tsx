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
 * - Botón de upload de documentos directo a Gemini.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, Modal, TouchableOpacity, ScrollView,
  TextInput, KeyboardAvoidingView, Platform, StyleSheet,
  Animated, ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sendAIChatMessage, getChatHistory, clearChatHistory, processDocumentUpload, generateStudyMaterialFromChat } from '../services/api/ai';
import { LLMProvider, getPreferredLLMProvider } from '../utils/llmProviderManager';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Markdown from 'react-native-markdown-display';
import LottieView from 'lottie-react-native';
import { StudyModeSelector } from './evaluation/StudyModeSelector';
import { StudyMode } from '../services/api/types';

const zyrenOrbAnimation = require('../lottieFiles/ai_orb.json');

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
  isDocument?: boolean;
  documentStatus?: 'loading' | 'success' | 'error';
  documentName?: string;
  documentId?: string;
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
  
  if (msg.isDocument) {
    return (
      <View style={[s.bubbleRow, s.bubbleRowUser]}>
        <View style={[s.bubble, s.bubbleUser, { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, minWidth: 200 }]}>
          <Ionicons name="document-text" size={24} color={PRIMARY} />
          <View style={{ flex: 1 }}>
            <Text style={[s.bubbleText, s.bubbleTextUser, { fontWeight: '600' }]} numberOfLines={1}>
              {msg.documentName}
            </Text>
            <Text style={{ fontSize: 11, color: TXT_SEC, marginTop: 2 }}>Documento subido</Text>
          </View>
          {msg.documentStatus === 'loading' && <ActivityIndicator size="small" color={PRIMARY} />}
          {msg.documentStatus === 'success' && <Ionicons name="checkmark-circle" size={20} color={ASK_CLR} />}
          {msg.documentStatus === 'error' && <Ionicons name="close-circle" size={20} color="#FF3B30" />}
        </View>
      </View>
    );
  }

  return (
    <View style={[s.bubbleRow, isUser ? s.bubbleRowUser : s.bubbleRowAI]}>
      {/* Ícono del asistente solo para mensajes IA */}
      {!isUser && (
        <View style={s.aiAvatar}>
          <LottieView source={zyrenOrbAnimation} autoPlay loop style={{ width: 26, height: 26 }} />
        </View>
      )}
      <View style={[s.bubble, isUser ? s.bubbleUser : s.bubbleAI]}>
        {!isUser ? (
          <Markdown style={markdownStyles}>
            {msg.content}
          </Markdown>
        ) : (
          <Text style={[s.bubbleText, s.bubbleTextUser]}>
            {msg.content}
          </Text>
        )}
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
        <LottieView source={zyrenOrbAnimation} autoPlay loop style={{ width: 26, height: 26 }} />
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
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const [localContextText, setLocalContextText] = useState(contextText);
  const [uploadedDocContext, setUploadedDocContext] = useState('');
  
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastAnim = useRef(new Animated.Value(-100)).current;

  // ── Generate material panel ────────────────────────────────────────────────
  const [showGenPanel, setShowGenPanel] = useState(false);
  const [genMode, setGenMode] = useState<StudyMode>('mixed');
  const [genCount, setGenCount] = useState('10');
  const [isGenerating, setIsGenerating] = useState(false);
  const genPanelAnim = useRef(new Animated.Value(0)).current;

  const openGenPanel = () => {
    setShowGenPanel(true);
    Animated.spring(genPanelAnim, { toValue: 1, friction: 8, useNativeDriver: true }).start();
  };
  const closeGenPanel = () => {
    Animated.timing(genPanelAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setShowGenPanel(false));
  };

  /**
   * Construye el texto de contexto disponible para generación.
   * Prioridad: contexto académico explícito → documento subido → historial de la conversación.
   */
  const buildGenerationContext = useCallback(() => {
    const explicit = (localContextText || '') + (uploadedDocContext || '');
    if (explicit.trim()) return explicit;
    // Fallback: usar el historial de conversación como contexto
    if (messages.length > 0) {
      return messages
        .filter(m => !m.isDocument)
        .map(m => `${m.role === 'user' ? 'Estudiante' : 'Zyren'}: ${m.content}`)
        .join('\n\n');
    }
    return '';
  }, [localContextText, uploadedDocContext, messages]);

  /**
   * Ejecuta la generación del mazo con los parámetros actuales del panel.
   * Usa buildGenerationContext() para obtener el mejor contexto disponible.
   */
  const handleGenerateMaterial = async (overrideMode?: StudyMode, overrideCount?: number) => {
    if (!subjectId || !userId) return;
    const ctx = buildGenerationContext();
    if (!ctx.trim()) {
      showToast('Abre una conversación o agrega contexto antes de generar.');
      closeGenPanel();
      return;
    }
    setIsGenerating(true);
    const activeMode = overrideMode || genMode;
    const activeCount = overrideCount || parseInt(genCount) || 10;
    const modeLabels: Record<string, string> = { flashcard: 'Flashcards', multiple_choice: 'ECAES', boolean: 'V/F', mixed: 'Mixto' };
    const deckTitle = `${modeLabels[activeMode] || 'Material'} — ${subjectName}`;
    try {
      const deck = await generateStudyMaterialFromChat({
        contextText: ctx,
        mode: activeMode,
        count: activeCount,
        title: deckTitle,
        subjectId: subjectId!,
        userId: userId!,
      });
      closeGenPanel();
      const aiMsg: Message = {
        role: 'assistant',
        content: `✅ **¡Mazo creado!** Generé **"${deck.title}"** con **${deck.card_count} ítems** de tipo *${modeLabels[activeMode]}*. Encuéntralo en la sección de Flashcards ↓`,
      };
      setMessages(prev => [...prev, aiMsg]);
      showToast(`Mazo "${deck.title}" listo con ${deck.card_count} ítems ✅`);
    } catch (err: any) {
      showToast(`Error generando: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    toastAnim.setValue(-100);
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 20, duration: 300, useNativeDriver: true }),
      Animated.delay(5000),
      Animated.timing(toastAnim, { toValue: -100, duration: 300, useNativeDriver: true })
    ]).start(() => setToastMessage(null));
  }, [toastAnim]);

  useEffect(() => {
    setLocalContextText(contextText);
  }, [contextText]);

  // Cargar documento subido desde AsyncStorage (expira a las 12 horas)
  useEffect(() => {
    if (isVisible && subjectId) {
      const loadSavedDoc = async () => {
        try {
          const key = `@chat_doc_${subjectId}`;
          const savedStr = await AsyncStorage.getItem(key);
          if (savedStr) {
            const saved = JSON.parse(savedStr);
            const now = Date.now();
            const hours12 = 12 * 60 * 60 * 1000;
            if (now - saved.timestamp > hours12) {
              await AsyncStorage.removeItem(key);
            } else {
              setUploadedDocContext(saved.text);
              setMessages(prev => {
                if (prev.some(m => m.isDocument)) return prev;
                return [...prev, {
                  role: 'user',
                  content: `[Documento recuperado: ${saved.fileName}]`,
                  isDocument: true,
                  documentName: saved.fileName,
                  documentStatus: 'success',
                  documentId: 'saved_doc',
                }];
              });
            }
          }
        } catch (err) {}
      };
      loadSavedDoc();
    }
  }, [isVisible, subjectId]);

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

    const userMsg: Message = { role: 'user', content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInputText('');
    setIsLoading(true);

    try {
      const combinedContext = localContextText + uploadedDocContext;
      const data = await sendAIChatMessage(combinedContext, updatedMessages.filter(m => !m.isDocument), sessionId, currentProvider);

      if (data?.context_truncated) setIsTruncated(true);

      let replyContent: string = data?.reply?.content || 'Lo siento, no pude procesar tu pregunta.';

      // ── Interceptar señal de generación de mazo ──────────────────────────────
      const deckSignalMatch = replyContent.match(/%%DECK_ACTION%%(\{[\s\S]*?\})%%END%%/);
      if (deckSignalMatch) {
        // Limpiar la señal del mensaje visible
        replyContent = replyContent.replace(/%%DECK_ACTION%%[\s\S]*?%%END%%/g, '').trim();

        // Mostrar el mensaje limpio inmediatamente
        setMessages(prev => [...prev, { role: 'assistant', content: replyContent }]);
        setIsLoading(false);

        // Parsear parámetros y generar el mazo en segundo plano
        try {
          const deckParams = JSON.parse(deckSignalMatch[1]);
          const mode: StudyMode = deckParams.mode || 'mixed';
          const count: number = deckParams.count || 10;
          // Ejecutar generación con los parámetros que Zyren decidió
          await handleGenerateMaterial(mode, count);
        } catch (_) {
          // Si falla el parse, igual se muestra el mensaje de Zyren
        }
        return; // Ya añadimos el mensaje y llamamos a handleGenerateMaterial
      }
      // ──────────────────────────────────────────────────────────────

      setMessages(prev => [...prev, { role: 'assistant', content: replyContent }]);
    } catch (err: any) {
      console.error('[AIChatTelemetry] Error crítico al enviar mensaje:', err);
      if (err.details) console.error('[AIChatTelemetry] Detalles:', JSON.stringify(err.details, null, 2));
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `⚠️ Error al conectar con Zyren (${currentProvider}): ${err.message || 'Error desconocido'}.`,
      }]);
    } finally {
      setIsLoading(false);
    }
  }, [inputText, isLoading, messages, localContextText, uploadedDocContext, sessionId, currentProvider, handleGenerateMaterial]);

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

  /** Cargar y procesar documento directamente */
  const handleUploadDocument = useCallback(async () => {
    try {
      const pickerResult = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/html', 'text/markdown'],
      });

      if (pickerResult.canceled) {
        console.log('[AIChat] Upload cancelado');
        return;
      }

      const file = pickerResult.assets[0];
      console.log(`[AIChat] Documento seleccionado: ${file.name}, ${file.size} bytes`);

      setIsUploadingDocument(true);
      const docId = Date.now().toString();

      const docMsg: Message = {
        role: 'user',
        content: `[Documento adjunto: ${file.name}]`,
        isDocument: true,
        documentName: file.name,
        documentStatus: 'loading',
        documentId: docId,
      };
      
      setMessages(prev => [...prev, docMsg]);

      // Preparar el archivo con el formato que React Native fetch FormData necesita
      const fileObj = {
        uri: file.uri,
        name: file.name || 'documento.pdf',
        type: file.mimeType || 'application/pdf',
      };

      // Procesar con Gemini
      const processResult = await processDocumentUpload(fileObj, `Extrae la información completa y puntos clave de este documento para que sirva de contexto en nuestra conversación.`);

      const newDocText = `\n\n[DOCUMENTO SUBIDO: ${file.name}]\n${processResult.result}`;

      // Actualizar el estado del mensaje a success y remover documentos anteriores
      setMessages(prev => {
        const filtered = prev.filter(m => !m.isDocument || m.documentId === docId);
        return filtered.map(m => m.documentId === docId ? { ...m, documentStatus: 'success' } : m);
      });

      // Actualizar el contexto del documento subido
      setUploadedDocContext(newDocText);

      // Guardar en AsyncStorage para mantenerlo por 12 horas
      if (subjectId) {
        AsyncStorage.setItem(`@chat_doc_${subjectId}`, JSON.stringify({
          fileName: file.name,
          text: newDocText,
          timestamp: Date.now(),
        })).catch(console.warn);
      }

      // Mostrar el toast informativo
      showToast(`El documento estará disponible por 12 horas o hasta subir uno nuevo.`);

    } catch (err: any) {
      console.error('[AIChat] Error al cargar documento:', err);
      
      // Actualizar el estado del mensaje a error
      setMessages(prev => {
        const lastDocs = prev.filter(m => m.isDocument && m.documentStatus === 'loading');
        if (lastDocs.length > 0) {
           const lastDocId = lastDocs[lastDocs.length - 1].documentId;
           return prev.map(m => m.documentId === lastDocId ? { ...m, documentStatus: 'error' } : m);
        }
        return prev;
      });

      const errorMsg: Message = {
        role: 'assistant',
        content: `⚠️ Error al procesar el documento: ${err.message}`,
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsUploadingDocument(false);
    }
  }, []);

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

            {/* Toast Flotante */}
            {toastMessage && (
              <Animated.View style={[s.toastContainer, { transform: [{ translateY: toastAnim }] }]}>
                <Ionicons name="information-circle" size={18} color="#FFF" />
                <Text style={s.toastText}>{toastMessage}</Text>
              </Animated.View>
            )}

            {/* Encabezado */}
            <View style={s.header}>
              <View style={s.aiIconWrap}>
                <LottieView source={zyrenOrbAnimation} autoPlay loop style={{ width: 34, height: 34 }} />
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

              {/* Botón upload documento (Solo Gemini) */}
              {currentProvider === 'gemini' && (
                <TouchableOpacity
                  style={s.clearBtn}
                  onPress={handleUploadDocument}
                  disabled={isLoading || isUploadingDocument}
                  activeOpacity={0.7}
                >
                  <Ionicons name="document-attach-outline" size={16} color={TXT_SEC} />
                </TouchableOpacity>
              )}

              {/* 🎓 Botón Generar Material de Estudio */}
              <TouchableOpacity
                style={[s.clearBtn, s.genBtn]}
                onPress={openGenPanel}
                disabled={isLoading || isGenerating}
                activeOpacity={0.7}
              >
                <Ionicons name="school-outline" size={16} color={PRIMARY} />
              </TouchableOpacity>

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
                    <LottieView source={zyrenOrbAnimation} autoPlay loop style={{ width: 64, height: 64 }} />
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

          {/* ── Panel de generación de material ────────────────────────── */}
          {showGenPanel && (
            <Animated.View style={[
              s.genPanel,
              { opacity: genPanelAnim, transform: [{ translateY: genPanelAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }] }
            ]}>
              <View style={s.genPanelHeader}>
                <Text style={s.genPanelTitle}>🎓 Generar material de estudio</Text>
                <TouchableOpacity onPress={closeGenPanel}>
                  <Ionicons name="close" size={18} color={TXT_PRI} />
                </TouchableOpacity>
              </View>
              <Text style={s.genPanelSubtitle}>Zyren usará el contexto activo para crear el mazo</Text>

              <StudyModeSelector selected={genMode} onSelect={setGenMode} />

              <Text style={s.genCountLabel}>Cantidad de ítems</Text>
              <TextInput
                style={s.genCountInput}
                value={genCount}
                onChangeText={setGenCount}
                keyboardType="number-pad"
                placeholder="10"
                placeholderTextColor={TXT_SEC}
              />

              <TouchableOpacity
                style={[s.genConfirmBtn, isGenerating && { opacity: 0.6 }]}
                onPress={() => handleGenerateMaterial()}
                disabled={isGenerating}
                activeOpacity={0.8}
              >
                {isGenerating
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={s.genConfirmBtnText}>Generar con Zyren ✨</Text>
                }
              </TouchableOpacity>
            </Animated.View>
          )}

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
    width: 34, height: 34,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'transparent',
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
    width: 64, height: 64,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
    backgroundColor: 'transparent',
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
    width: 26, height: 26,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'transparent',
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
  providerOptionDisabled: {
    opacity: 0.4,
  },
  providerLabel: {
    fontSize: 14,
  },
  providerLabelActive: {
    fontSize: 14,
  },
  providerLabelDisabled: {
    opacity: 0.5,
  },
  
  // Toast
  toastContainer: {
    position: 'absolute',
    top: 10,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(123,114,255,0.9)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  toastText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },

  // Generation panel
  genBtn: {
    borderColor: `${PRIMARY}40`,
    backgroundColor: `${PRIMARY}14`,
  },
  genPanel: {
    position: 'absolute',
    bottom: 80, left: 16, right: 16,
    backgroundColor: '#16162A',
    borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: `${PRIMARY}30`,
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 16, elevation: 12,
    zIndex: 200,
  },
  genPanelHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 6,
  },
  genPanelTitle: { fontSize: 15, fontWeight: '800', color: TXT_PRI },
  genPanelSubtitle: { fontSize: 12, color: TXT_SEC, marginBottom: 14 },
  genCountLabel: { fontSize: 12, fontWeight: '600', color: TXT_PRI, marginTop: 14, marginBottom: 8 },
  genCountInput: {
    backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: BORDER,
    borderRadius: 12, color: TXT_PRI, fontSize: 15,
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16,
  },
  genConfirmBtn: {
    backgroundColor: PRIMARY, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45, shadowRadius: 10, elevation: 8,
  },
  genConfirmBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});

const markdownStyles = StyleSheet.create({
  body: {
    fontSize: 14,
    lineHeight: 21,
    color: TXT_PRI,
  },
  strong: {
    fontWeight: 'bold',
  },
  em: {
    fontStyle: 'italic',
  },
  link: {
    color: PRIMARY,
    textDecorationLine: 'underline',
  },
  heading1: { fontSize: 18, fontWeight: 'bold', color: TXT_PRI, marginTop: 10, marginBottom: 4 },
  heading2: { fontSize: 16, fontWeight: 'bold', color: TXT_PRI, marginTop: 8, marginBottom: 4 },
  heading3: { fontSize: 15, fontWeight: 'bold', color: TXT_PRI, marginTop: 6, marginBottom: 4 },
  bullet_list: { marginTop: 4, marginBottom: 4 },
  ordered_list: { marginTop: 4, marginBottom: 4 },
  list_item: { marginBottom: 4 },
  paragraph: { marginTop: 4, marginBottom: 4 },
  code_inline: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 4, borderRadius: 4, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  code_block: { backgroundColor: 'rgba(0,0,0,0.3)', padding: 10, borderRadius: 8, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginVertical: 6 },
});
