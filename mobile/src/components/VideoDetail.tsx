import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Dimensions,
  StatusBar,
} from 'react-native';
import { alertRef } from './CustomAlert';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import YoutubePlayer from 'react-native-youtube-iframe';

import { theme } from '../styles/theme';
import { detailStyles as styles } from '../styles/RecordingDetailScreen.styles';
import { AITabType } from './RecordingAITabs';
import { RecordingAIContent } from './RecordingAIContent';
import { PremiumLoading } from './PremiumLoading';
import { FlashcardCreatorModal } from './FlashcardCreatorModal';
import { SubjectPickerModal } from './SubjectPickerModal';
import { AnimatedSubjectSelector } from './AnimatedSubjectSelector';
import {
  getSubjects,
  Subject,
  getYouTubeVideos,
  YouTubeVideo,
  upsertYouTubeTranscript,
  updateYouTubeVideo,
  getYouTubeSubtitles,
} from '../services/api';

// ---------------------------------------------------------------------------
// Constants & Directories
// ---------------------------------------------------------------------------
const GROQ_API_KEY: string = process.env.EXPO_PUBLIC_GROK_API_KEY ?? process.env.EXPO_PUBLIC_GROQ_API_KEY ?? '';
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const YOUTUBE_API_KEY: string = process.env.EXPO_PUBLIC_YOUTUBE_API_KEY ?? '';
const TRANSCRIPTS_DIR = () => `${FileSystem.documentDirectory}Threshold/transcripts/`;

// Groq helpers
// ---------------------------------------------------------------------------
async function transcribeYouTubeWithWhisper(videoId: string, apiKey: string): Promise<string> {
  // Obtener subtítulos del backend mediante api.ts (usa fetchWithFallback)
  // Esto devuelve TEXT de subtítulos, no audio
  try {
    const result = await getYouTubeSubtitles(videoId, 'es');
    console.log('✓ YouTube captions fetched in', result.language);
    return result.captions || '';
  } catch (error) {
    console.error('✗ Error fetching YouTube captions:', error);
    throw new Error(`Error obteniendo subtítulos: ${error instanceof Error ? error.message : error}`);
  }
}

async function summarizeWithGroq(transcription: string, apiKey: string): Promise<string> {
  const body = {
    model: 'llama-3.3-70b-versatile',
    messages: [
      {
        role: 'system',
        content: 'Eres un asistente educativo experto especializado en crear material de estudio universitario altamente efectivo. A partir de la transcripción de este video de YouTube, genera un resumen estructurado siguiendo estas reglas:\n1. Extrae los conceptos fundamentales y ordénalos por temas usando títulos claros (###).\n2. Usa viñetas breves para desglosar los detalles importantes de cada tema.\n3. Identifica términos clave, definiciones o fechas y resáltalos en **negrita**.\n4. Elimina toda la "paja" (titubeos, saludos, anuncios de patrocinadores, repeticiones) y ve directo al grano.\n5. Finaliza con una sección de "Idea Central" de máximo 2 oraciones.\nTu tono debe ser académico, estructurado y directo. No agregues introducciones conversacionales (como "Aquí tienes el resumen").',
      },
      {
        role: 'user',
        content: `Resume el siguiente texto:\n\n${transcription}`,
      },
    ],
    temperature: 0.3,
  };

  const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Error de Groq ${response.status}: ${errBody}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content ?? 'No se pudo generar el resumen.';
}

// ---------------------------------------------------------------------------
// VideoDetail Component
// ---------------------------------------------------------------------------
interface VideoDetailProps {
  videoId: string;
  onBack: () => void;
}

/**
 * VideoDetail.tsx
 *
 * Pantalla completa de detalle para un Video de YouTube enlazado a la plataforma.
 * Instancia un iframe nativo optimizado con `react-native-youtube-iframe` y extrae sus subtítulos
 * originales desde la API conectada al backend de Python, en lugar de transcribir audio (por velocidad).
 * Permite mandar ese texto directamente al LLM (Groq) para extraer un resumen en viñetas o generar flashcards.
 *
 * @param videoId - Identificador interno o hash local del registro del video.
 * @param onBack - Callback para regresar y desmontar el reproductor Iframe.
 */
export const VideoDetail: React.FC<VideoDetailProps> = ({ videoId, onBack }) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  // AI state
  const [transcription, setTranscription] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [activeTab, setActiveTab] = useState<AITabType>('transcription');
  const [showTutorial, setShowTutorial] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // Video metadata
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [videoData, setVideoData] = useState<YouTubeVideo | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [showSubjectPicker, setShowSubjectPicker] = useState(false);

  // Flashcard generation
  const [showFlashcardModal, setShowFlashcardModal] = useState(false);

  // Derived values
  const videoTitle = videoData?.title || 'Video de YouTube';
  const date = videoData?.created_at
    ? new Date(videoData.created_at).toLocaleString()
    : '';

  const screenWidth = Dimensions.get('window').width - 48;
  const subjectForId = subjects.find(s => s.id === selectedSubjectId);

  // ---------------------------------------------------------------------------
  // Load data
  // ---------------------------------------------------------------------------
  useEffect(() => { loadInitialData(); }, [videoId]);

  const loadInitialData = async () => {
    try {
      try { setSubjects(await getSubjects()); } catch (e) { console.warn('subjects:', e); }

      let video: YouTubeVideo | null = null;
      try {
        const all = await getYouTubeVideos();
        video = all.find(v => v.id?.toString() === videoId) ?? null;
      } catch (e) { console.warn('videos:', e); }

      if (video) {
        // If title is empty, try to fetch from noembed
        if (!video.title && video.video_id) {
          try {
            const metadataRes = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${video.video_id}`);
            if (metadataRes.ok) {
              const metadata = await metadataRes.json();
              if (metadata.title) {
                video.title = metadata.title;
                // Update in backend
                if (video.id) {
                  await updateYouTubeVideo(video.id, { title: metadata.title }).catch(e => console.warn('updateTitle:', e));
                }
              }
            }
          } catch (err) {
            console.warn('Error fetching video title from noembed:', err);
          }
        }
        setVideoData(video);
        setSelectedSubjectId(video.subject_id ?? null);
      }

      await loadPersistedTexts(videoId);
    } catch (e) {
      console.error('loadInitialData:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPersistedTexts = async (key: string) => {
    const dir = TRANSCRIPTS_DIR();
    try {
      const ti = await FileSystem.getInfoAsync(`${dir}transcript_video_${key}.json`);
      if (ti.exists) {
        const parsed = JSON.parse(await FileSystem.readAsStringAsync(`${dir}transcript_video_${key}.json`));
        if (parsed.text) { setTranscription(parsed.text); setShowTutorial(false); }
      }
    } catch (e) { console.warn('transcript file:', e); }
    try {
      const si = await FileSystem.getInfoAsync(`${dir}summary_video_${key}.json`);
      if (si.exists) {
        const parsed = JSON.parse(await FileSystem.readAsStringAsync(`${dir}summary_video_${key}.json`));
        if (parsed.text) { setSummary(parsed.text); setShowTutorial(false); setActiveTab('summary'); }
      }
    } catch (e) { console.warn('summary file:', e); }
  };

  const saveTextToFile = async (text: string, type: 'transcript' | 'summary') => {
    const dir = TRANSCRIPTS_DIR();
    const fileUri = `${dir}${type}_video_${videoId}.json`;
    try {
      const di = await FileSystem.getInfoAsync(dir);
      if (!di.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify({ text, date: new Date().toISOString() }));

      // Persistir el texto en la BD para que el asistente IA no tenga que releer el archivo
      if (videoData?.id && type === 'transcript') {
        await upsertYouTubeTranscript({
          video_id: videoData.id,
          transcript_uri: fileUri,
          transcript_text: text,  // clave nueva — leida directamente por buildContext
        }).catch(e => console.warn('upsert youtube transcript DB:', e));
      }
    } catch (e) { console.error('saveTextToFile:', e); }
  };

  // ---------------------------------------------------------------------------
  // Subject association
  // ---------------------------------------------------------------------------
  const handleSubjectChange = async (newId: number | null) => {
    setSelectedSubjectId(newId);
    if (videoData?.id) {
      await updateYouTubeVideo(videoData.id, { subject_id: newId }).catch(e => console.warn('updateSubject:', e));
    }
  };

  // ---------------------------------------------------------------------------
  // Transcription (Whisper via Groq)
  // ---------------------------------------------------------------------------
  const startTranscriptionFlow = async () => {
    if (!videoData?.video_id) {
      alertRef.show({ title: 'Error', message: t('youtube.errors.videoIdNotFound'), type: 'error' });
      return;
    }

    setIsTranscribing(true);
    setTranscription(null);
    setSummary(null);

    try {
      const text = await transcribeYouTubeWithWhisper(videoData.video_id, GROQ_API_KEY);
      
      if (!text) {
        alertRef.show({ title: t('common.error') || 'Error', message: t('youtube.errors.captionsFetchFailed'), type: 'warning' });
        return;
      }

      setTranscription(text);
      setShowTutorial(false);
      // saveTextToFile ya persiste en BD mediante upsertYouTubeTranscript
      await saveTextToFile(text, 'transcript');
    } catch (e) {
      console.error('ERROR EN TRANSCRIPCIÓN:', e);
      const errorMsg = e instanceof Error ? e.message : String(e);
      
      // Better error messages
      let userMessage = '⚠️ Error al obtener subtítulos:\n\n';
      if (errorMsg.includes('Network')) {
        userMessage += 'Problema de conexión. Verifica que:\n• Tu backend esté corriendo en puerto 3000\n• Tengas conexión a internet\n• El servidor Render sea accesible';
      } else if (errorMsg.includes('No se encontraron subtítulos')) {
        userMessage += 'Este video no tiene subtítulos disponibles en YouTube';
      } else {
        userMessage += errorMsg;
      }
      alertRef.show({ title: t('common.error') || 'Error', message: userMessage, type: 'error' });
    } finally {
      setIsTranscribing(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Summary (Llama3 via Groq)
  // ---------------------------------------------------------------------------
  const startSummaryFlow = async () => {
    if (!GROQ_API_KEY) {
      alertRef.show({ title: 'Error', message: t('common.errors.groqApiKeyMissing'), type: 'error' });
      return;
    }
    if (!transcription) {
      alertRef.show({ title: t('common.error') || 'Error', message: t('dashboard.audioRecorderModal.ai.emptyTranscription') || 'Primero genera la transcripción.', type: 'warning' });
      return;
    }
    setIsSummarizing(true);
    setSummary(null);
    try {
      const result = await summarizeWithGroq(transcription, GROQ_API_KEY);
      setSummary(result);
      setShowTutorial(false);
      setActiveTab('summary');
      await saveTextToFile(result, 'summary');
    } catch (e) {
      alertRef.show({ title: t('common.error') || 'Error', message: e instanceof Error ? e.message : t('youtube.errors.summaryFailed'), type: 'error' });
    } finally {
      setIsSummarizing(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Clipboard
  // ---------------------------------------------------------------------------
  const copyToClipboard = async (text: string | null) => {
    if (!text) return;
    await Clipboard.setStringAsync(text);
    Alert.alert(t('common.success') || '¡Listo!', t('dashboard.audioRecorderModal.ai.copied') || '¡Texto copiado!');
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  if (isLoading) {
    return <PremiumLoading text={t('youtube.loading') || 'CARGANDO'} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.card} translucent={false} />

      {/* Top safe area */}
      <View style={{ height: insets.top, backgroundColor: theme.colors.card }} />

      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <Text 
          style={[styles.headerTitle, { flex: 1, textAlign: 'center', fontSize: 16 }]} 
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {videoTitle}
        </Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* YouTube Video Player */}
        {videoData?.video_id && (
          <View style={{ marginBottom: 12, borderRadius: 12, overflow: 'hidden', backgroundColor: '#000' }}>
            <YoutubePlayer
              height={Dimensions.get('window').width * 9 / 16}
              play={false}
              videoId={videoData.video_id}
              onChangeState={(event: string) => {
                console.log('YouTube player state:', event);
              }}
              onError={(error: string) => {
                console.error('YouTube player error:', error);
                Alert.alert('Error', t('youtube.errors.videoLoadFailed'));
              }}
              webViewProps={{
                javaScriptEnabled: true,
                domStorageEnabled: true,
                mediaPlaybackRequiresUserAction: false,
                allowsFullscreenVideo: true,
              }}
            />
          </View>
        )}

        {/* Video Meta (Date) - Compact */}
        {date && (
          <Text style={{ fontSize: 12, color: theme.colors.text.secondary, textAlign: 'center', marginBottom: 12 }}>
            {date}
          </Text>
        )}

        {/* Full title info box (si es muy largo) */}
        {videoTitle.length > 50 && (
          <View style={{ paddingHorizontal: 12, marginBottom: 12, paddingVertical: 8, backgroundColor: `${theme.colors.primary}08`, borderRadius: 8, borderLeftWidth: 3, borderLeftColor: theme.colors.primary }}>
            <Text style={{ fontSize: 11, color: theme.colors.text.secondary, fontStyle: 'italic' }}>
              Título: {videoTitle}
            </Text>
          </View>
        )}

        {/* Animated Subject Selector */}
        <AnimatedSubjectSelector 
          subjectForId={subjectForId} 
          onSelect={() => setShowSubjectPicker(true)} 
        />

        {/* AI Control Bar + Content (unified) */}
        <View style={{ marginTop: 8 }}>
          <RecordingAIContent
            activeTab={activeTab}
            onTabPress={setActiveTab}
            screenWidth={screenWidth}
            isTranscribing={isTranscribing}
            transcription={transcription}
            isSummarizing={isSummarizing}
            summary={summary}
            onCopy={copyToClipboard}
            onStartTranscriptionFlow={startTranscriptionFlow}
            onStartSummaryFlow={startSummaryFlow}
          />
        </View>

        {/* Flashcard Generator Button */}
        {(transcription || summary) && selectedSubjectId && (
          <TouchableOpacity
            style={{
              marginTop: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.colors.primary,
              borderRadius: 8,
              paddingVertical: 12,
              paddingHorizontal: 16,
              gap: 8,
            }}
            onPress={() => setShowFlashcardModal(true)}
          >
            <Ionicons name="sparkles" size={18} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>
              {t('flashcards.generate.button')}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Subject picker */}
      <SubjectPickerModal
        visible={showSubjectPicker}
        subjects={subjects}
        selectedId={selectedSubjectId}
        onSelect={handleSubjectChange}
        onClose={() => setShowSubjectPicker(false)}
      />

      {/* Flashcard Generator Modal */}
      <FlashcardCreatorModal
        visible={showFlashcardModal}
        onClose={() => setShowFlashcardModal(false)}
        onSuccess={(deckId) => {
          alertRef.show({
            title: t('flashcards.generate.success'),
            message: t('flashcards.generate.success'),
            type: 'success',
          });
        }}
        content={summary || transcription || ''}
        contentType="video"
        title={videoData?.title || 'Video'}
        subjectId={selectedSubjectId || 0}
        userId={videoData?.user_id || 0}
      />
    </View>
  );
};
