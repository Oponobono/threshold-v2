/**
 * SubjectAIFab.tsx
 *
 * Floating Action Button (FAB) animado que aparece en la pantalla de una materia.
 * Genera un efecto visual de "pulso" continuo para llamar la atención del usuario.
 *
 * Al presionarlo, abre el `SubjectAIContextModal` donde el usuario selecciona qué
 * archivos quiere que la IA analice. Una vez confirmada la selección:
 *   - Si elige "Preguntar a IA": construye el contexto en el backend y abre el chat.
 *   - Si elige "Crear Flashcards": construye el contexto y delega al callback externo.
 *
 * Internamente gestiona el estado de carga mientras el backend procesa los archivos.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, TouchableOpacity, Animated, Easing, ActivityIndicator,
  Text, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../styles/theme';
import { subjectDetailStyles as styles } from '../styles/SubjectDetail.styles';
import { SubjectAIContextModal } from './SubjectAIContextModal';
import { SubjectAIChatModal } from './SubjectAIChatModal';
import { RecordingItem } from '../hooks/useAudioRecorder';
import { YouTubeVideo } from '../services/api/types';
import { AIContextItemData } from './AIContextItem';
import { buildAIContext } from '../services/api/ai';

// ─── Tipos ────────────────────────────────────────────────────────────────────
export interface SubjectAIFabProps {
  subjectName: string;
  recordings?: RecordingItem[];
  photos?: any[];
  documents?: any[];
  videos?: YouTubeVideo[];
  /** Callback opcional para generar flashcards — recibe el texto de contexto listo */
  onGenerateFlashcards?: (contextText: string, selectedItems: AIContextItemData[]) => void;
}

// ─── Overlay de carga ─────────────────────────────────────────────────────────
/**
 * Pantalla modal semitransparente que bloquea la UI mientras el backend
 * construye el contexto de todos los archivos seleccionados.
 */
const BuildingContextOverlay: React.FC = () => (
  <View style={o.overlay}>
    <View style={o.card}>
      <ActivityIndicator size="large" color="#7B72FF" />
      <Text style={o.title}>Analizando archivos...</Text>
      <Text style={o.subtitle}>
        Extrayendo texto y transcripciones para Zyren.
      </Text>
    </View>
  </View>
);

const o = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center', justifyContent: 'center',
    zIndex: 9999,
  },
  card: {
    backgroundColor: '#0E0E18',
    borderRadius: 22, padding: 32,
    alignItems: 'center', gap: 14,
    borderWidth: 1, borderColor: 'rgba(123,114,255,0.25)',
    width: 260,
  },
  title: {
    fontSize: 16, fontWeight: '800', color: '#F0F0F8', letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13, color: 'rgba(240,240,248,0.5)',
    textAlign: 'center', lineHeight: 19,
  },
});

// ─── Componente principal ─────────────────────────────────────────────────────
export const SubjectAIFab: React.FC<SubjectAIFabProps> = ({
  subjectName,
  recordings,
  photos = [],
  documents = [],
  videos = [],
  onGenerateFlashcards,
}) => {
  const insets = useSafeAreaInsets();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // ── Estado de los modales ──────────────────────────────────────────────────
  const [isContextModalVisible, setIsContextModalVisible] = useState(false);
  const [isChatVisible, setIsChatVisible]   = useState(false);
  const [isBuildingCtx, setIsBuildingCtx]   = useState(false);

  // ── Estado del contexto ensamblado ────────────────────────────────────────
  const [builtContext, setBuiltContext]         = useState('');
  const [builtContextCount, setBuiltContextCount] = useState(0);

  // ── Pulso del FAB ──────────────────────────────────────────────────────────
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15, duration: 1500,
          easing: Easing.inOut(Easing.ease), useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1, duration: 1500,
          easing: Easing.inOut(Easing.ease), useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  /**
   * Construye el contexto desde el backend y ejecuta la acción correspondiente.
   * @param selectedItems - Items seleccionados por el usuario en el Bento Grid.
   * @param action - 'ask' para abrir el chat, 'flashcards' para delegar al padre.
   */
  const buildAndProceed = useCallback(async (
    selectedItems: AIContextItemData[],
    action: 'ask' | 'flashcards',
  ) => {
    setIsContextModalVisible(false);

    if (selectedItems.length === 0) return;

    setIsBuildingCtx(true);
    try {
      // Construir payload con IDs correctos para cada tipo de recurso
      const payload = selectedItems.map(item => {
        // El rawItem es el objeto original (Recording, Photo, Document, Video)
        // que tiene el campo 'id' que es el que el backend espera
        const id = item.rawItem?.id;
        
        if (!id) {
          console.warn(`[buildAIContext] Item ${item.type} "${item.label}" no tiene ID. rawItem:`, item.rawItem);
        }

        return {
          id: id,
          type: item.type,
          label: item.label,
        };
      });

      console.log('[buildAIContext] Payload:', payload);

      const result = await buildAIContext(payload);

      setBuiltContext(result.context);
      setBuiltContextCount(result.itemsCount);

      if (action === 'ask') {
        // Abrir el chat con el contexto listo
        setIsChatVisible(true);
      } else if (action === 'flashcards') {
        // Delegar al padre con el contexto ya construido
        onGenerateFlashcards?.(result.context, selectedItems);
      }
    } catch (err: any) {
      console.error('[SubjectAIFab] Error construyendo contexto:', err.message);
      // Aún abrir el chat pero con contexto vacío (el asistente puede responder con conocimiento general)
      if (action === 'ask') {
        setBuiltContext('');
        setBuiltContextCount(0);
        setIsChatVisible(true);
      }
    } finally {
      setIsBuildingCtx(false);
    }
  }, [onGenerateFlashcards]);

  return (
    <>
      {/* Overlay de carga mientras se construye el contexto */}
      {isBuildingCtx && <BuildingContextOverlay />}

      {/* FAB */}
      <View style={[styles.fabContainer, { bottom: Math.max(24, 24 + insets.bottom - 10) }]}>
        <TouchableOpacity activeOpacity={0.8} onPress={() => setIsContextModalVisible(true)}>
          <Animated.View style={[styles.fabButton, { transform: [{ scale: pulseAnim }] }]}>
            <MaterialCommunityIcons name="auto-fix" size={28} color={theme.colors.white} />
          </Animated.View>
        </TouchableOpacity>
      </View>

      {/* Modal selector de contexto (Bento Grid) */}
      <SubjectAIContextModal
        isVisible={isContextModalVisible}
        onClose={() => setIsContextModalVisible(false)}
        subjectName={subjectName}
        recordings={recordings}
        photos={photos}
        documents={documents}
        videos={videos}
        onAskQuestions={(items) => buildAndProceed(items, 'ask')}
        onGenerateFlashcards={(items) => buildAndProceed(items, 'flashcards')}
      />

      {/* Modal de chat con el asistente */}
      <SubjectAIChatModal
        isVisible={isChatVisible}
        onClose={() => setIsChatVisible(false)}
        subjectName={subjectName}
        contextText={builtContext}
        contextItemCount={builtContextCount}
      />
    </>
  );
};
