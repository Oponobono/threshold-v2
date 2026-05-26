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
import { theme } from '../styles/theme';
import { flashcardImportStyles as s } from '../styles/FlashcardImportModal.styles';
import { useCustomAlert } from './CustomAlert';
import { createFlashcardDeck, updateFlashcardDeck, createEvaluationItem, type Subject } from '../services/api';

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
        title: t('common.error') || 'Error',
        message: 'No se pudo abrir el selector de archivos',
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

    const templateDeck: any = {
      _info: `LENGUAJES SOPORTADOS (${languagesList.length} registrados): ${languagesList.join(', ')}. La aplicación tiene soporte para más de 190 lenguajes de programación. Si el lenguaje que necesitas no está en la lista, solicítalo en Configuración > Acerca de nosotros.`,
      title: 'Mi Mazo Ejemplo',
      description: 'Máximo 200 caracteres. Describe el contenido del mazo.',
      cards: [
        {
          type: 'flashcard',
          data: {
            front: 'Pregunta o concepto (texto o markdown)',
            back: 'Respuesta o definición (texto o markdown)',
          },
          hint: 'Pista opcional para ayudar al repaso',
          explanation: 'Explicación opcional sobre el tema',
        },
        {
          type: 'multiple_choice',
          data: {
            question: '¿Cuál es la capital de Francia?',
            options: [
              'París',
              'Londres',
              'Berlín',
              'Madrid',
            ],
            correctIndex: 0,
          },
          hint: 'Pista opcional',
          explanation: 'París es la capital y la ciudad más poblada de Francia.',
        },
        {
          type: 'boolean',
          data: {
            question: '¿La fotosíntesis produce oxígeno?',
            correctAnswer: true,
          },
          hint: 'Pista opcional',
          explanation: 'Durante la fotosíntesis, las plantas convierten CO₂ y agua en glucosa y oxígeno.',
        },
        {
          type: 'flashcard',
          data: {
            front: 'Completa el comando Git:\n\n```bash\ngit ___ origin main\n```',
            back: 'El comando es `push`:\n\n```bash\ngit push origin main\n```',
          },
          hint: 'Empuja los cambios al remoto',
          explanation: '`git push` envía los commits locales al repositorio remoto.',
        },
      ],
    };

    try {
      const jsonString = JSON.stringify(templateDeck, null, 2);
      const fileName = `plantilla_mazo_threshold.json`;
      const tempFilePath = `${FileSystem.cacheDirectory}${fileName}`;
      
      // Guardar el archivo temporalmente
      await FileSystem.writeAsStringAsync(tempFilePath, jsonString, {
        encoding: 'utf8',
      });

      // Compartir el archivo
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(tempFilePath, {
          mimeType: 'application/json',
          dialogTitle: 'Compartir plantilla de mazo',
        });
      } else {
        showAlert({
          title: t('common.error') || 'Error',
          message: 'Compartir no está disponible en tu dispositivo',
          type: 'error',
        });
      }
    } catch (error: any) {
      console.error('Error compartiendo plantilla:', error);
      showAlert({
        title: t('common.error') || 'Error',
        message: 'No se pudo compartir la plantilla',
        type: 'error',
      });
    }
  };

  /**
   * Sanitiza un objeto eliminando claves peligrosas (__proto__, constructor, prototype)
   */
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
    if (!data || typeof data !== 'object') return 'La tarjeta debe tener un campo "data" válido';

    switch (type) {
      case 'flashcard':
        if (!data.front || typeof data.front !== 'string') return 'Tarjeta flashcard requiere "data.front" (texto)';
        if (!data.back || typeof data.back !== 'string') return 'Tarjeta flashcard requiere "data.back" (texto)';
        break;
      case 'multiple_choice':
        if (!data.question || typeof data.question !== 'string') return 'Opción múltiple requiere "data.question" (texto)';
        if (!Array.isArray(data.options) || data.options.length < 2) return 'Opción múltiple requiere "data.options" (array con al menos 2 opciones)';
        if (typeof data.correctIndex !== 'number') return 'Opción múltiple requiere "data.correctIndex" (número)';
        if (data.correctIndex < 0 || data.correctIndex >= data.options.length) return 'data.correctIndex está fuera del rango de opciones';
        break;
      case 'boolean':
        if (!data.question || typeof data.question !== 'string') return 'Verdadero/Falso requiere "data.question" (texto)';
        if (typeof data.correctAnswer !== 'boolean') return 'Verdadero/Falso requiere "data.correctAnswer" (true/false)';
        break;
      default:
        return `Tipo de tarjeta no soportado: "${type}"`;
    }
    return null;
  };

  const handleImportJSON = async (file: DocumentPicker.DocumentPickerAsset) => {
    try {
      setIsProcessing(true);

      const maxSize = 10 * 1024 * 1024; // 10MB
      if (file.size && file.size > maxSize) {
        showAlert({
          title: t('common.error') || 'Error',
          message: 'El archivo es demasiado grande (máx. 10MB)',
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
          title: t('common.error') || 'Error',
          message: 'El archivo JSON debe contener un campo "title"',
          type: 'error',
        });
        setIsProcessing(false);
        return;
      }

      // Validar límite de tarjetas
      if (deckData.cards && deckData.cards.length > 20) {
        showAlert({
          title: t('common.error') || 'Error',
          message: 'El mazo excede el límite de 20 tarjetas. Reduce la cantidad e intenta de nuevo.',
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
              title: t('common.error') || 'Error',
              message: `La tarjeta #${i + 1} excede el límite de 50KB. Reduce su contenido.`,
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
              title: t('common.error') || 'Error',
              message: `Tarjeta #${i + 1}: ${schemaError}`,
              type: 'error',
            });
            setIsProcessing(false);
            return;
          }
        }
      }

      // Crear el mazo SIN subject_id (se asignará después)
      const newDeck = await createFlashcardDeck({
        title: deckData.title.trim(),
        description: deckData.description?.trim() || undefined,
        // subject_id es opcional
      });

      // Procesar las tarjetas si existen
      let successCount = 0;
      let errorCount = 0;

      if (deckData.cards && Array.isArray(deckData.cards) && deckData.cards.length > 0) {
        for (const card of deckData.cards) {
          try {
            const itemType = card.type || 'flashcard';
            const validTypes = ['flashcard', 'multiple_choice', 'boolean'];
            
            if (!validTypes.includes(itemType)) {
              console.warn(`[FlashcardImportModal] Tipo de ítem inválido: ${itemType}`);
              errorCount++;
              continue;
            }

            if (!card.data) {
              console.warn('[FlashcardImportModal] Ítem sin campo "data"');
              errorCount++;
              continue;
            }

            // Normalizar las llaves del JSON si vienen en snake_case
            const normalizedData = { ...card.data };
            if (normalizedData.correct_index !== undefined) {
              normalizedData.correctIndex = normalizedData.correct_index;
              delete normalizedData.correct_index;
            }
            if (normalizedData.correct_answer !== undefined) {
              normalizedData.correctAnswer = normalizedData.correct_answer;
              delete normalizedData.correct_answer;
            }

            await createEvaluationItem({
              deck_id: newDeck.id,
              item_type: itemType as 'flashcard' | 'multiple_choice' | 'boolean',
              content_json: normalizedData,
              hint: card.hint,
              explanation: card.explanation,
            });

            successCount++;
          } catch (itemError: any) {
            console.error('[FlashcardImportModal] Error creando ítem:', itemError);
            errorCount++;
          }
        }
      }

      // Importación exitosa - cerrar modal
      setIsProcessing(false);
      
      // Recarga la lista de mazos ANTES de cerrar
      await onImportSuccess?.();
      
      showAlert({
        title: t('common.success') || 'Éxito',
        message: errorCount > 0
          ? `Mazo "${deckData.title}" importado con ${successCount} tarjeta(s) exitosas y ${errorCount} error(es)`
          : `Mazo "${deckData.title}" importado exitosamente con ${successCount} tarjeta(s)`,
        type: 'success',
      });
      
      // Reset state y cerrar
      setImportedDeck(null);
      setSelectedSubjectId(null);
      onClose();
    } catch (error: any) {
      console.error('[FlashcardImportModal] Error importando:', error);

      let errorMessage = 'Error al importar el mazo';
      if (error.message.includes('JSON')) {
        errorMessage = 'El archivo no es un JSON válido';
      } else if (error.message) {
        errorMessage = error.message;
      }

      showAlert({
        title: t('common.error') || 'Error',
        message: errorMessage,
        type: 'error',
      });
      setIsProcessing(false);
    }
  };

  const handleConfirmSubject = async () => {
    if (!importedDeck || !selectedSubjectId) {
      showAlert({
        title: t('common.error') || 'Error',
        message: 'Por favor selecciona una materia',
        type: 'error',
      });
      return;
    }

    try {
      setIsProcessing(true);
      await updateFlashcardDeck(importedDeck.id, { subject_id: selectedSubjectId });
      
      showAlert({
        title: t('common.success') || 'Éxito',
        message: `Mazo "${importedDeck.title}" importado exitosamente con ${importedDeck.cardCount} tarjeta(s)`,
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
        title: t('common.error') || 'Error',
        message: 'Error al asignar la materia',
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
                {importedDeck ? t('flashcards.subject') : t('flashcards.importDeck') || 'Importar Mazo'}
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
                {t('flashcards.importDeckDescription') ||
                  '¡Sube tu mazo en JSON y comienza a estudiar! 🚀'}
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
                      {t('flashcards.selectFile') || 'Seleccionar Archivo'}
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
