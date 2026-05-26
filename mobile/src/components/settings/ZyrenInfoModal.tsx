import React from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../styles/theme';
import { settingsStyles as styles } from '../../styles/Settings.styles';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const SPACING = { marginBottom: 24 };

const sectionTitle = {
  fontSize: 17,
  fontWeight: '800',
  color: theme.colors.text.primary,
  marginBottom: 8,
  marginTop: 4,
};

const bodyText = {
  fontSize: 13,
  color: theme.colors.text.secondary,
  lineHeight: 20,
};

const bulletPoint = {
  fontSize: 13,
  color: theme.colors.text.secondary,
  lineHeight: 22,
  paddingLeft: 8,
};

const iconRow = {
  flexDirection: 'row' as const,
  alignItems: 'flex-start' as const,
  gap: 8,
  marginBottom: 4,
};

const divider = {
  height: 1,
  backgroundColor: theme.colors.border + '60',
  marginVertical: 16,
};

const ZYREN_ES = {
  title: 'Zyren — El Núcleo Cognitivo de Threshold',
  intro: [
    'Zyren es la identidad cognitiva de la inteligencia artificial integrada en Threshold, una plataforma enfocada en el análisis, interpretación y transformación de material académico en conocimiento estructurado y utilizable.',
    'No es un chatbot genérico. Es un sistema de análisis, un motor de síntesis, una entidad diseñada para interpretar contenido académico de forma objetiva y estructurada.',
  ],
  sections: [
    {
      title: '🦎 El Origen del Nombre',
      content: [
        'Zyren nace como un neologismo técnico y conceptual, diseñado para transmitir precisión, inteligencia estructurada y transformación del conocimiento.',
        'El prefijo "Zy-" transmite modernidad, abstracción tecnológica e identidad artificial. La letra Z, poco común, genera alta memorabilidad y sensación futurista.',
        'El sufijo "-ren" aporta estabilidad fonética, sensación de entidad estructurada y carácter técnico.',
        'El nombre representa a la inteligencia que transforma información en comprensión.',
      ],
    },
    {
      title: '⚡ Capacidades',
      content: [],
      capabilities: [
        { icon: 'chatbubbles-outline', iconLib: 'Ionicons', text: 'Chat académico interactivo con contexto persistente y respuestas ultrarrápidas (Groq 300+ tokens/s).' },
        { icon: 'cards-outline', iconLib: 'Ionicons', text: 'Generación automática de flashcards desde texto, PDF, audio, video e imágenes.' },
        { icon: 'document-text-outline', iconLib: 'Ionicons', text: 'Procesamiento de documentos de hasta 100 MB (PDFs, libros, apuntes).' },
        { icon: 'microphone-outline', iconLib: 'Ionicons', text: 'Transcripción de audio con Groq Whisper v3 (multidioma, enfocado en español).' },
        { icon: 'logo-youtube', iconLib: 'Ionicons', text: 'Transcripción y análisis de videos de YouTube con generación automática de flashcards.' },
        { icon: 'image-outline', iconLib: 'Ionicons', text: 'Análisis de imágenes, gráficos, diagramas y ecuaciones con visión por computadora.' },
        { icon: 'document-text-outline', iconLib: 'Ionicons', text: 'Resúmenes inteligentes que reducen contenido extenso a puntos clave.' },
        { icon: 'flash-outline', iconLib: 'Ionicons', text: 'Detección inteligente de intención — entiende lo que quieres hacer sin instrucciones explícitas.' },
        { icon: 'hardware-chip-outline', iconLib: 'Ionicons', text: 'Soporte dual de modelos (Groq para respuestas rápidas, Gemini para documentos grandes).' },

      ],
    },
    {
      title: '🔗 Relación con Threshold',
      content: [
        'Threshold define el umbral, el punto de transición entre información y comprensión.',
        'Zyren es la inteligencia que atraviesa ese umbral y ejecuta la transformación.',
        'Juntos convierten documentos en conocimiento, organizan ideas y hacen que el aprendizaje sea navegable.',
      ],
    },
  ],
  final: 'Zyren no reemplaza al docente. Acelera el aprendizaje transformando contenido en herramientas de estudio estructuradas, accesibles y eficaces.',
};

const ZYREN_EN = {
  title: 'Zyren — The Cognitive Core of Threshold',
  intro: [
    'Zyren is the cognitive identity of the artificial intelligence integrated into Threshold, a platform focused on analyzing, interpreting, and transforming academic material into structured, usable knowledge.',
    'It is not a generic chatbot. It is an analysis system, a synthesis engine, an entity designed to interpret academic content objectively and in a structured way.',
  ],
  sections: [
    {
      title: '🦎 The Origin of the Name',
      content: [
        'Zyren was born as a technical and conceptual neologism, designed to convey precision, structured intelligence, and knowledge transformation.',
        'The prefix "Zy-" conveys modernity, technological abstraction, and artificial identity. The letter Z, uncommon in natural language, creates high memorability and a futuristic feel.',
        'The suffix "-ren" provides phonetic stability, a sense of structured entity, and technical character.',
        'The name represents the intelligence that transforms information into understanding.',
      ],
    },
    {
      title: '⚡ Capabilities',
      content: [],
      capabilities: [
        { icon: 'chatbubbles-outline', iconLib: 'Ionicons', text: 'Interactive academic chat with persistent context and ultra-fast responses (Groq 300+ tokens/s).' },
        { icon: 'cards-outline', iconLib: 'Ionicons', text: 'Automatic flashcard generation from text, PDF, audio, video, and images.' },
        { icon: 'document-text-outline', iconLib: 'Ionicons', text: 'Document processing up to 100 MB (PDFs, books, notes).' },
        { icon: 'microphone-outline', iconLib: 'Ionicons', text: 'Audio transcription with Groq Whisper v3 (multilingual, focused on Spanish).' },
        { icon: 'logo-youtube', iconLib: 'Ionicons', text: 'YouTube video transcription and analysis with automatic flashcard generation.' },
        { icon: 'image-outline', iconLib: 'Ionicons', text: 'Image, chart, diagram, and equation analysis with computer vision.' },
        { icon: 'document-text-outline', iconLib: 'Ionicons', text: 'Smart summaries that reduce extensive content to key points.' },
        { icon: 'flash-outline', iconLib: 'Ionicons', text: 'Intelligent intent detection — understands what you want without explicit instructions.' },
        { icon: 'hardware-chip-outline', iconLib: 'Ionicons', text: 'Dual model support (Groq for fast responses, Gemini for large documents).' },

      ],
    },
    {
      title: '🔗 Relationship with Threshold',
      content: [
        'Threshold defines the boundary, the transition point between information and understanding.',
        'Zyren is the intelligence that crosses that threshold and executes the transformation.',
        'Together they turn documents into knowledge, organize ideas, and make learning navigable.',
      ],
    },
  ],
  final: 'Zyren does not replace the teacher. It accelerates learning by transforming content into structured, accessible, and effective study tools.',
};

export const ZyrenInfoModal: React.FC<Props> = ({ visible, onClose }) => {
  const { i18n } = useTranslation();
  const data = i18n.language === 'es' ? ZYREN_ES : ZYREN_EN;

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { maxHeight: '85%' }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Zyren</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={theme.colors.text.primary} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: theme.colors.primary, marginBottom: 12, lineHeight: 22 }}>
              {data.title}
            </Text>

            {data.intro.map((p, i) => (
              <Text key={i} style={[bodyText, { marginBottom: 12 }]}>{p}</Text>
            ))}

            <View style={divider} />

            {data.sections.map((section, idx) => (
              <View key={idx} style={SPACING}>
                <Text style={sectionTitle}>{section.title}</Text>
                {section.content.map((p, j) => (
                  <Text key={j} style={[bodyText, { marginBottom: 8 }]}>{p}</Text>
                ))}
                {'capabilities' in section && section.capabilities && (
                  <View style={{ marginTop: 4 }}>
                    {section.capabilities.map((cap, k) => (
                      <View key={k} style={iconRow}>
                        <Ionicons name={cap.icon as any} size={16} color={theme.colors.primary} style={{ marginTop: 2, flexShrink: 0 }} />
                        <Text style={[bodyText, { flex: 1 }]}>{cap.text}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}

            <View style={divider} />

            <Text style={[bodyText, { fontStyle: 'italic', textAlign: 'center', paddingHorizontal: 8 }]}>
              {data.final}
            </Text>
          </ScrollView>
          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.modalBtnPrimary} onPress={onClose}>
              <Text style={styles.modalBtnPrimaryText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};
