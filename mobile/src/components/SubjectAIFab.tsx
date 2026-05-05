import React, { useState, useEffect, useRef } from 'react';
import { View, TouchableOpacity, Animated, Easing } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '../styles/theme';
import { subjectDetailStyles as styles } from '../styles/SubjectDetail.styles';
import { SubjectAIContextModal } from './SubjectAIContextModal';
import { RecordingItem } from '../hooks/useAudioRecorder';
import { YouTubeVideo } from '../services/api/types';
import { AIContextItemData } from './AIContextItem';

export interface SubjectAIFabProps {
  subjectName: string;
  recordings?: RecordingItem[];
  photos?: any[];
  documents?: any[];
  videos?: YouTubeVideo[];
  onGenerateFlashcards?: (selectedItems: AIContextItemData[]) => void;
  onAskQuestions?: (selectedItems: AIContextItemData[]) => void;
}

/**
 * SubjectAIFab.tsx
 *
 * Floating Action Button (FAB) animado que aparece en la pantalla de una materia.
 * Genera un efecto visual de "pulso" contínuo para llamar la atención del usuario.
 * Al presionarlo, despliega el modal `SubjectAIContextModal`, el cual recolecta todo 
 * el contexto disponible de la materia (fotos, audios, documentos) para interactuar con la IA.
 *
 * @param subjectName - Nombre de la materia (para el modal IA).
 * @param recordings - Grabaciones asociadas a la materia.
 * @param photos - Fotografías escaneadas.
 * @param documents - PDFs subidos.
 * @param videos - Videos de YouTube vinculados.
 * @param onGenerateFlashcards - Callback ejecutado si el usuario decide crear flashcards desde la IA.
 * @param onAskQuestions - Callback ejecutado si el usuario decide entrar al chat de dudas.
 */
export const SubjectAIFab: React.FC<SubjectAIFabProps> = ({
  subjectName,
  recordings,
  photos = [],
  documents = [],
  videos = [],
  onGenerateFlashcards,
  onAskQuestions,
}) => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  return (
    <>
      <View style={[styles.fabContainer, { bottom: Math.max(24, 24 + insets.bottom - 10) }]}>
        <TouchableOpacity activeOpacity={0.8} onPress={() => setIsModalVisible(true)}>
          <Animated.View style={[styles.fabButton, { transform: [{ scale: pulseAnim }] }]}>
            <MaterialCommunityIcons name="auto-fix" size={28} color={theme.colors.white} />
          </Animated.View>
        </TouchableOpacity>
      </View>

      <SubjectAIContextModal
        isVisible={isModalVisible}
        onClose={() => setIsModalVisible(false)}
        subjectName={subjectName}
        recordings={recordings}
        photos={photos}
        documents={documents}
        videos={videos}
        onGenerateFlashcards={(items) => {
          setIsModalVisible(false);
          onGenerateFlashcards?.(items);
        }}
        onAskQuestions={(items) => {
          setIsModalVisible(false);
          onAskQuestions?.(items);
        }}
      />
    </>
  );
};
