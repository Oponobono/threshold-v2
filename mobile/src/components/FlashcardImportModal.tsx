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
    const templateDeck: any = {
      _INSTRUCCIONES_: "IMPORTANTE: Para 'multiple_choice', opciones desde 0 (ej: correctIndex: 0). Para 'boolean', usa true o false. CÓDIGO: Las preguntas que contengan código DEBEN usar markdown fences (```lenguaje código ```). Especifica el lenguaje después de los backticks: bash, javascript, python, sql, json, html, css, java, etc. Ejemplo: ```bash git push origin main ``` - SIN especificar lenguaje, puede no resaltar correctamente.",
      title: 'Mi Mazo Ejemplo',
      description: 'Descripción del mazo (opcional)',
      subject_id: 1, // ID de la materia (opcional)
      cards: [
        {
          type: 'flashcard',
          data: {
            front: 'Frente de la tarjeta',
            back: 'Reverso de la tarjeta',
          },
          hint: 'Pista (opcional)',
          explanation: 'Explicación (opcional)',
        },
        {
          type: 'multiple_choice',
          data: {
            question: '¿Cuál es la capital de Francia?',
            options: ['París (Índice 0)', 'Londres (Índice 1)', 'Berlín (Índice 2)', 'Madrid (Índice 3)'],
            correctIndex: 0,
          },
          hint: 'Tiene la Torre Eiffel',
          explanation: 'París es la capital de Francia',
        },
        {
          type: 'boolean',
          data: {
            question: '¿2 + 2 = 4?',
            correctAnswer: true,
          },
          hint: 'Es una suma aritmética simple',
          explanation: 'Matemáticas básicas',
        },
        {
          type: 'flashcard',
          data: {
            front: 'Completa el comando para subir los cambios al repositorio remoto en Git:\n\n```bash\ngit ___ origin main\n```',
            back: 'El comando correcto es `push`.\n\n```bash\ngit push origin main\n```',
          },
          hint: 'Empuja los cambios hacia arriba',
          explanation: '`git push` actualiza las referencias remotas usando las referencias locales, enviando los objetos necesarios.',
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
      const deckData: DeckJSON = JSON.parse(jsonContent);

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
