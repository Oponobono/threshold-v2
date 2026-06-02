import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Pressable,
  ScrollView,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { theme } from '../../styles/theme';
import { flashcardImportStyles as s } from '../../styles/FlashcardImportModal.styles';
import { useCustomAlert } from '../ui/CustomAlert';
import { type Subject } from '../../services/api';
import { saveImportedDeck, updateLocalDeckSubject } from '../../services/localFlashcardService';

export interface FlashcardImportModalProps {
  isVisible: boolean;
  onClose: () => void;
  subjects: Subject[];
  onImportSuccess?: () => void;
}

interface CardItem {
  type: 'flashcard' | 'multiple_choice' | 'boolean';
  data: any;
  hint?: string;
  explanation?: string;
}

interface DeckJSON {
  title: string;
  description?: string;
  subject_id?: number;
  cards?: CardItem[];
}

interface ImportedDeck {
  id: number;
  title: string;
  description?: string;
  cardCount: number;
}

/**
 * FlashcardImportModal.tsx
 *
 * Modal para importar mazos desde archivos JSON.
 * Flujo: Importar → Seleccionar/Cambiar materia
 */
export const FlashcardImportModal: React.FC<FlashcardImportModalProps> = ({
  isVisible,
  onClose,
  subjects,
  onImportSuccess,
}) => {

  const { t } = useTranslation();
  const { showAlert } = useCustomAlert();
  const [isProcessing, setIsProcessing] = useState(false);
  const [importedDeck, setImportedDeck] = useState<ImportedDeck | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);

  const handleLaunchPicker = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const file = result.assets[0];
      await handleImportJSON(file);
    } catch (error: any) {
      console.error('[FlashcardImportModal] DocumentPicker error:', error);
      showAlert({
        title: t('common.error'),
        message: t('flashcards.filePickerError'),
        type: 'error',
      });
    }
  };

  const handleDownloadTemplate = async () => {
    const languagesList = [
      'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'Go', 'Rust',
      'PHP', 'Swift', 'Kotlin', 'Ruby', 'SQL', 'HTML/XML', 'CSS', 'Bash/Shell',
      'PowerShell', 'R', 'Scala', 'Groovy', 'Elixir', 'Dart', 'Objective-C',
      'VB.NET', 'JSON', 'GraphQL', 'MongoDB',
    ];

    const t_ = t;
    const templateDeck: any = {
      _info: t_('flashcards.template.supportedLanguages', { count: languagesList.length, languages: languagesList.join(', ') }),
      title: t_('flashcards.template.title'),
      description: t_('flashcards.template.description'),
      cards: [
        {
          type: 'flashcard',
          data: {
            front: t_('flashcards.template.fieldFront'),
            back: t_('flashcards.template.fieldBack'),
          },
          hint: t_('flashcards.template.hint'),
          explanation: t_('flashcards.template.explanation'),
        },
        {
          type: 'multiple_choice',
          data: {
            question: t_('flashcards.template.mcQuestion'),
            options: [
              t_('flashcards.template.mcOption1'),
              t_('flashcards.template.mcOption2'),
              t_('flashcards.template.mcOption3'),
              t_('flashcards.template.mcOption4'),
            ],
            correctIndex: 0,
          },
          hint: t_('flashcards.template.hintShort'),
          explanation: t_('flashcards.template.mcExplanation'),
        },
        {
          type: 'boolean',
          data: {
            question: t_('flashcards.template.boolQuestion'),
            correctAnswer: true,
          },
          hint: t_('flashcards.template.hintShort'),
          explanation: t_('flashcards.template.boolExplanation'),
        },
        {
          type: 'flashcard',
          data: {
            front: t_('flashcards.template.gitFront'),
            back: t_('flashcards.template.gitBack'),
          },
          hint: t_('flashcards.template.gitHint'),
          explanation: t_('flashcards.template.gitExplanation'),
        },
      ],
    };

    try {
      const jsonString = JSON.stringify(templateDeck, null, 2);
      const fileName = t('flashcards.template.fileName');
      const tempFilePath = `${FileSystem.documentDirectory}${fileName}`;
      
      // Guardar el archivo temporalmente
      await FileSystem.writeAsStringAsync(tempFilePath, jsonString, {
        encoding: 'utf8',
      });

      // Compartir el archivo
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(tempFilePath, {
          mimeType: 'application/json',
          dialogTitle: t('flashcards.template.dialogTitle'),
        });
      } else {
        showAlert({
          title: t('common.error'),
          message: t('flashcards.shareNotAvailable'),
          type: 'error',
        });
      }
    } catch (error: any) {
      console.error('Error compartiendo plantilla:', error);
      showAlert({
        title: t('common.error'),
        message: t('flashcards.shareTemplateFailed'),
        type: 'error',
      });
    }
  };

  /**
   * Sanitiza un objeto eliminando claves peligrosas (__proto__, constructor, prototype)
   */
  /**
   * Elimina etiquetas HTML para evitar inyección de scripts (XSS)
   */
  const sanitizeText = (text: string | null | undefined): string => {
    if (!text) return '';
    return text.replace(/<[^>]*>?/gm, '');
  };

  const sanitizeJSON = (obj: any): any => {
    if (!obj || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(sanitizeJSON);

    const sanitized: any = {};
    for (const key of Object.keys(obj)) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
      sanitized[key] = typeof obj[key] === 'object' && obj[key] !== null ? sanitizeJSON(obj[key]) : obj[key];
    }
    return sanitized;
  };

  /**
   * Valida que el content_json tenga la estructura correcta según su tipo
   */
  const validateCardSchema = (type: string, data: any): string | null => {
    if (!data || typeof data !== 'object') return t('flashcards.cardRequiresData');

    switch (type) {
      case 'flashcard':
        if (!data.front || typeof data.front !== 'string') return t('flashcards.cardRequiresFront');
        if (!data.back || typeof data.back !== 'string') return t('flashcards.cardRequiresBack');
        break;
      case 'multiple_choice':
        if (!data.question || typeof data.question !== 'string') return t('flashcards.cardRequiresMCQuestion');
        if (!Array.isArray(data.options) || data.options.length < 2) return t('flashcards.cardRequiresOptions');
        if (typeof data.correctIndex !== 'number') return t('flashcards.cardRequiresCorrectIndex');
        if (data.correctIndex < 0 || data.correctIndex >= data.options.length) return t('flashcards.cardCorrectIndexOutOfRange');
        break;
      case 'boolean':
        if (!data.question || typeof data.question !== 'string') return t('flashcards.cardRequiresBoolQuestion');
        if (typeof data.correctAnswer !== 'boolean') return t('flashcards.cardRequiresBoolAnswer');
        break;
      default:
        return t('flashcards.cardTypeNotSupported', { type });
    }
    return null;
  };

  const handleImportJSON = async (file: DocumentPicker.DocumentPickerAsset) => {
    try {
      setIsProcessing(true);

      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size && file.size > maxSize) {
        showAlert({
        title: t('common.error'),
        message: t('flashcards.fileTooLarge'),
          type: 'error',
        });
        setIsProcessing(false);
        return;
      }

      // Leer el contenido del archivo JSON
      const jsonContent = await FileSystem.readAsStringAsync(file.uri);
      const rawData = JSON.parse(jsonContent);

      // Sanitizar contra prototype pollution
      const deckData: DeckJSON = sanitizeJSON(rawData);

      // Validar estructura básica
      if (!deckData.title || !deckData.title.trim()) {
        showAlert({
        title: t('common.error'),
        message: t('flashcards.jsonMissingTitle'),
          type: 'error',
        });
        setIsProcessing(false);
        return;
      }

      // Validar límite de tarjetas
      if (deckData.cards && deckData.cards.length > 20) {
        showAlert({
        title: t('common.error'),
        message: t('flashcards.maxCardsExceeded'),
          type: 'error',
        });
        setIsProcessing(false);
        return;
      }

      // Validar tamaño de cada tarjeta
      if (deckData.cards) {
        for (let i = 0; i < deckData.cards.length; i++) {
          const card = deckData.cards[i];
          const jsonSize = new TextEncoder().encode(JSON.stringify(card.data)).length;
          if (jsonSize > 50 * 1024) {
            showAlert({
            title: t('common.error'),
            message: t('flashcards.cardTooLarge', { num: i + 1 }),
              type: 'error',
            });
            setIsProcessing(false);
            return;
          }
        }
      }

      // Validar esquema de cada tarjeta
      if (deckData.cards) {
        for (let i = 0; i < deckData.cards.length; i++) {
          const card = deckData.cards[i];
          const schemaError = validateCardSchema(card.type || 'flashcard', card.data);
          if (schemaError) {
            showAlert({
            title: t('common.error'),
            message: t('flashcards.cardNumError', { num: i + 1, error: schemaError }),
              type: 'error',
            });
            setIsProcessing(false);
            return;
          }
        }
      }

      const cards: { type: 'flashcard' | 'multiple_choice' | 'boolean'; data: any; hint?: string; explanation?: string }[] = [];
      if (deckData.cards && Array.isArray(deckData.cards)) {
        for (const card of deckData.cards) {
          const itemType = card.type || 'flashcard';
          if (!['flashcard', 'multiple_choice', 'boolean'].includes(itemType)) continue;
          if (!card.data) continue;
          const normalizedData = { ...card.data };
          if (normalizedData.correct_index !== undefined) {
            normalizedData.correctIndex = normalizedData.correct_index;
            delete normalizedData.correct_index;
          }
          if (normalizedData.correct_answer !== undefined) {
            normalizedData.correctAnswer = normalizedData.correct_answer;
            delete normalizedData.correct_answer;
          }
          const safeData: any = {};
          for (const key in normalizedData) {
            if (typeof normalizedData[key] === 'string') {
              safeData[key] = sanitizeText(normalizedData[key]);
            } else if (Array.isArray(normalizedData[key])) {
              safeData[key] = normalizedData[key].map((item: any) => typeof item === 'string' ? sanitizeText(item) : item);
            } else {
              safeData[key] = normalizedData[key];
            }
          }
          cards.push({ type: itemType, data: safeData, hint: sanitizeText(card.hint), explanation: sanitizeText(card.explanation) });
        }
      }

      const deck = await saveImportedDeck(
        sanitizeText(deckData.title),
        sanitizeText(deckData.description),
        cards,
        null,
      );

      setImportedDeck({
        id: deck.id,
        title: deck.title,
        description: deck.description,
        cardCount: deck.card_count,
      });

      setIsProcessing(false);

      if (cards.length > 0) {
        showAlert({
          title: t('common.success'),
          message: t('flashcards.importComplete', { title: deckData.title, successCount: cards.length }),
          type: 'success',
        });
        onImportSuccess?.();
        setImportedDeck(null);
        setSelectedSubjectId(null);
        onClose();
      }
    } catch (error: any) {
      console.error('[FlashcardImportModal] Error importando:', error);

      let errorMessage = t('flashcards.importError');
      if (error.message.includes('JSON')) {
        errorMessage = t('flashcards.invalidJSON');
      } else if (error.message) {
        errorMessage = error.message;
      }

      showAlert({
        title: t('common.error'),
        message: errorMessage,
        type: 'error',
      });
      setIsProcessing(false);
    }
  };

  const handleConfirmSubject = async () => {
    if (!importedDeck || !selectedSubjectId) {
      showAlert({
        title: t('common.error'),
        message: t('flashcards.pleaseSelectSubject'),
        type: 'error',
      });
      return;
    }

    try {
      setIsProcessing(true);
      updateLocalDeckSubject(importedDeck.id, selectedSubjectId);
      
      showAlert({
        title: t('common.success'),
        message: t('flashcards.importSuccess', { title: importedDeck.title, count: importedDeck.cardCount }),
        type: 'success',
      });

      onImportSuccess?.();
      
      // Reset state
      setImportedDeck(null);
      setSelectedSubjectId(null);
      onClose();
    } catch (error: any) {
      console.error('[FlashcardImportModal] Error actualizando materia:', error);
      showAlert({
        title: t('common.error'),
        message: t('flashcards.subjectAssignmentError'),
        type: 'error',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable
          style={s.modal}
          onPress={() => null}
        >
          {/* Header */}
          <View style={s.header}>
            <View style={s.headerLeft}>
              <Text style={s.headerTitle}>
                {importedDeck ? t('flashcards.subject') : t('flashcards.importDeck')}
              </Text>
            </View>
            <TouchableOpacity 
              onPress={() => {
                if (importedDeck) {
                  setImportedDeck(null);
                } else {
                  onClose();
                }
              }} 
              disabled={isProcessing} 
              style={s.closeBtn}
            >
              <Ionicons name={importedDeck ? 'arrow-back' : 'close'} size={16} color={theme.colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Body - Import File Screen */}
          {!importedDeck ? (
            <View>
              <Text
                style={{
                  fontSize: 14,
                  color: theme.colors.text.secondary,
                  marginBottom: 20,
                  lineHeight: 20,
                  textAlign: 'center',
                }}
              >
                {t('flashcards.importDeckDescription')}
              </Text>

              {/* Launch Button */}
              <TouchableOpacity
                onPress={handleLaunchPicker}
                disabled={isProcessing}
                style={{
                  backgroundColor: theme.colors.primary,
                  borderRadius: 12,
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  opacity: isProcessing ? 0.6 : 1,
                }}
              >
                {isProcessing ? (
                  <>
                    <ActivityIndicator color={theme.colors.white} size="small" />
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: '700',
                        color: theme.colors.white,
                      }}
                    >
                      {t('common.loading')}...
                    </Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="folder-outline" size={18} color={theme.colors.white} />
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: '700',
                        color: theme.colors.white,
                      }}
                    >
                      {t('flashcards.selectFile')}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Download Template Button */}
              <TouchableOpacity
                onPress={handleDownloadTemplate}
                disabled={isProcessing}
                style={{
                  marginTop: 12,
                  backgroundColor: '#E3F2FD',
                  borderRadius: 12,
                  paddingVertical: 12,
                  paddingHorizontal: 11,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  opacity: isProcessing ? 0.6 : 1,
                  alignSelf: 'center',
                }}
              >
                <Ionicons name="download-outline" size={18} color="#2196F3" />
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '700',
                    color: '#2196F3',
                  }}
                >
                  {t('flashcards.downloadTemplate')}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView 
              style={{ maxHeight: 400 }}
              scrollEnabled={true}
              showsVerticalScrollIndicator={false}
            >
              {/* Summary */}
              <View
                style={{
                  backgroundColor: `${theme.colors.primary}10`,
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 16,
                  borderWidth: 1,
                  borderColor: `${theme.colors.primary}30`,
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '700',
                    color: theme.colors.text.primary,
                    marginBottom: 4,
                  }}
                >
                  {importedDeck.title}
                </Text>
                {importedDeck.description && (
                  <Text
                    style={{
                      fontSize: 12,
                      color: theme.colors.text.secondary,
                      marginBottom: 8,
                      lineHeight: 16,
                    }}
                  >
                    {importedDeck.description}
                  </Text>
                )}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <MaterialCommunityIcons
                    name="cards-outline"
                    size={13}
                    color={theme.colors.primary}
                  />
                  <Text
                    style={{
                      fontSize: 12,
                      color: theme.colors.primary,
                      fontWeight: '600',
                    }}
                  >
                    {importedDeck.cardCount} {t('flashcards.cards')}
                  </Text>
                </View>
              </View>

              {/* Subject Selector */}
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: theme.colors.text.primary,
                  marginBottom: 8,
                }}
              >
                {t('flashcards.subject')}
              </Text>
              <View
                style={{
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  borderRadius: 10,
                  backgroundColor: theme.colors.inputBackground,
                  overflow: 'hidden',
                  marginBottom: 16,
                }}
              >
                {subjects.map((subject, index) => (
                  <TouchableOpacity
                    key={subject.id}
                    onPress={() => setSelectedSubjectId(subject.id)}
                    disabled={isProcessing}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: 11,
                      backgroundColor:
                        selectedSubjectId === subject.id
                          ? `${theme.colors.primary}15`
                          : 'transparent',
                      borderBottomWidth: index < subjects.length - 1 ? 1 : 0,
                      borderBottomColor: theme.colors.border,
                    }}
                  >
                    <View
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        backgroundColor: subject.color || theme.colors.primary,
                        marginRight: 10,
                      }}
                    />
                    <Text
                      style={{
                        flex: 1,
                        fontSize: 13,
                        fontWeight: selectedSubjectId === subject.id ? '600' : '500',
                        color:
                          selectedSubjectId === subject.id
                            ? theme.colors.primary
                            : theme.colors.text.primary,
                      }}
                    >
                      {subject.name}
                    </Text>
                    {selectedSubjectId === subject.id && (
                      <Ionicons name="checkmark" size={16} color={theme.colors.primary} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              {/* Confirm Button */}
              <TouchableOpacity
                onPress={handleConfirmSubject}
                disabled={isProcessing}
                style={{
                  backgroundColor: theme.colors.primary,
                  borderRadius: 12,
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  opacity: isProcessing ? 0.6 : 1,
                }}
              >
                {isProcessing ? (
                  <>
                    <ActivityIndicator color={theme.colors.white} size="small" />
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: '700',
                        color: theme.colors.white,
                      }}
                    >
                      {t('common.saving')}...
                    </Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="checkmark-done" size={18} color={theme.colors.white} />
                    <Text
                      style={{
                        fontSize: 14,
                        fontWeight: '700',
                        color: theme.colors.white,
                      }}
                    >
                      {t('common.save')}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
};
