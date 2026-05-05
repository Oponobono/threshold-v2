import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, Modal, TouchableOpacity, TextInput, FlatList,
  KeyboardAvoidingView, Platform, ActivityIndicator, Keyboard
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as FileSystem from 'expo-file-system/legacy';
import { theme } from '../styles/theme';
import { chatStyles as styles } from '../styles/SubjectAIChatModal.styles';
import { AIContextItemData } from './AIContextItem';
import { extractTextFromImage } from '../services/api/documents';
import { sendAIChatMessage } from '../services/api';
import { ChatMessageBubble, ChatMessage } from './ChatMessageBubble';

export interface SubjectAIChatModalProps {
  isVisible: boolean;
  onClose: () => void;
  selectedItems: AIContextItemData[];
  subjectName: string;
}

/**
 * SubjectAIChatModal.tsx
 *
 * Pantalla modal que aloja la interfaz de chat interactivo con la Inteligencia Artificial.
 * Se encarga de procesar los archivos seleccionados por el usuario (Contexto) al abrirse,
 * extrayendo texto mediante OCR o cargando transcripciones locales, para luego iniciar
 * una conversación estilo chat. Mantiene el historial de la conversación usando la API de Groq/Gemini.
 *
 * @param isVisible - Estado de visibilidad del modal de chat.
 * @param onClose - Función ejecutada al cerrar el chat (limpia el estado).
 * @param selectedItems - Arreglo con la metadata de los archivos seleccionados como contexto.
 * @param subjectName - Nombre de la materia (usado en el mensaje de bienvenida).
 */
export const SubjectAIChatModal: React.FC<SubjectAIChatModalProps> = ({
  isVisible,
  onClose,
  selectedItems,
  subjectName,
}) => {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoadingContext, setIsLoadingContext] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [contextText, setContextText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  // Compilar contexto al abrir
  useEffect(() => {
    if (isVisible && selectedItems.length > 0 && !contextText) {
      compileContext();
    }
    if (!isVisible) {
      setMessages([]);
      setContextText('');
      setInputText('');
    }
  }, [isVisible]);

  const compileContext = async () => {
    setIsLoadingContext(true);
    let compiled = '';

    for (const item of selectedItems) {
      compiled += `\n\n=== ARCHIVO: ${item.label} (${item.type}) ===\n`;
      try {
        if (item.type === 'photo' || item.type === 'document') {
          if (item.uri) {
            const base64 = await FileSystem.readAsStringAsync(item.uri, { encoding: FileSystem.EncodingType.Base64 });
            const ocrText = await extractTextFromImage(base64);
            compiled += ocrText ? ocrText : (t('ai.errors.noClearText') || '(No se pudo extraer texto claro de la imagen)');
          }
        } else if (item.type === 'recording' || item.type === 'video') {
          const transcriptUri = item.rawItem?.transcript_uri;
          const summaryUri = item.rawItem?.summary_uri;
          
          if (transcriptUri) {
            const transcriptText = await FileSystem.readAsStringAsync(transcriptUri);
            compiled += transcriptText;
          } else if (summaryUri) {
            const summaryText = await FileSystem.readAsStringAsync(summaryUri);
            compiled += summaryText;
          } else {
            compiled += (t('ai.errors.noTranscription') || '(Aún no hay transcripción generada para este archivo. El estudiante debe transcribirlo primero en su respectiva pantalla.)');
          }
        }
      } catch (error) {
        console.error(`Error leyendo contexto para ${item.label}:`, error);
        compiled += (t('ai.errors.localFileRead') || '(Error al leer el archivo local)');
      }
    }

    setContextText(compiled.trim());
    setIsLoadingContext(false);
    
    // Mensaje de bienvenida inicial
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: t('ai.chatWelcome', { count: selectedItems.length, subject: subjectName }) || `¡Hola! He analizado los ${selectedItems.length} archivos de contexto de **${subjectName}**.\n\n¿Qué te gustaría saber o repasar sobre esto?`
      }
    ]);
  };

  const handleSend = async () => {
    if (!inputText.trim() || isSending || isLoadingContext) return;

    const userText = inputText.trim();
    const newUserMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: userText };
    setMessages(prev => [...prev, newUserMsg]);
    setInputText('');
    setIsSending(true);
    Keyboard.dismiss();

    try {
      // Formato esperado por Groq: array de { role, content } sin 'id'
      const historyForApi = messages.map(m => ({ role: m.role, content: m.content }));
      historyForApi.push({ role: 'user', content: userText });

      const response = await sendAIChatMessage(contextText, historyForApi);
      
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.reply.content
      };
      
      setMessages(prev => [...prev, botMsg]);
    } catch (error: any) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: t('ai.errors.processFailed', { error: error.message }) || `Error: No pude procesar tu pregunta. ${error.message}`
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Modal visible={isVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: Platform.OS === 'ios' ? 0 : insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="chevron-down" size={24} color={theme.colors.text.primary} />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <MaterialCommunityIcons name="auto-fix" size={20} color={theme.colors.primary} />
            <Text style={styles.headerTitle}>{t('ai.tutorTitle') || 'Tutor IA'}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{selectedItems.length} {t('ai.refs') || 'refs'}</Text>
            </View>
          </View>
          <View style={{ width: 40 }} />
        </View>

        {/* Body */}
        {isLoadingContext ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.loadingText}>{t('ai.readingContext') || 'Leyendo y consolidando contexto...'}</Text>
            <Text style={styles.loadingSub}>
              {t('ai.processingFiles', { count: selectedItems.length }) || `Procesando ${selectedItems.length} archivos para responder tus dudas.`}
            </Text>
          </View>
        ) : (
          <KeyboardAvoidingView 
            style={{ flex: 1 }} 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={i => i.id}
              renderItem={({ item }) => <ChatMessageBubble item={item} />}
              contentContainerStyle={styles.chatList}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
              onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
            />

            {/* Input Area */}
            <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder={t('ai.placeholderChat') || 'Escribe tu pregunta...'}
                  placeholderTextColor={theme.colors.text.secondary}
                  value={inputText}
                  onChangeText={setInputText}
                  multiline
                  maxLength={500}
                />
                <TouchableOpacity 
                  onPress={handleSend} 
                  disabled={!inputText.trim() || isSending}
                  style={[
                    styles.sendBtn, 
                    (!inputText.trim() || isSending) && styles.sendBtnDisabled
                  ]}
                >
                  {isSending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="send" size={18} color="#fff" />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        )}
      </View>
    </Modal>
  );
};
