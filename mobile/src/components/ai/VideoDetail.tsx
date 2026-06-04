import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Dimensions,
  StatusBar,
  Modal,
} from 'react-native';
import { alertRef } from '../ui/CustomAlert';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import YoutubePlayer from 'react-native-youtube-iframe';

import { useConnectivityStore } from '../../store/useConnectivityStore';
import { theme } from '../../styles/theme';
import { detailStyles as styles } from '../../styles/RecordingDetailScreen.styles';
import { AITabType } from '../recordings/RecordingAITabs';
import { RecordingAIContent } from '../recordings/RecordingAIContent';
import { PremiumLoading } from '../ui/PremiumLoading';
import { FlashcardCreatorModal } from '../flashcards/FlashcardCreatorModal';
import { SubjectPickerModal } from '../subjects/SubjectPickerModal';
import { AnimatedSubjectSelector } from '../animated/AnimatedSubjectSelector';
import {
  getSubjects,
  Subject,
  getYouTubeVideos,
  YouTubeVideo,
  upsertYouTubeTranscript,
  updateYouTubeVideo,
  getYouTubeSubtitles,
} from '../../services/api';
import { AutoUploadIndicator } from '../ui/AutoUploadIndicator';
import { autoUploadIfEnabled } from '../../services/backup/backupService';
import { formatTranscription } from '../../utils/transcriptionFormatter';
import { summarizeWithFallback } from '../../utils/groqHelpers';

// ---------------------------------------------------------------------------
// Constants & Directories
// ---------------------------------------------------------------------------
const GROQ_API_KEY: string = process.env.EXPO_PUBLIC_GROQ_API_KEY ?? '';
const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const YOUTUBE_API_KEY: string = process.env.EXPO_PUBLIC_YOUTUBE_API_KEY ?? '';
const TRANSCRIPTS_DIR = () => `${FileSystem.documentDirectory}Threshold/transcripts/`;

// Groq helpers
// ---------------------------------------------------------------------------
async function transcribeYouTubeWithWhisper(videoId: string, apiKey?: string): Promise<string> {
  try {
    const result = await getYouTubeSubtitles(videoId, 'es');
    console.log('✓ YouTube captions fetched in', result.language);
    const rawCaptions = result.captions || '';

    if (!rawCaptions) return '';

    if (apiKey && rawCaptions.length > 50) {
      console.log('Usando Groq para estructurar la transcripción semánticamente...');
      const body = {
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: 'Eres un experto estructurador de textos académicos. Toma esta transcripción cruda de YouTube (que no tiene puntuación) y arréglala. Reglas estrictas:\n1. Agrega la puntuación y capitalización correctas.\n2. Separa el texto por semántica.\n3. Identifica palabras clave que den origen a una nueva idea, y usa esas palabras como subtítulos (formato Markdown ###) para crear párrafos separados.\n4. Mantén todo el texto original, no omitas información ni resumas.\n5. No agregues saludos ni despedidas, solo devuelve el texto formateado.',
          },
          {
            role: 'user',
            content: rawCaptions,
          },
        ],
        temperature: 0.2,
      };

      const response = await fetch(`${GROQ_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const data = await response.json();
        const formatted = data?.choices?.[0]?.message?.content;
        if (formatted) return formatted;
      } else {
        console.warn('Groq formatting failed, falling back to raw captions');
      }
    }

    return rawCaptions;
  } catch (error) {
    console.error('✗ Error fetching YouTube captions:', error);
    throw new Error(`Error obteniendo subtítulos: ${error instanceof Error ? error.message : error}`);
  }
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
  const router = useRouter();

  const [transcription, setTranscription] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [activeTab, setActiveTab] = useState<AITabType>('transcription');
  const [showTutorial, setShowTutorial] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  
  const isOnline = useConnectivityStore(state => state.isOnline);

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [videoData, setVideoData] = useState<YouTubeVideo | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [showSubjectPicker, setShowSubjectPicker] = useState(false);

  const [showFlashcardModal, setShowFlashcardModal] = useState(false);
  const [studyDeck, setStudyDeck] = useState<{ id: number; title: string; cards: any[] } | null>(null);
  const [showStudyScreen, setShowStudyScreen] = useState(false);

  const videoTitle = videoData?.title || 'Video de YouTube';
  const date = videoData?.created_at
    ? new Date(videoData.created_at).toLocaleString()
    : '';

  const screenWidth = Dimensions.get('window').width - 48;
  const subjectForId = subjects.find(s => s.id === selectedSubjectId);

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
        if (!video.title && video.video_id) {
          try {
            const metadataRes = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${video.video_id}`);
            if (metadataRes.ok) {
              const metadata = await metadataRes.json();
              if (metadata.title) {
                video.title = metadata.title;
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

      await loadPersistedTexts(videoId, video);
    } catch (e) {
      console.error('loadInitialData:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPersistedTexts = async (key: string, video: YouTubeVideo | null) => {
    const dir = TRANSCRIPTS_DIR();
    let localTranscriptFound = false;
    try {
      const ti = await FileSystem.getInfoAsync(`${dir}transcript_video_${key}.json`);
      if (ti.exists) {
        const parsed = JSON.parse(await FileSystem.readAsStringAsync(`${dir}transcript_video_${key}.json`));
        if (parsed.text) { 
          setTranscription(parsed.text); 
          setShowTutorial(false); 
          localTranscriptFound = true;
        }
      }
    } catch (e) { console.warn('transcript file:', e); }

    if (!localTranscriptFound && video?.transcript_text) {
      console.log(`[VideoDetail] Fallback a transcript_text del servidor para video: ${video.id}`);
      setTranscription(video.transcript_text);
      setShowTutorial(false);
    }

    let localSummaryFound = false;
    try {
      const si = await FileSystem.getInfoAsync(`${dir}summary_video_${key}.json`);
      if (si.exists) {
        const parsed = JSON.parse(await FileSystem.readAsStringAsync(`${dir}summary_video_${key}.json`));
        if (parsed.text) { 
          setSummary(parsed.text); 
          setShowTutorial(false); 
          setActiveTab('summary'); 
          localSummaryFound = true;
        }
      }
    } catch (e) { console.warn('summary file:', e); }

    if (!localSummaryFound && (video as any)?.summary_text) {
      console.log(`[VideoDetail] Fallback a summary_text del servidor para video: ${video?.id}`);
      setSummary((video as any).summary_text);
      setShowTutorial(false);
      setActiveTab('summary');
    }
  };

  const saveTextToFile = async (text: string, type: 'transcript' | 'summary') => {
    const dir = TRANSCRIPTS_DIR();
    const fileUri = `${dir}${type}_video_${videoId}.json`;
    try {
      const di = await FileSystem.getInfoAsync(dir);
      if (!di.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify({ text, date: new Date().toISOString() }));

      if (videoData?.id) {
        await upsertYouTubeTranscript({
          video_id: videoData.id,
          ...(type === 'transcript' ? { transcript_uri: fileUri, transcript_text: text } : {}),
          ...(type === 'summary' ? { summary_uri: fileUri, summary_text: text } : {}),
        }).catch(e => console.warn('upsert youtube transcript DB:', e));
        
        await autoUploadIfEnabled(
          fileUri,
          'transcript',
          videoData.id,
          `${type}_video_${videoData.id}.json`,
          'application/json',
          'youtube'
        ).catch(err => console.warn('[VideoDetail] Auto-upload error:', err));
      }
    } catch (e) { console.error('saveTextToFile:', e); }
  };

  const handleSubjectChange = async (newId: number | null) => {
    setSelectedSubjectId(newId);
    if (videoData?.id) {
      await updateYouTubeVideo(videoData.id, { subject_id: newId }).catch(e => console.warn('updateSubject:', e));
    }
  };

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

      const formattedText = formatTranscription(text);
      
      setTranscription(formattedText);
      setShowTutorial(false);
      await saveTextToFile(formattedText, 'transcript');
    } catch (e) {
      console.error('ERROR EN TRANSCRIPCIÓN:', e);
      const errorMsg = e instanceof Error ? e.message : String(e);
      
      let userMessage = t('youtube.errors.captionsFetchFailed') + ':\n\n';
      if (errorMsg.includes('Network')) {
        userMessage += t('youtube.errors.networkError');
      } else if (errorMsg.includes('No se encontraron subtítulos')) {
        userMessage += t('youtube.errors.noSubtitlesFound');
      } else {
        userMessage += errorMsg;
      }
      alertRef.show({ title: t('common.error') || 'Error', message: userMessage, type: 'error' });
    } finally {
      setIsTranscribing(false);
    }
  };

  const startSummaryFlow = async () => {
    if (!transcription) {
      alertRef.show({ title: t('common.error') || 'Error', message: t('dashboard.audioRecorderModal.ai.emptyTranscription') || 'Primero genera la transcripción.', type: 'warning' });
      return;
    }
    setIsSummarizing(true);
    setSummary(null);
    try {
      const result = await summarizeWithFallback(transcription, GROQ_API_KEY);
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

  const copyToClipboard = async (text: string | null) => {
    if (!text) return;
    await Clipboard.setStringAsync(text);
    Alert.alert(t('common.success') || '¡Listo!', t('dashboard.audioRecorderModal.ai.copied') || '¡Texto copiado!');
  };

  if (isLoading) {
    return <PremiumLoading text={t('youtube.loading') || 'CARGANDO'} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor={theme.colors.card} translucent={false} />

      <View style={{ height: insets.top, backgroundColor: theme.colors.card }} />

      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
          <Text 
            style={[styles.headerTitle, { flex: 1, textAlign: 'center', fontSize: 16 }]} 
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {videoTitle}
          </Text>
          <AutoUploadIndicator size={16} />
        </View>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {videoData?.video_id && (
          <View style={{ alignItems: 'center', marginBottom: 12 }}>
            <View style={{ width: '100%', borderRadius: 12, overflow: 'hidden', aspectRatio: 16/9, backgroundColor: theme.colors.card }}>
              {isOnline ? (
                <YoutubePlayer
                  height={Dimensions.get('window').width * 9 / 16}
                  play={false}
                  videoId={videoData.video_id}
                  onChangeState={(event: string) => {
                    console.log('YouTube player state:', event);
                  }}
                  onError={(error: string) => {
                    console.error('YouTube player error:', error);
                    Alert.alert('Error', t('youtube.errors.videoLoadFailed') || 'Error cargando el video');
                  }}
                  webViewProps={{
                    javaScriptEnabled: true,
                    domStorageEnabled: true,
                    mediaPlaybackRequiresUserAction: false,
                    allowsFullscreenVideo: true,
                  }}
                />
              ) : (
                <LinearGradient
                  colors={['#0D0D0D', '#1A1A2E', '#16213E']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ flex: 1, justifyContent: 'center', alignItems: 'center', position: 'relative', overflow: 'hidden' }}
                >
                  {/* Faded YouTube brand mark */}
                  <MaterialCommunityIcons
                    name="youtube"
                    size={140}
                    color="rgba(255,255,255,0.04)"
                    style={{ position: 'absolute', bottom: -20, right: -20 }}
                  />

                  {/* Icon stack */}
                  <View style={{ alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                    <View style={{
                      width: 64,
                      height: 64,
                      borderRadius: 32,
                      backgroundColor: 'rgba(255,255,255,0.07)',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: 1,
                      borderColor: 'rgba(255,255,255,0.10)',
                    }}>
                      <Ionicons name="wifi-outline" size={28} color="rgba(255,255,255,0.45)" />
                    </View>
                    {/* Disconnection slash */}
                    <View style={{
                      position: 'absolute',
                      width: 2,
                      height: 72,
                      backgroundColor: 'rgba(255,255,255,0.18)',
                      transform: [{ rotate: '45deg' }],
                      borderRadius: 1,
                    }} />
                  </View>

                  {/* Status badge */}
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    borderRadius: 20,
                    paddingHorizontal: 12,
                    paddingVertical: 5,
                    borderWidth: 1,
                    borderColor: 'rgba(255,255,255,0.12)',
                    marginBottom: 12,
                  }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#FF9500' }} />
                    <Text style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase' }}>
                      Sin conexión
                    </Text>
                  </View>

                  <Text style={{ color: 'rgba(255,255,255,0.88)', fontSize: 15, fontWeight: '700', letterSpacing: 0.2, textAlign: 'center' }}>
                    Reproducción no disponible
                  </Text>
                  <Text style={{ color: 'rgba(255,255,255,0.38)', fontSize: 12, marginTop: 6, textAlign: 'center', paddingHorizontal: 32, lineHeight: 18 }}>
                    El contenido guardado — transcripción y resumen — sigue disponible abajo.
                  </Text>
                </LinearGradient>
              )}
            </View>
          </View>
        )}

        <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.text.primary, textAlign: 'center', marginHorizontal: 20, marginBottom: 4 }}>
          {videoTitle}
        </Text>

        {date && (
          <Text style={{ fontSize: 12, color: theme.colors.text.secondary, textAlign: 'center', marginBottom: 12 }}>
            {date}
          </Text>
        )}

        {videoTitle.length > 50 && (
          <View style={{ paddingHorizontal: 12, marginBottom: 12, paddingVertical: 8, backgroundColor: `${theme.colors.primary}08`, borderRadius: 8, borderLeftWidth: 3, borderLeftColor: theme.colors.primary }}>
            <Text style={{ fontSize: 11, color: theme.colors.text.secondary, fontStyle: 'italic' }}>
              {t('common.title', { defaultValue: 'Title' })}: {videoTitle}
            </Text>
          </View>
        )}

        <AnimatedSubjectSelector 
          subjectForId={subjectForId} 
          onSelect={() => setShowSubjectPicker(true)} 
        />

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

      <SubjectPickerModal
        visible={showSubjectPicker}
        subjects={subjects}
        selectedId={selectedSubjectId}
        onSelect={handleSubjectChange}
        onClose={() => setShowSubjectPicker(false)}
      />

      <FlashcardCreatorModal
        visible={showFlashcardModal}
        onClose={() => setShowFlashcardModal(false)}
        onSuccess={async (deckId) => {
          setShowFlashcardModal(false);
          try {
            const { getFlashcardsPrioritized, getFlashcardDecksWithMetrics } = await import('../../services/api');
            const decks = await getFlashcardDecksWithMetrics();
            const deck = decks.find(d => d.id === deckId);
            if (deck) {
              const cards = await getFlashcardsPrioritized(deckId);
              setStudyDeck({ id: deckId, title: deck.title, cards });
              setShowStudyScreen(true);
            }
          } catch (e) {
            console.error('Error loading deck for study:', e);
            alertRef.show({ title: 'Error', message: 'No se pudo cargar el mazo', type: 'error' });
          }
        }}
        content={summary || transcription || ''}
        contentType="video"
        title={videoData?.title || 'Video'}
        subjectId={selectedSubjectId || 0}
        userId={videoData?.user_id || 0}
      />

      {showStudyScreen && studyDeck && (
        <Modal visible={showStudyScreen} animationType="slide">
          <View style={{ flex: 1 }}>
            {(() => {
              const { FlashcardStudyScreenStandalone } = require('../flashcards/FlashcardStudyScreenStandalone');
              return (
                <FlashcardStudyScreenStandalone
                  activeDeck={{ ...studyDeck, card_count: studyDeck.cards.length, user_id: videoData?.user_id || 0 }}
                  initialCards={studyDeck.cards}
                  currentUserId={videoData?.user_id || 0}
                  onBack={() => {
                    setShowStudyScreen(false);
                    setStudyDeck(null);
                    setTimeout(() => router.push('/flashcards'), 300);
                  }}
                />
              );
            })()}
          </View>
        </Modal>
      )}
    </View>
  );
};
