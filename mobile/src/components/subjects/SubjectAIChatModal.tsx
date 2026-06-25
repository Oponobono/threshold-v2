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

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  TextInput, Keyboard, Platform, StyleSheet,
  Animated, ActivityIndicator,
 Image as RNImage } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { generateStudyMaterialFromChat } from '../../services/api/ai';
import { sendHybridChatMessage, generateHybridStudyMaterial, getChatHistory, clearChatHistory, processDocumentUploadHybrid } from '../../services/hybridAIService';
import { LLMProvider, getPreferredLLMProvider } from '../../utils/llmProviderManager';
import { useLocalAIStore } from '../../store/useLocalAIStore';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Markdown from 'react-native-markdown-display';
import { MarkdownWithCode } from '../ui/MarkdownWithCode';

import LottieView from 'lottie-react-native';
import { useTranslation } from 'react-i18next';
import { OfflineIndicator } from '../ui/OfflineIndicator';
import { StudyModeSelector } from '../evaluation/StudyModeSelector';
import { StudyMode } from '../../services/api/types';

const zyrenOrbAnimation = require('../../lottieFiles/ai_orb.json');

// ─── Tokens de color (misma paleta que SubjectAIContextModal) ─────────────────
const PRIMARY  = '#7B72FF';
const ASK_CLR  = '#00C896';
const BG_SHEET = '#0E0E18';
const BORDER   = 'rgba(255,255,255,0.08)';
const TXT_PRI  = '#F0F0F8';
const TXT_SEC  = 'rgba(240,240,248,0.45)';
const USER_BG  = '#1E1E30';
const AI_BG    = `${PRIMARY}18`;

// ─── Componente para tablas desplazables ───────────────────────────────────────
interface TableCellProps {
  content: string;
  isHeader?: boolean;
}

const TableCell: React.FC<TableCellProps> = ({ content, isHeader }) => (
  <View style={[
    tableStyles.cell,
    isHeader && tableStyles.headerCell,
  ]}>
    <Text style={[
      tableStyles.cellText,
      isHeader && tableStyles.headerText,
    ]} numberOfLines={3}>
      {content}
    </Text>
  </View>
);

interface ScrollableTableProps {
  headers: string[];
  rows: string[][];
}

const ScrollableTable: React.FC<ScrollableTableProps> = ({ headers, rows }) => {
  return (
    <View style={tableStyles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={true}
        scrollEventThrottle={16}
        style={tableStyles.scrollView}
      >
        <View style={tableStyles.table}>
          {/* Encabezado */}
          <View style={tableStyles.row}>
            {headers.map((header, i) => (
              <TableCell
                key={`header-${i}`}
                content={header}
                isHeader={true}
              />
            ))}
          </View>

          {/* Filas */}
          {rows.map((row, rowIdx) => (
            <View key={`row-${rowIdx}`} style={tableStyles.row}>
              {row.map((cell, cellIdx) => (
                <TableCell
                  key={`cell-${rowIdx}-${cellIdx}`}
                  content={cell}
                  isHeader={false}
                />
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

// ─── Tipos ────────────────────────────────────────────────────────────────────
interface Message {
  role: 'user' | 'assistant';
  content: string;
  isDocument?: boolean;
  documentStatus?: 'loading' | 'success' | 'error';
  documentName?: string;
  documentId?: string;
  isSystemMessage?: boolean;
}

export interface SubjectAIChatModalProps {
  /** Controla si el modal está visible */
  isVisible: boolean;
  /** Callback para cerrar el modal */
  onClose: () => void;
  /** Callback para volver al selector de contexto */
  onGoBack?: () => void;
  /** ID de la materia */
  subjectId?: string;
  /** ID del usuario */
  userId?: string;
  /** Nombre de la materia para el encabezado */
  subjectName: string;
  /** Contexto académico ensamblado por el backend */
  contextText: string;
  /** Número de archivos que alimentan el contexto */
  contextItemCount: number;
}

// ─── Utilidad para parsear tablas ─────────────────────────────────────────────
const parseMarkdownTable = (text: string) => {
  const lines = text.split('\n');
  if (lines.length < 3) return null;

  // Función auxiliar para parsear una línea de tabla
  const parseLine = (line: string) => {
    return line
      .split('|')
      .slice(1, -1) // Remover el primer y último elemento (siempre vacíos)
      .map(cell => cell.trim());
  };

  try {
    // Parsear header
    const headers = parseLine(lines[0]);
    if (headers.length === 0) return null;

    // Validar separador
    const separator = lines[1];
    if (!separator.includes('-') || !separator.includes('|')) return null;

    // Parsear filas de datos (desde la línea 2 en adelante)
    const rows: string[][] = [];
    for (let i = 2; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.length === 0) continue; // Saltar líneas vacías
      
      const cells = parseLine(line);
      if (cells.length > 0) {
        // Asegurar que tiene el mismo número de columnas
        while (cells.length < headers.length) {
          cells.push('');
        }
        if (cells.length > headers.length) {
          cells.length = headers.length;
        }
        rows.push(cells);
      }
    }

    return rows.length > 0 ? { headers, rows } : null;
  } catch {
    return null;
  }
};

// ─── Burbuja de mensaje ───────────────────────────────────────────────────────
const MessageBubble: React.FC<{ msg: Message; onOpenImage: (src: string) => void }> = ({ msg, onOpenImage }) => {
  const { t } = useTranslation();
  const isUser = msg.role === 'user';
  const localMarkdownRules = useMemo(() => createMarkdownRenderRules(onOpenImage), [onOpenImage]);
  
  if (msg.isDocument) {
    return (
      <View style={[s.bubbleRow, s.bubbleRowUser]}>
        <View style={[s.bubble, s.bubbleUser, { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, minWidth: 200 }]}>
          <Ionicons name="document-text" size={24} color={PRIMARY} />
          <View style={{ flex: 1 }}>
            <Text style={[s.bubbleText, s.bubbleTextUser, { fontWeight: '600' }]} numberOfLines={1}>
              {msg.documentName}
            </Text>
            <Text style={{ fontSize: 11, color: TXT_SEC, marginTop: 2 }}>{t('subjects.documentUploaded')}</Text>
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
          <View>
            {(() => {
              // Función para encontrar y extraer tablas
              const extractTables = (content: string) => {
                const parts: { type: 'text' | 'table'; content: string; data?: { headers: string[]; rows: string[][] } }[] = [];
                const lines = content.split('\n');
                let currentText = '';
                let i = 0;

                while (i < lines.length) {
                  const line = lines[i];
                  
                  // Detectar si esta línea comienza una tabla
                  if (line.trim().startsWith('|') && i + 1 < lines.length) {
                    const nextLine = lines[i + 1];
                    if (nextLine.includes('|') && nextLine.includes('-')) {
                      // Esto podría ser una tabla, coleccionar todas las líneas
                      const tableLines = [line, nextLine];
                      let j = i + 2;
                      
                      // Coleccionar filas de datos
                      while (j < lines.length && lines[j].trim().startsWith('|')) {
                        tableLines.push(lines[j]);
                        j++;
                      }

                      // Intentar parsear como tabla
                      const tableText = tableLines.join('\n');
                      const parsed = parseMarkdownTable(tableText);
                      
                      if (parsed && parsed.headers.length > 0 && parsed.rows.length > 0) {
                        // Es una tabla válida, guardar el texto acumulado y la tabla
                        if (currentText.trim()) {
                          parts.push({ type: 'text', content: currentText });
                          currentText = '';
                        }
                        parts.push({ type: 'table', content: tableText, data: parsed });
                        i = j;
                        continue;
                      }
                    }
                  }

                  // No es tabla, acumular como texto
                  currentText += (currentText ? '\n' : '') + line;
                  i++;
                }

                // Agregar el texto restante
                if (currentText.trim()) {
                  parts.push({ type: 'text', content: currentText });
                }

                return parts;
              };

              const parts = extractTables(msg.content);
              
              if (parts.some(p => p.type === 'table')) {
                return (
                  <View>
                    {parts.map((part, idx) => 
                      part.type === 'text' ? (
                        <MarkdownWithCode key={`text-${idx}`} style={markdownStyles} rules={localMarkdownRules}>
                          {part.content}
                        </MarkdownWithCode>
                      ) : (
                        <ScrollableTable
                          key={`table-${idx}`}
                          headers={part.data!.headers}
                          rows={part.data!.rows}
                        />
                      )
                    )}
                  </View>
                );
              } else {
                return (
                  <MarkdownWithCode style={markdownStyles} rules={localMarkdownRules}>
                    {msg.content}
                  </MarkdownWithCode>
                );
              }
            })()}
          </View>
        ) : (
          <Text style={[s.bubbleText, s.bubbleTextUser]}>
            {msg.content}
          </Text>
        )}
      </View>
    </View>
  );
};

// ─── Indicador de "Zyren está procesando..." ─────────────────────────────────
const ThinkingIndicator: React.FC = () => {
  const { t } = useTranslation();
  const pulseAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 1200, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  return (
    <View style={[s.bubbleRow, s.bubbleRowAI]}>
      <View style={s.aiAvatar}>
        <LottieView source={zyrenOrbAnimation} autoPlay loop style={{ width: 26, height: 26 }} />
      </View>
      <View style={[s.bubble, s.bubbleAI, { paddingVertical: 12, paddingHorizontal: 16 }]}>
        <Animated.View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, opacity: pulseAnim }}>
          <Ionicons name="cog-outline" size={14} color={TXT_SEC} />
          <Text style={{ fontSize: 12, color: TXT_SEC, fontStyle: 'italic' }}>
            {t('ai.thinking', 'Zyren está procesando e indexando las ideas clave...')}
          </Text>
        </Animated.View>
      </View>
    </View>
  );
};

// ─── Indicador de escritura animado ──────────────────────────────────────────
const TypingIndicator: React.FC = () => {
  // Tres puntos que pulsan en secuencia
  const anim1 = useRef(new Animated.Value(0)).current;
  const anim2 = useRef(new Animated.Value(0)).current;
  const anim3 = useRef(new Animated.Value(0)).current;
  const anims = useMemo(() => [anim1, anim2, anim3], [anim1, anim2, anim3]);

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
  }, [anims]);

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
  isVisible, onClose, onGoBack, subjectName, subjectId, userId, contextText, contextItemCount,
}) => {
  const { t } = useTranslation();
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
  const [streamingContent, setStreamingContent] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const streamAccumulated = useRef('');

  const streamingMarkdownRules = useMemo(() => createMarkdownRenderRules(setLightboxImage), []);

  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastAnim = useRef(new Animated.Value(-100)).current;

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    toastAnim.setValue(-100);
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 20, duration: 300, useNativeDriver: true }),
      Animated.delay(5000),
      Animated.timing(toastAnim, { toValue: -100, duration: 300, useNativeDriver: true })
    ]).start(() => setToastMessage(null));
  }, [toastAnim]);

  // ── Generate material panel ────────────────────────────────────────────────
  const [showGenPanel, setShowGenPanel] = useState(false);
  const [genMode, setGenMode] = useState<StudyMode>('mixed');
  const [genCount, setGenCount] = useState('10');
  const [isGenerating, setIsGenerating] = useState(false);
  const genPanelAnim = useRef(new Animated.Value(0)).current;

  const openGenPanel = useCallback(() => {
    setShowGenPanel(true);
    Animated.spring(genPanelAnim, { toValue: 1, friction: 8, useNativeDriver: true }).start();
  }, [genPanelAnim]);
  const closeGenPanel = useCallback(() => {
    Animated.timing(genPanelAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setShowGenPanel(false));
  }, [genPanelAnim]);

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
  const handleGenerateMaterial = useCallback(async (overrideMode?: StudyMode, overrideCount?: number) => {
    console.log('[AIChatModal] 🎓 Iniciando handleGenerateMaterial:', {
      overrideMode,
      overrideCount,
      subjectId,
      userId,
    });

    if (!subjectId || !userId) {
      console.warn('[AIChatModal] ⚠️ subjectId o userId faltantes en handleGenerateMaterial!');
      return;
    }

    const ctx = buildGenerationContext();
    console.log('[AIChatModal] Contexto de generación obtenido:', {
      length: ctx?.length || 0,
      preview: ctx ? ctx.substring(0, 150) : 'vacio',
    });

    if (!ctx.trim()) {
      showToast(t('subjects.addContextBeforeGenerate'));
      closeGenPanel();
      return;
    }

    setIsGenerating(true);
    const activeMode = overrideMode || genMode;
    const activeCount = overrideCount || parseInt(genCount) || 10;
    const modeLabels: Record<string, string> = { flashcard: t('subjects.modeFlashcard'), multiple_choice: t('subjects.modeMultipleChoice'), boolean: t('subjects.modeTrueFalse'), mixed: t('subjects.modeMixed') };
    const deckTitle = `${modeLabels[activeMode] || t('subjects.material')} — ${subjectName}`;
    
    try {
      console.log('[AIChatModal] 📡 Enviando petición a generateStudyMaterialFromChat:', {
        mode: activeMode,
        count: activeCount,
        title: deckTitle,
      });

      const deck = await generateStudyMaterialFromChat({
        contextText: ctx,
        mode: activeMode,
        count: activeCount,
        title: deckTitle,
        subjectId: subjectId!,
        userId: userId!,
      });

      console.log('[AIChatModal] ✅ Respuesta exitosa de generateStudyMaterialFromChat:', deck);

      closeGenPanel();
      const aiMsg: Message = {
        role: 'assistant',
        content: t('ai.deckGeneratedAiMsg', {
          title: deck.title,
          count: deck.card_count,
          mode: modeLabels[activeMode],
          defaultValue: `✅ **Deck created!** I generated **"${deck.title}"** with **${deck.card_count} items** of type *${modeLabels[activeMode]}*. Find it in the Flashcards section ↓`
        }),
      };
      setMessages(prev => [...prev, aiMsg]);
      showToast(t('ai.deckGeneratedToast', { title: deck.title, count: deck.card_count, defaultValue: `Deck "${deck.title}" ready with ${deck.card_count} items ✅` }));
    } catch (err: any) {
      console.error('[AIChatModal] ❌ Error en generateStudyMaterialFromChat:', {
        message: err.message,
        err,
      });
      showToast(t('subjects.generateError', { error: err.message }));
    } finally {
      setIsGenerating(false);
    }
  }, [subjectId, userId, buildGenerationContext, showToast, closeGenPanel, genMode, genCount, subjectName, t]);

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
        } catch {}
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
          setMessages((data.messages || []).slice(-6));
          setCurrentProvider(provider);
        })
        .catch(err => console.warn('[AIChat] Error cargando historial:', err))
        .finally(() => setIsLoading(false));
    }
  }, [isVisible, subjectId, userId]);

  /** Sincronizar padding con el teclado */
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  /** Forzar proveedor local si el modo offline está activo */
  const forceOfflineMode = useLocalAIStore((s) => s.forceOfflineMode);
  useEffect(() => {
    if (forceOfflineMode) {
      setCurrentProvider('local');
    }
  }, [forceOfflineMode]);

  /** Scroll automático al último mensaje */
  const scrollToBottom = useCallback(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  useEffect(() => {
    if (messages.length > 0) scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  // ── Persistir historial a MMKV tras cada intercambio ──
  // Sin esto, al cerrar y reabrir el modal (o si la nube no está disponible)
  // el historial se pierde porque el estado React se descarta y la caché MMKV
  // solo se escribía una vez en getChatHistory (stale snapshot).
  const effectiveUserId = userId || 1;
  useEffect(() => {
    if (!subjectId || messages.length === 0) return;
    const timer = setTimeout(() => {
      try {
        const mmkv = require('react-native-mmkv').createMMKV();
        mmkv.set(
          `cache:chat_history:${effectiveUserId}:${subjectId}`,
          JSON.stringify({ session_id: sessionId, messages })
        );
      } catch (e) {
        console.warn('[AIChat] Error guardando historial en caché:', e);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [messages, sessionId, subjectId, effectiveUserId]);

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
    const updatedMessages = [...messages, userMsg].slice(-6);
    setMessages(updatedMessages);
    setInputText('');
    setIsLoading(true);

    const isLocalProvider = currentProvider === 'local';

    if (isLocalProvider) {
      setIsThinking(true);
      setStreamingContent(null);
      streamAccumulated.current = '';
    }

    try {
      const combinedContext = localContextText + uploadedDocContext;

      const onLocalToken = (token: string, accumulated: string, reasoning: string) => {
        streamAccumulated.current = accumulated;
        const thinkMatch = accumulated.match(/<think>([\s\S]*?)<\/think>/);
        if (thinkMatch) {
          setIsThinking(false);
          const afterThink = accumulated.substring(accumulated.indexOf('</think>') + 8).trim();
          setStreamingContent(afterThink || '…');
        } else if (reasoning || accumulated.includes('<think>')) {
          setIsThinking(true);
        } else {
          setIsThinking(false);
          setStreamingContent(accumulated);
        }
      };

      const data = await sendHybridChatMessage(
        combinedContext,
        updatedMessages.filter(m => !m.isDocument),
        sessionId,
        currentProvider,
        isLocalProvider ? onLocalToken : undefined,
      );

      if (data?.context_truncated) setIsTruncated(true);

      let replyContent: string = data?.reply?.content || t('subjects.couldNotProcess');
      let cleanReply = replyContent.replace(/<think>[\s\S]*?<\/think>/g, '').trim() || replyContent;
      // Strip markdown images from AI response
      cleanReply = cleanReply.replace(/!\[.*?\]\(.*?\)/g, '');
      // Strip stray DECK_ACTION markers without valid JSON
      cleanReply = cleanReply.replace(/%%DECK_ACTION%%(?!\{)/g, '');

      console.log('[AIChatModal] 📥 Respuesta recibida del backend:', {
        hasData: !!data,
        hasDeck: !!data?.deck,
        deckPersisted: data?.deck?.persisted,
        deckData: data?.deck,
        replyLength: replyContent?.length,
      });

      // ── Verificar si el mazo fue creado automáticamente por el backend ─────────
      if (data?.deck && data.deck.persisted) {
        console.log('[AIChatModal] 🎉 Mazo persistido automáticamente por el backend:', data.deck);
        // El backend ya creó el mazo automáticamente
        replyContent = replyContent.replace(/%+DECK_ACTION%+[\s\S]*?%+END%+/g, '').trim();
        
        const deckMsg = t('ai.deckSuccessMsg', {
          title: data.deck.deckTitle,
          count: data.deck.count,
          mode: data.deck.mode === 'mixed' ? t('subjects.modeMixed') : data.deck.mode,
          defaultValue: `✅ **Deck successfully created!**\n\n📚 **${data.deck.deckTitle}**\nItems: ${data.deck.count}\nType: ${data.deck.mode === 'mixed' ? 'Mixed' : data.deck.mode}\n\nFind it in your Flashcards section → `
        });
        
        setMessages(prev => [
          ...prev,
          { role: 'assistant' as const, content: replyContent || '✨' },
          { role: 'assistant' as const, content: deckMsg, isSystemMessage: true }
        ].slice(-6));
        setIsLoading(false);
        showToast(t('ai.deckGeneratedToast', { title: data.deck.deckTitle, count: data.deck.count, defaultValue: `Deck "${data.deck.deckTitle}" ready with ${data.deck.count} items! 🎉` }));
      } else {
        // ── Interceptar señal de generación de mazo (fallback si backend no lo creó) ──
        const rawSignal = data?.deckActionSignal || replyContent.match(/%+DECK_ACTION%+(\{[\s\S]*?\})%+END%+/)?.[1];
        
        console.log('[AIChatModal] 🎯 Chequeo de señal %%DECK_ACTION%% en fallback:', {
          matched: !!rawSignal,
          rawSignal: rawSignal,
        });

        if (rawSignal) {
          // Limpiar la señal del mensaje visible si aún existe en replyContent
          replyContent = replyContent.replace(/%+DECK_ACTION%+[\s\S]*?%+END%+/g, '').trim();

          // Mostrar el mensaje limpio inmediatamente
          setMessages(prev => [...prev, { role: 'assistant' as const, content: replyContent }].slice(-6));
          setIsLoading(false);

          // Parsear parámetros y generar el mazo en segundo plano
          try {
            const deckParams = JSON.parse(rawSignal);
            const mode: StudyMode = deckParams.mode || 'mixed';
            const count: number = deckParams.count || 10;
            console.log('[AIChatModal] 🧠 Parse de parámetros %%DECK_ACTION%% exitoso:', { mode, count });
            // Ejecutar generación con los parámetros que Zyren decidió
            await handleGenerateMaterial(mode, count);
          } catch (parseErr: any) {
            console.error('[AIChatModal] ❌ Error parseando parámetros JSON de la señal:', parseErr.message);
          }
        } else {
          // Respuesta normal del chat sin generación de mazo
          setMessages(prev => [...prev, { role: 'assistant' as const, content: cleanReply }].slice(-6));
          setIsLoading(false);
        }
      }
      setIsThinking(false);
      setStreamingContent(null);
      streamAccumulated.current = '';
    } catch (err: any) {
      console.warn('[AIChatModal] ❌ Capturado error en handleSend:', {
        message: err.message,
        provider: currentProvider,
        err,
      });

      const isGroqLimit = currentProvider === 'groq' && (
        err.message?.toLowerCase().includes('limit') ||
        err.message?.toLowerCase().includes('too large') ||
        err.message?.toLowerCase().includes('rate') ||
        err.message?.toLowerCase().includes('tpm') ||
        err.message?.toLowerCase().includes('429') ||
        err.message?.toLowerCase().includes('exhausted')
      );

      const errorMessage = isGroqLimit
        ? t('ai.groqLimitError', `⚠️ **Límite de procesamiento alcanzado en el Modelo Rápido ⚡**\n\nHemos superado temporalmente la capacidad de tokens permitida para el motor ultrarrápido de Zyren.\n\n**¿Cómo deseas continuar?**\n\n• **Usa el Modelo de Razonamiento Avanzado 🧠:** Cambia de motor pulsando el ícono del cerebro en la cabecera del chat para seguir estudiando sin interrupciones.\n• **Espera un momento ⏳:** En aproximadamente 1 minuto el canal rápido estará libre nuevamente y podrás seguir conversando.`)
        : t('ai.connectionError', {
            provider: currentProvider === 'groq' ? t('ai.fastModel') : t('ai.advancedModel'),
            error: err.message || t('ai.networkError'),
            defaultValue: `⚠️ **Inconveniente de conexión con Zyren (${currentProvider === 'groq' ? t('ai.fastModel') : t('ai.advancedModel')})**\n\nNo pudimos procesar tu mensaje debido al siguiente inconveniente:\n*${err.message || t('ai.networkError')}*.\n\nPor favor, intenta de nuevo en unos instantes o cambia de modelo en la parte superior.`
          });

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: errorMessage,
      }]);
    } finally {
      setIsLoading(false);
      setIsThinking(false);
      setStreamingContent(null);
      streamAccumulated.current = '';
    }
  }, [inputText, isLoading, messages, localContextText, uploadedDocContext, sessionId, currentProvider, handleGenerateMaterial, showToast, t]);

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
      const processResult = await processDocumentUploadHybrid(fileObj, `Extrae la información completa y puntos clave de este documento para que sirva de contexto en nuestra conversación.`);

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
      showToast(t('subjects.documentExpiryInfo'));

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
        content: t('subjects.documentProcessError', { error: err.message }),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsUploadingDocument(false);
    }
  }, [subjectId, showToast, t]);

  if (!isVisible) return null;

  return (
    <View style={StyleSheet.absoluteFill}>
      <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={handleClose} />
      <View style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: keyboardHeight }}>
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
            <View style={s.headerContainer}>
              {/* Fila Superior */}
              <View style={s.headerTopRow}>
                <View style={s.aiIconWrap}>
                  <LottieView source={zyrenOrbAnimation} autoPlay loop style={{ width: 34, height: 34 }} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.title}>Zyren</Text>
                  <Text style={s.subtitle} numberOfLines={1}>{subjectName}</Text>
                </View>
                {/* Volver al selector de contexto */}
                {onGoBack && (
                  <TouchableOpacity style={s.goBackBtn} onPress={onGoBack} activeOpacity={0.7}>
                    <Ionicons name="arrow-back" size={18} color={TXT_PRI} />
                  </TouchableOpacity>
                )}
                {/* Cerrar */}
                <TouchableOpacity style={s.closeBtn} onPress={handleClose} activeOpacity={0.7}>
                  <Ionicons name="close" size={18} color={TXT_PRI} />
                </TouchableOpacity>
              </View>

              <OfflineIndicator />

              {/* Fila Inferior */}
              <View style={s.headerBottomRow}>
                {/* Selector de proveedor LLM compacto */}
                <View style={s.providerSelector}>
                  <TouchableOpacity
                    style={[s.providerOption, currentProvider === 'groq' && s.providerOptionActive, forceOfflineMode && s.providerOptionDisabled]}
                    onPress={() => !forceOfflineMode && setCurrentProvider('groq')}
                    activeOpacity={0.7}
                    disabled={forceOfflineMode}
                  >
                    <Text style={[s.providerLabel, currentProvider === 'groq' && s.providerLabelActive, forceOfflineMode && s.providerLabelDisabled]}>
                      ⚡
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.providerOption, currentProvider === 'gemini' && s.providerOptionActive, forceOfflineMode && s.providerOptionDisabled]}
                    onPress={() => !forceOfflineMode && setCurrentProvider('gemini')}
                    activeOpacity={0.7}
                    disabled={forceOfflineMode}
                  >
                    <Text style={[s.providerLabel, currentProvider === 'gemini' && s.providerLabelActive, forceOfflineMode && s.providerLabelDisabled]}>
                      🧠
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.providerOption, currentProvider === 'local' && s.providerOptionActive]}
                    onPress={() => setCurrentProvider('local')}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.providerLabel, currentProvider === 'local' && s.providerLabelActive]}>
                      📱
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Chip de contexto activo */}
                {contextItemCount > 0 && (
                  <View style={s.contextChip}>
                    <Ionicons name="layers-outline" size={11} color={ASK_CLR} />
                    <Text style={s.contextChipText}>
                      {t('subjects.contextSources', { count: contextItemCount })}
                    </Text>
                  </View>
                )}

                <View style={{ flex: 1 }} />

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
              </View>
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
                  {t('subjects.messageExpiryInfo')}
                </Text>
              </View>

              {isTruncated && (
                <View style={[s.infoBanner, { backgroundColor: 'rgba(255, 149, 0, 0.12)', borderColor: 'rgba(255, 149, 0, 0.25)', borderWidth: 1, paddingVertical: 10 }]}>
                  <Ionicons name="warning-outline" size={16} color="#FF9500" />
                  <Text style={[s.infoBannerText, { color: '#FF9500', fontWeight: '600' }]}>
                    {t('subjects.truncatedWarning')}
                  </Text>
                </View>
              )}

              {messages.length === 0 ? (
                /* Estado vacío — sugerencias iniciales */
                <View style={s.emptyState}>
                  <View style={s.emptyIconWrap}>
                    <LottieView source={zyrenOrbAnimation} autoPlay loop style={{ width: 64, height: 64 }} />
                  </View>
                  <Text style={s.emptyTitle}>{t('ai.emptyTitle', '¿Qué quieres saber?')}</Text>
                  <Text style={s.emptySubtitle}>
                    {contextItemCount > 0 ? t('subjects.emptySubtitleWithCount', { count: contextItemCount, subject: subjectName }) : t('subjects.emptySubtitleNoCount', { subject: subjectName })}
                  </Text>

                  {/* Sugerencias de preguntas */}
                  {[
                    t('ai.questionSuggestion1', '¿Cuáles son los conceptos más importantes?'),
                    t('ai.questionSuggestion2', '¿Puedes hacer un resumen de los temas?'),
                    t('ai.questionSuggestion3', 'Explícame el tema principal con ejemplos.'),
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
                messages.map((msg, i) => <MessageBubble key={i} msg={msg} onOpenImage={setLightboxImage} />)
              )}

              {/* Indicador de "Zyren está procesando..." (modo local pensante) */}
              {isLoading && isThinking && <ThinkingIndicator />}

              {/* Streaming de tokens parciales (modo local, después de </think>) */}
              {isLoading && streamingContent && !isThinking && (
                <View style={[s.bubbleRow, s.bubbleRowAI]}>
                  <View style={s.aiAvatar}>
                    <LottieView source={zyrenOrbAnimation} autoPlay loop style={{ width: 26, height: 26 }} />
                  </View>
                  <View style={[s.bubble, s.bubbleAI]}>
                    <Markdown style={markdownStyles} rules={streamingMarkdownRules}>
                      {streamingContent}
                    </Markdown>
                  </View>
                </View>
              )}

              {/* Indicador de "pensando..." (modo cloud) */}
              {isLoading && !isThinking && !streamingContent && <TypingIndicator />}
            </ScrollView>

            {/* Input de texto */}
            <View style={s.inputRow}>
              <TextInput
                style={s.input}
                placeholder={t('subjects.chatPlaceholder')}
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
                <Text style={s.genPanelTitle}>{t('subjects.generateStudyMaterial')}</Text>
                <TouchableOpacity onPress={closeGenPanel}>
                  <Ionicons name="close" size={18} color={TXT_PRI} />
                </TouchableOpacity>
              </View>
              <Text style={s.genPanelSubtitle}>{t('ai.deckReadySubtitle', 'Zyren usará el contexto activo para crear el mazo')}</Text>

              <StudyModeSelector selected={genMode} onSelect={setGenMode} />

              <Text style={s.genCountLabel}>{t('ai.itemsCount', 'Cantidad de ítems')}</Text>
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
                  : <Text style={s.genConfirmBtnText}>{t('subjects.generateWithZyren')}</Text>
                }
              </TouchableOpacity>
            </Animated.View>
          )}

          </View>
        </View>

        {/* ─── Lightbox de imágenes ───────────────────────────────────── */}
        {lightboxImage && (
          <TouchableOpacity
            activeOpacity={1}
            style={s.lightboxOverlay}
            onPress={() => setLightboxImage(null)}
          >
            <TouchableOpacity activeOpacity={1} onPress={() => {}}>
              <RNImage
                source={{ uri: lightboxImage }}
                style={{
                  width: 300,
                  height: 400,
                  borderRadius: 14,
                }}
                resizeMode="contain"
              />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
    </View>
  );
};

// ─── Render rules personalizados para Markdown (imágenes) ────────────────────

const ChatImage: React.FC<{ src: string; alt: string; onOpen: () => void }> = ({ src, alt, onOpen }) => {
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  if (failed) {
    return (
      <View style={{ marginVertical: 8, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
        <Text style={{ fontSize: 11, color: TXT_SEC, textAlign: 'center', fontStyle: 'italic' }}>
          {alt || '(imagen no disponible)'}
        </Text>
      </View>
    );
  }

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onOpen} style={{ marginVertical: 8, alignItems: 'center' }}>
      <RNImage
        source={{ uri: src }}
        style={{
          width: 260,
          height: 180,
          borderRadius: 10,
          backgroundColor: 'rgba(255,255,255,0.05)',
        }}
        resizeMode="contain"
        onLoad={() => setLoading(false)}
        onError={() => { setFailed(true); setLoading(false); }}
      />
      {loading ? (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="small" color={PRIMARY} />
        </View>
      ) : null}
      {alt ? (
        <Text style={{ fontSize: 11, color: TXT_SEC, marginTop: 4, textAlign: 'center', fontStyle: 'italic' }}>
          {alt}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
};

const createMarkdownRenderRules = (onOpenImage: (src: string) => void): any => ({
  image: (node: any, children: any, parent: any, styles: any) => {
    const src: string = node?.attributes?.src || '';
    const alt: string = node?.attributes?.alt || '';
    if (!src) return null;

    const isLikelyImage = /\.(png|jpg|jpeg|gif|webp|svg|bmp)(\?|$)/i.test(src) || src.startsWith('http');
    if (!isLikelyImage) return null;

    return <ChatImage key={node.key} src={src} alt={alt} onOpen={() => onOpenImage(src)} />;
  },
});

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
    overflow: 'hidden',
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
  headerContainer: {
    marginBottom: 12,
    paddingHorizontal: 20,
    gap: 12,
  },
  headerTopRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10,
  },
  headerBottomRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8,
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
  goBackBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: BORDER,
    marginRight: 8,
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
    flexShrink: 1,
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
  bubbleText: { fontSize: 14, lineHeight: 21, flexShrink: 1 },
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

  // Lightbox
  lightboxOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
});

// ─── Markdown ─────────────────────────────────────────────────────────────────
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
  table: { marginVertical: 10 },
  thead: { display: 'none' },
  tbody: { display: 'none' },
  tr: { display: 'none' },
  th: { display: 'none' },
  td: { display: 'none' },
});

// ─── Estilos para tablas desplazables ──────────────────────────────────────────
const tableStyles = StyleSheet.create({
  container: {
    marginVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: `${PRIMARY}25`,
    backgroundColor: 'rgba(0,0,0,0.15)',
    overflow: 'hidden',
  } as any,
  scrollView: {
    flexGrow: 0,
  } as any,
  table: {
    // borderCollapse no existe en React Native
  } as any,
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: `${PRIMARY}15`,
  } as any,
  cell: {
    width: 120,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRightWidth: 1,
    borderRightColor: `${PRIMARY}15`,
    justifyContent: 'center',
  } as any,
  headerCell: {
    backgroundColor: `${PRIMARY}20`,
    borderBottomWidth: 2,
    borderBottomColor: `${PRIMARY}40`,
  } as any,
  cellText: {
    fontSize: 12,
    lineHeight: 16,
    color: TXT_PRI,
  } as any,
  headerText: {
    fontSize: 12,
    fontWeight: '700',
    color: PRIMARY,
  } as any,
});
