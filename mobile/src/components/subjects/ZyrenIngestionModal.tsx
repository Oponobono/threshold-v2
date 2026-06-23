import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Modal,
  ActivityIndicator, ScrollView, StyleSheet, Alert, Image, ActionSheetIOS, Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { fetchWithFallback } from '../../services/api/client';
import { saveImportedDeck, addLocalCard, recalculateLocalDeckCounters } from '../../services/localFlashcardService';
import { extractTextFromImageHybrid, generateClassFlashcardsHybrid } from '../../services/hybridAIService';

interface GeneratedCard { front: string; back: string; }

interface AttachedImage {
  uri: string;       // URI local de la imagen
  base64?: string;   // base64 cargado en el momento de generar
}

interface ZyrenIngestionModalProps {
  visible: boolean;
  onClose: () => void;
  courseName: string;
  subjectName: string;
  subjectId: string;
  currentMilestone?: string;
}

type Step = 'input' | 'extracting' | 'preview' | 'saving';

export function ZyrenIngestionModal({
  visible, onClose, courseName, subjectName, subjectId, currentMilestone,
}: ZyrenIngestionModalProps) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('input');
  const [notes, setNotes] = useState('');
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [extractingIndex, setExtractingIndex] = useState<number | null>(null); // qué imagen se está procesando
  const [generatedCards, setGeneratedCards] = useState<GeneratedCard[]>([]);
  const [generatedTopic, setGeneratedTopic] = useState<string>('Zyren');
  const [removedIndexes, setRemovedIndexes] = useState<Set<number>>(new Set());
  const [showPicker, setShowPicker] = useState(false);

  const resetModal = () => {
    setStep('input');
    setNotes('');
    setAttachedImages([]);
    setLoading(false);
    setExtractingIndex(null);
    setGeneratedCards([]);
    setGeneratedTopic('Zyren');
    setRemovedIndexes(new Set());
    setShowPicker(false);
  };

  const handleClose = () => { resetModal(); onClose(); };

  // ── Selección de imágenes ──────────────────────────────────────────────────

  const pickFromGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería para adjuntar fotos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled) {
      setAttachedImages(prev => [
        ...prev,
        ...result.assets.map(a => ({ uri: a.uri, base64: a.base64 || undefined })),
      ]);
    }
  };

  const pickFromCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tu cámara para tomar fotos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.85,
      base64: true,
    });
    if (!result.canceled) {
      setAttachedImages(prev => [...prev, { uri: result.assets[0].uri, base64: result.assets[0].base64 || undefined }]);
    }
  };

  const showImageSourcePicker = () => {
    setShowPicker(true);
  };

  const removeImage = (index: number) => {
    setAttachedImages(prev => prev.filter((_, i) => i !== index));
  };

  // ── Generación ─────────────────────────────────────────────────────────────

  const generateCards = async () => {
    const hasNotes = notes.trim().length >= 20;
    const hasImages = attachedImages.length > 0;

    if (!hasNotes && !hasImages) {
      Alert.alert(
        'Sin contenido',
        'Escribe al menos 20 caracteres de apuntes o adjunta al menos una foto de tus notas.',
      );
      return;
    }

    setLoading(true);
    let combinedText = notes.trim();

    // ── 1. Extraer texto de cada imagen en orden ──
    if (hasImages) {
      setStep('extracting');
      const extractedParts: string[] = [];

      for (let i = 0; i < attachedImages.length; i++) {
        setExtractingIndex(i);
        try {
          const base64Str = attachedImages[i].base64;
          if (!base64Str) continue;
          const text = await extractTextFromImageHybrid(base64Str);
          if (text?.trim()) {
            extractedParts.push(`[Imagen ${i + 1}]\n${text.trim()}`);
          }
        } catch (err) {
          console.warn(`[ZyrenIngestion] Error OCR imagen ${i + 1}:`, err);
          // Continúa con las demás imágenes
        }
      }

      setExtractingIndex(null);

      if (extractedParts.length > 0) {
        combinedText = [
          combinedText,
          ...extractedParts,
        ].filter(Boolean).join('\n\n---\n\n');
      }
    }

    if (!combinedText.trim()) {
      Alert.alert(
        'Sin texto extraíble',
        'No se pudo extraer texto de las imágenes y no hay apuntes escritos. Intenta con imágenes más nítidas.',
      );
      setLoading(false);
      setStep('input');
      return;
    }

    // ── 2. Enviar a Zyren para generar flashcards ──
    try {
      const data = await generateClassFlashcardsHybrid({
        courseName,
        subjectName,
        currentMilestone,
        rawTextFromOCROrNotes: combinedText,
      });
      
      if (!data.cards || data.cards.length === 0) {
        Alert.alert(
          'Sin tarjetas',
          'Zyren no encontró suficiente contenido para generar tarjetas. Intenta con apuntes más detallados o imágenes más legibles.',
        );
        setStep('input');
        return;
      }
      setGeneratedCards(data.cards);
      setGeneratedTopic(data.topic || 'Zyren');
      setStep('preview');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudieron generar las tarjetas. Intenta de nuevo.');
      setStep('input');
    } finally {
      setLoading(false);
    }
  };

  const toggleRemove = (index: number) => {
    setRemovedIndexes(prev => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  };

  const saveCards = async () => {
    const toSave = generatedCards.filter((_, i) => !removedIndexes.has(i));
    if (toSave.length === 0) {
      Alert.alert('Sin tarjetas', 'Debes conservar al menos una tarjeta para guardar.');
      return;
    }
    setStep('saving');
    try {
      const numericSubjectId = subjectId ? (parseInt(subjectId, 10) || null) : null;

      const deck = await saveImportedDeck(
        `${generatedTopic} — ${subjectName} (${new Date().toLocaleDateString('es')})`,
        `Mazo generado por Zyren desde apuntes de clase`,
        toSave.map(card => ({
          type: 'flashcard' as const,
          data: { front: card.front, back: card.back },
        })),
        numericSubjectId,
      );

      for (const card of toSave) {
        addLocalCard(deck.id, {
          type: 'flashcard',
          data: { front: card.front, back: card.back },
        });
      }

      recalculateLocalDeckCounters(deck.id);

      Alert.alert(
        '¡Mazo creado! 🎉',
        `${toSave.length} tarjetas guardadas en tu motor FSRS. ¡Revísalas en la sección de Flashcards!`,
        [{ text: 'Perfecto', onPress: handleClose }],
      );
    } catch (err: any) {
      Alert.alert('Error al guardar', err.message);
      setStep('preview');
    }
  };

  const approvedCount = generatedCards.length - removedIndexes.size;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={styles.container}>

        {/* ── Header ── */}
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <View>
            <Text style={styles.title}>⚡ Clase ➔ Mazo</Text>
            <Text style={styles.subtitle} numberOfLines={1}>{subjectName}</Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
            <Ionicons name="close" size={22} color={theme.colors.text.secondary} />
          </TouchableOpacity>
        </View>

        {/* ── STEP: Input ── */}
        {(step === 'input') && (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.stepContainer, { paddingBottom: Math.max(insets.bottom, 24) }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {currentMilestone ? (
              <View style={styles.milestonePill}>
                <Text style={styles.milestoneEmoji}>🎯</Text>
                <Text style={styles.milestoneText} numberOfLines={1}>{currentMilestone}</Text>
              </View>
            ) : null}

            {/* Apuntes de texto */}
            <Text style={styles.label}>Apuntes de la clase (opcional si adjuntas fotos):</Text>
            <TextInput
              style={styles.notesInput}
              multiline
              placeholder="Ej: Los punteros en C son variables que almacenan la dirección de memoria..."
              placeholderTextColor={theme.colors.text.placeholder}
              value={notes}
              onChangeText={setNotes}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{notes.length} caracteres</Text>

            {/* Fotos adjuntas */}
            <View style={styles.imagesSection}>
              <View style={styles.imagesSectionHeader}>
                <Text style={styles.label}>Fotos de apuntes ({attachedImages.length})</Text>
                <TouchableOpacity style={styles.addImageBtn} onPress={showImageSourcePicker}>
                  <Ionicons name="camera-outline" size={16} color={theme.colors.primary} />
                  <Text style={styles.addImageBtnText}>Agregar foto</Text>
                </TouchableOpacity>
              </View>

              {attachedImages.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.imagesScroll}
                  contentContainerStyle={{ gap: 10 }}
                >
                  {attachedImages.map((img, idx) => (
                    <View key={idx} style={styles.imageThumb}>
                      <Image source={{ uri: img.uri }} style={styles.thumbImage} />
                      {/* Número de orden */}
                      <View style={styles.thumbOrder}>
                        <Text style={styles.thumbOrderText}>{idx + 1}</Text>
                      </View>
                      {/* Botón eliminar */}
                      <TouchableOpacity
                        style={styles.thumbRemove}
                        onPress={() => removeImage(idx)}
                      >
                        <Ionicons name="close-circle" size={20} color="#FF3B30" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              ) : (
                <TouchableOpacity style={styles.emptyImagesHint} onPress={showImageSourcePicker}>
                  <Ionicons name="images-outline" size={28} color={theme.colors.text.placeholder} />
                  <Text style={styles.emptyImagesText}>
                    Toca para agregar fotos de tus apuntes o pizarrón
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, loading && { opacity: 0.6 }]}
              onPress={generateCards}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : <><Text style={styles.primaryBtnText}>Generar con Zyren</Text><Text style={styles.primaryBtnEmoji}>✨</Text></>}
            </TouchableOpacity>
          </ScrollView>
        )}

        {/* ── STEP: Extracting OCR ── */}
        {step === 'extracting' && (
          <View style={[styles.stepContainer, styles.centerStep, { paddingBottom: Math.max(insets.bottom, 24) }]}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.extractingTitle}>Leyendo imágenes...</Text>
            {extractingIndex !== null && (
              <Text style={styles.extractingSubtitle}>
                Procesando foto {extractingIndex + 1} de {attachedImages.length}
              </Text>
            )}
            <View style={styles.extractingDots}>
              {attachedImages.map((img, i) => (
                <View
                  key={i}
                  style={[
                    styles.extractingDot,
                    extractingIndex !== null && i < extractingIndex && styles.extractingDotDone,
                    extractingIndex === i && styles.extractingDotActive,
                  ]}
                />
              ))}
            </View>
          </View>
        )}

        {/* ── STEP: Preview ── */}
        {step === 'preview' && (
          <View style={[styles.stepContainer, { paddingBottom: Math.max(insets.bottom, 24), flex: 1 }]}>
            <View style={styles.previewHeader}>
              <Text style={styles.previewCount}>
                {approvedCount} de {generatedCards.length} tarjetas
              </Text>
              <TouchableOpacity onPress={() => setStep('input')}>
                <Text style={styles.backLink}>← Editar apuntes</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.cardsList}>
              {generatedCards.map((card, i) => {
                const removed = removedIndexes.has(i);
                return (
                  <View key={i} style={[styles.cardPreview, removed && styles.cardRemoved]}>
                    <View style={styles.cardContent}>
                      <Text style={[styles.cardFront, removed && { opacity: 0.4 }]} numberOfLines={2}>
                        ❓ {card.front}
                      </Text>
                      <Text style={[styles.cardBack, removed && { opacity: 0.4 }]} numberOfLines={2}>
                        💡 {card.back}
                      </Text>
                    </View>
                    <TouchableOpacity style={styles.removeBtn} onPress={() => toggleRemove(i)}>
                      <Ionicons
                        name={removed ? 'add-circle-outline' : 'close-circle-outline'}
                        size={22}
                        color={removed ? theme.colors.success : theme.colors.danger}
                      />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={[styles.primaryBtn, approvedCount === 0 && { opacity: 0.4 }]}
              onPress={saveCards}
              disabled={approvedCount === 0}
            >
              <Text style={styles.primaryBtnText}>Guardar {approvedCount} tarjeta{approvedCount !== 1 ? 's' : ''} en FSRS</Text>
              <Text style={styles.primaryBtnEmoji}>💾</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── STEP: Saving ── */}
        {step === 'saving' && (
          <View style={[styles.stepContainer, styles.centerStep, { paddingBottom: Math.max(insets.bottom, 24) }]}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.extractingTitle}>Sembrando tarjetas en FSRS...</Text>
          </View>
        )}

        {/* ── Modal Picker de Origen de Foto ── */}
        <Modal visible={showPicker} transparent={true} animationType="fade" onRequestClose={() => setShowPicker(false)}>
          <View style={styles.pickerOverlay}>
            <View style={[styles.pickerContent, { paddingBottom: Math.max(insets.bottom, 24) }]}>
              <View style={styles.pickerHeader}>
                <Text style={styles.pickerTitle}>Agregar fotos</Text>
                <TouchableOpacity style={styles.pickerClose} onPress={() => setShowPicker(false)}>
                  <Ionicons name="close" size={20} color={theme.colors.text.secondary} />
                </TouchableOpacity>
              </View>
              
              <TouchableOpacity style={styles.pickerOption} onPress={() => { setShowPicker(false); pickFromCamera(); }}>
                <View style={[styles.pickerIconBg, { backgroundColor: theme.colors.info + '15' }]}>
                  <Ionicons name="camera" size={22} color={theme.colors.info} />
                </View>
                <View style={styles.pickerOptionText}>
                  <Text style={styles.pickerOptionTitle}>Tomar foto</Text>
                  <Text style={styles.pickerOptionSub}>Usa la cámara para capturar apuntes o pizarrón</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.colors.border} />
              </TouchableOpacity>

              <TouchableOpacity style={[styles.pickerOption, { borderBottomWidth: 0 }]} onPress={() => { setShowPicker(false); pickFromGallery(); }}>
                <View style={[styles.pickerIconBg, { backgroundColor: theme.colors.success + '15' }]}>
                  <Ionicons name="images" size={22} color={theme.colors.success} />
                </View>
                <View style={styles.pickerOptionText}>
                  <Text style={styles.pickerOptionTitle}>Elegir de galería</Text>
                  <Text style={styles.pickerOptionSub}>Sube imágenes existentes</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.colors.border} />
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    color: theme.colors.text.primary,
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    color: theme.colors.text.secondary,
    fontSize: 13,
    marginTop: 2,
  },
  closeBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: theme.colors.card,
  },
  scroll: {
    flex: 1,
  },
  stepContainer: {
    padding: 20,
    flexGrow: 1,
  },
  centerStep: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  milestonePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primaryTransparent.light,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  milestoneEmoji: { fontSize: 14, marginRight: 6 },
  milestoneText: { color: theme.colors.primary, fontSize: 12, fontWeight: '600' },
  label: {
    color: theme.colors.text.secondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  notesInput: {
    backgroundColor: theme.colors.inputBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 16,
    padding: 16,
    color: theme.colors.text.primary,
    fontSize: 14,
    lineHeight: 22,
    flex: 1,
    minHeight: 120,
  },
  charCount: {
    color: theme.colors.text.placeholder,
    fontSize: 11,
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 20,
  },
  // ── Imágenes adjuntas ──
  imagesSection: {
    marginBottom: 20,
  },
  imagesSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  addImageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: theme.colors.primaryTransparent.light,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addImageBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  imagesScroll: {
    flexGrow: 0,
  },
  imageThumb: {
    width: 90,
    height: 90,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  thumbOrder: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbOrderText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  thumbRemove: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#fff',
    borderRadius: 10,
  },
  emptyImagesHint: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
    borderRadius: 16,
    paddingVertical: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyImagesText: {
    fontSize: 12,
    color: theme.colors.text.placeholder,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  // ── Extracting ──
  extractingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.colors.text.primary,
    marginTop: 8,
  },
  extractingSubtitle: {
    fontSize: 13,
    color: theme.colors.text.secondary,
  },
  extractingDots: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  extractingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.border,
  },
  extractingDotActive: {
    backgroundColor: theme.colors.primary,
    transform: [{ scale: 1.3 }],
  },
  extractingDotDone: {
    backgroundColor: theme.colors.success,
  },
  // ── Primary button ──
  primaryBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
    borderRadius: 14,
    padding: 16,
    gap: 8,
    marginTop: 4,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  primaryBtnEmoji: { fontSize: 16 },
  // ── Preview ──
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  previewCount: {
    color: theme.colors.text.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  backLink: {
    color: theme.colors.primary,
    fontSize: 13,
  },
  cardsList: {
    flex: 1,
    marginBottom: 16,
  },
  cardPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  cardRemoved: {
    borderColor: theme.colors.danger + '40',
    backgroundColor: theme.colors.dangerTransparent,
  },
  cardContent: { flex: 1, paddingRight: 10 },
  cardFront: {
    color: theme.colors.text.primary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  cardBack: {
    color: theme.colors.text.secondary,
    fontSize: 12,
  },
  removeBtn: { padding: 4 },
  // ── Picker Modal ──
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  pickerContent: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  pickerClose: {
    padding: 6,
    backgroundColor: theme.colors.card,
    borderRadius: 16,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  pickerIconBg: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  pickerOptionText: {
    flex: 1,
  },
  pickerOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginBottom: 2,
  },
  pickerOptionSub: {
    fontSize: 13,
    color: theme.colors.text.secondary,
  },
});
