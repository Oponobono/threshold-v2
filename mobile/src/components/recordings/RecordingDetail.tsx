import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'expo-router';
import Slider from '@react-native-community/slider';
import { LinearGradient } from 'expo-linear-gradient';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  Dimensions,
  StatusBar,
  Animated,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { alertRef } from '../ui/CustomAlert';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '../../styles/theme';
import { detailStyles as styles } from '../../styles/RecordingDetailScreen.styles';
import { RecordingAITabs, AITabType } from './RecordingAITabs';
import { RecordingAIContent } from './RecordingAIContent';
import { PremiumLoading } from '../ui/PremiumLoading';
import { FlashcardCreatorModal } from '../flashcards/FlashcardCreatorModal';
import {
  getSubjects,
  Subject,
  getAudioRecordings,
  AudioRecording,
  upsertAudioTranscript,
  updateAudioRecording,
} from '../../services/api';

import { SubjectPickerModal } from '../subjects/SubjectPickerModal';
import { AnimatedSubjectSelector } from '../animated/AnimatedSubjectSelector';
import { WaveformBars } from '../audio/WaveformBars';
import { AutoUploadIndicator } from '../ui/AutoUploadIndicator';
import { transcribeWithFallback, summarizeWithFallback } from '../../utils/groqHelpers';
import { useLocalAIStore } from '../../store/useLocalAIStore';
import { formatTranscription } from '../../utils/transcriptionFormatter';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const GROQ_API_KEY: string = process.env.EXPO_PUBLIC_GROQ_API_KEY ?? '';
const AUDIO_DIR = () => `${FileSystem.documentDirectory}Threshold/audio/`;
const TRANSCRIPTS_DIR = () => `${FileSystem.documentDirectory}Threshold/transcripts/`;

// ---------------------------------------------------------------------------
// RecordingDetail Component
// ---------------------------------------------------------------------------
interface RecordingDetailProps {
  recordingId: string;
  onBack: () => void;
}

/**
 * RecordingDetail.tsx
 *
 * Pantalla completa de detalle para un archivo de audio (nota de voz).
 * Implementa el reproductor nativo `expo-av` con una barra de progreso (`Slider`).
 * Carga o solicita la transcripción a la API de Groq (Whisper) y la sintetiza a un resumen
 * académico mediante Llama-3. También invoca la creación de flashcards desde la transcripción.
 *
 * @param recordingId - Identificador único o nombre de archivo de la grabación.
 * @param onBack - Función para retroceder en la navegación y detener el audio.
 */
export const RecordingDetail: React.FC<RecordingDetailProps> = ({ recordingId, onBack }) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Playback
  const soundRef = useRef<Audio.Sound | null>(null);
  const isSeeking = useRef(false);
  const isToggling = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);

  // AI state
  const [transcription, setTranscription] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [activeTab, setActiveTab] = useState<AITabType>('transcription');
  const [showTutorial, setShowTutorial] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // Recording metadata
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [recordingData, setRecordingData] = useState<AudioRecording | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [showSubjectPicker, setShowSubjectPicker] = useState(false);

  // Flashcard generation
  const [showFlashcardModal, setShowFlashcardModal] = useState(false);
  const [studyDeck, setStudyDeck] = useState<{ id: string; title: string; cards: any[] } | null>(null);
  const [showStudyScreen, setShowStudyScreen] = useState(false);

  const [audioUri, setAudioUri] = useState<string>('');

  const recordingTitle = recordingData?.name
    || (() => {
      const ts = parseInt(recordingId.split('_')[1] || '0', 10);
      return ts
        ? t('dashboard.audioRecorderModal.fileLabel', { date: new Date(ts).toLocaleDateString() })
        : t('dashboard.audioRecorderModal.ai.recording') || 'Grabación';
    })();

  const date = recordingData?.created_at
    ? new Date(recordingData.created_at).toLocaleString()
    : (() => {
        const ts = parseInt(recordingId.split('_')[1] || '0', 10);
        return ts ? new Date(ts).toLocaleString() : '';
      })();

  const screenWidth = Dimensions.get('window').width - 48;
  const subjectForId = selectedSubjectId != null ? subjects.find(s => String(s.id) === String(selectedSubjectId)) : undefined;

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------
  useEffect(() => {
    return () => {
      // Stop playback and cleanup
      if (soundRef.current) {
        try {
          soundRef.current.stopAsync().catch(() => {});
          soundRef.current.unloadAsync().catch(() => {});
        } catch (err) {
          console.warn('[RecordingDetail] Cleanup error:', err);
        }
        soundRef.current = null;
      }
      setIsPlaying(false);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Load data
  // ---------------------------------------------------------------------------
  useEffect(() => { loadInitialData(); }, [recordingId]);

  const loadInitialData = async () => {
    try {
      try { setSubjects(await getSubjects()); } catch (e) { console.warn('subjects:', e); }

      let rec: AudioRecording | null = null;
      try {
        const all = await getAudioRecordings();
        rec = all.find(r =>
          r.id?.toString() === recordingId ||
          r.id_string === recordingId ||
          r.local_uri?.endsWith(recordingId) ||
          r.local_uri?.endsWith(`${recordingId}.m4a`) ||
          r.uri?.endsWith(recordingId) ||
          r.uri?.endsWith(`${recordingId}.m4a`) ||
          (r.local_uri ? r.local_uri.split('/').pop()?.replace(/\.m4a$/, '') === recordingId : false) ||
          (r.uri ? r.uri.split('/').pop()?.replace(/\.m4a$/, '') === recordingId : false)
        ) ?? null;
      } catch (e) { console.warn('recordings:', e); }

      if (rec) { 
        setRecordingData(rec); 
        setSelectedSubjectId(rec.subject_id ? String(rec.subject_id) : null); 
      }
      
      // Determinar mejor URI de audio (Caché local -> Fallback a Nube -> Búsqueda)
      let bestUri = rec?.local_uri || '';
      if (bestUri) {
        try {
          let info = await FileSystem.getInfoAsync(bestUri);
          if (!info.exists && bestUri.startsWith('file://')) {
            info = await FileSystem.getInfoAsync(bestUri.replace(/^file:\/\//, ''));
          }
          if (!info.exists && rec?.cloud_url) {
            console.log(`[RecordingDetail] Fallback a cloud_url para audio: ${rec?.id}`);
            bestUri = rec.cloud_url;
          } else if (!info.exists) {
            bestUri = '';
          }
        } catch {
          bestUri = '';
        }
      }
      
      if (!bestUri) {
        const dir = AUDIO_DIR();
        const candidates = [
          ...(rec?.local_uri ? [rec.local_uri] : []),
          `${dir}${recordingId}`,
          `${dir}rec_${recordingId}.m4a`,
          `${dir}${recordingId}.m4a`,
          recordingId,
        ];
        for (const candidate of candidates) {
          try {
            let info = await FileSystem.getInfoAsync(candidate);
            if (!info.exists && candidate.startsWith('file://')) {
              info = await FileSystem.getInfoAsync(candidate.replace(/^file:\/\//, ''));
            }
            if (info.exists) {
              bestUri = candidate;
              break;
            }
          } catch {}
        }
      }
      
      setAudioUri(bestUri);

      const fileKey = recordingId.replace(/\.m4a$/, '');
      const serverKey = rec?.id?.toString() ?? null;
      await loadPersistedTexts(fileKey, serverKey, rec);
    } catch (e) {
      console.error('loadInitialData:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPersistedTexts = async (fileKey: string, serverKey: string | null, rec: AudioRecording | null) => {
    const dir = TRANSCRIPTS_DIR();
    const tryLoadText = async (): Promise<boolean> => {
      const candidates = [fileKey, serverKey].filter(Boolean) as string[];
      for (const k of candidates) {
        try {
          const fi = await FileSystem.getInfoAsync(`${dir}transcript_${k}.json`);
          if (fi.exists) {
            const parsed = JSON.parse(await FileSystem.readAsStringAsync(`${dir}transcript_${k}.json`));
            if (parsed.text) {
              setTranscription(parsed.text);
              setShowTutorial(false);
              return true;
            }
          }
        } catch {}
      }
      return false;
    };

    const tryLoadSummary = async (): Promise<boolean> => {
      const candidates = [fileKey, serverKey].filter(Boolean) as string[];
      for (const k of candidates) {
        try {
          const fi = await FileSystem.getInfoAsync(`${dir}summary_${k}.json`);
          if (fi.exists) {
            const parsed = JSON.parse(await FileSystem.readAsStringAsync(`${dir}summary_${k}.json`));
            if (parsed.text) {
              setSummary(parsed.text);
              return true;
            }
          }
        } catch {}
      }
      return false;
    };

    const localTranscriptFound = await tryLoadText();
    if (!localTranscriptFound && rec?.transcript_text) {
      console.log(`[RecordingDetail] Fallback a transcript_text del servidor para: ${rec.id}`);
      setTranscription(rec.transcript_text);
      setShowTutorial(false);
    }

    const localSummaryFound = await tryLoadSummary();
    if (!localSummaryFound && rec?.summary_text) {
      console.log(`[RecordingDetail] Fallback a summary_text del servidor para audio: ${rec?.id}`);
      setSummary(rec.summary_text);
    }
  };

  // ---------------------------------------------------------------------------
  // Persist text locally + optionally register in DB
  // ---------------------------------------------------------------------------
  const saveTextToFile = async (text: string, type: 'transcript' | 'summary') => {
    const key = recordingId.replace(/\.m4a$/, '');
    const dir = TRANSCRIPTS_DIR();
    const fileUri = `${dir}${type}_${key}.json`;
    try {
      const di = await FileSystem.getInfoAsync(dir);
      if (!di.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify({ text, date: new Date().toISOString() }));
      console.log(`[RecordingDetail] ${type} guardado localmente en: ${fileUri}`);
      if (recordingData?.id) {
        await upsertAudioTranscript({
          recording_id: recordingData.id,
          ...(type === 'transcript' ? { transcript_uri: fileUri, transcript_text: text } : {}),
          ...(type === 'summary' ? { summary_uri: fileUri, summary_text: text } : {}),
        }).catch(e => console.warn('upsert transcript DB:', e));
      }
    } catch (e) { console.error('saveTextToFile:', e); }
  };


  // ---------------------------------------------------------------------------
  // Subject association
  // ---------------------------------------------------------------------------
  const handleSubjectChange = async (newId: string | null) => {
    setSelectedSubjectId(newId);
    if (recordingData?.id) {
      await updateAudioRecording(recordingData.id, { subject_id: newId }).catch(e => console.warn('updateSubject:', e));
    }
  };

  // ---------------------------------------------------------------------------
  // Playback
  // ---------------------------------------------------------------------------
  const formatMs = (ms: number): string => {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleSeek = useCallback(async (value: number) => {
    if (!soundRef.current) return;
    try {
      const status = await soundRef.current.getStatusAsync();
      if (status.isLoaded) {
        await soundRef.current.setPositionAsync(Math.floor(value * (status.durationMillis ?? 0)));
      }
    } catch (e) { /* ignore */ }
  }, []);

  const togglePlayback = useCallback(async () => {
    try {
      if (soundRef.current) {
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded) {
          isToggling.current = true;
          if (status.isPlaying) {
            setIsPlaying(false); // Update UI immediately to avoid lag
            await soundRef.current.pauseAsync();
          } else {
            setIsPlaying(true); // Update UI immediately to avoid lag
            await soundRef.current.playAsync();
          }
          isToggling.current = false;
          return;
        }
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      await Audio.setAudioModeAsync({ 
        allowsRecordingIOS: false, 
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
      });
      let sound: Audio.Sound;
      try {
        const result = await Audio.Sound.createAsync(
          { uri: audioUri },
          { shouldPlay: true, progressUpdateIntervalMillis: 100 },
        );
        sound = result.sound;
      } catch (firstErr) {
        if (audioUri.startsWith('file://')) {
          const rawPath = audioUri.replace(/^file:\/\//, '');
          console.warn('[RecordingDetail] Reintentando playback sin prefijo file://:', rawPath);
          const fallbackResult = await Audio.Sound.createAsync(
            { uri: rawPath },
            { shouldPlay: true, progressUpdateIntervalMillis: 100 },
          );
          sound = fallbackResult.sound;
        } else {
          throw firstErr;
        }
      }
      soundRef.current = sound;
      setIsPlaying(true);
      setPositionMs(0);

      sound.setOnPlaybackStatusUpdate((s: AVPlaybackStatus) => {
        if (!s.isLoaded) return;
        if (s.durationMillis) setDurationMs(s.durationMillis);
        
        if (s.didJustFinish) {
          setIsPlaying(false);
          setPositionMs(0);
          sound.stopAsync(); // Physically stop and rewind audio to start
        } else {
          if (!isSeeking.current) {
            setPositionMs(s.positionMillis ?? 0);
          }
          // Only sync state with audio engine if we are not manually toggling it right now
          if (!isToggling.current) {
            setIsPlaying(prev => prev !== s.isPlaying ? s.isPlaying : prev);
          }
        }
      });
    } catch (e) {
      isToggling.current = false;
      setIsPlaying(false);
      alertRef.show({ title: t('common.error') || 'Error', message: t('recordings.errors.playbackFailed'), type: 'error' });
    }
  }, [audioUri, t]);

  // ---------------------------------------------------------------------------
  // Transcription (Whisper via Groq)
  // ---------------------------------------------------------------------------
  const startTranscriptionFlow = async () => {
    setIsTranscribing(true);
    setTranscription(null);
    setSummary(null);

    try {
      const text = await transcribeWithFallback(audioUri, GROQ_API_KEY);
      
      if (!text) {
        alertRef.show({ title: t('common.error') || 'Error', message: t('recordings.errors.noVoiceDetected'), type: 'warning' });
        return;
      }

      // Formatear la transcripción para mejorar presentación
      const formattedText = formatTranscription(text);
      
      setTranscription(formattedText);
      setShowTutorial(false);
      await saveTextToFile(formattedText, 'transcript');
    } catch (e) {
      console.error('ERROR EN TRANSCRIPCIÓN:', e);
      alertRef.show({ title: t('common.error') || 'Error', message: e instanceof Error ? e.message : t('recordings.errors.transcriptionFailed'), type: 'error' });
    } finally {
      setIsTranscribing(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Summary (Llama3 via Groq)
  // ---------------------------------------------------------------------------
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
      alertRef.show({ title: t('common.error') || 'Error', message: e instanceof Error ? e.message : t('recordings.errors.summaryFailed'), type: 'error' });
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
    alertRef.show({ title: t('common.success') || '¡Listo!', message: t('dashboard.audioRecorderModal.ai.copied') || '¡Texto copiado!', type: 'success' });
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  if (isLoading) {
    return <PremiumLoading text={t('recordings.loading') || 'CARGANDO'} />;
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
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={[styles.headerTitle, { flex: 1, textAlign: 'center' }]} numberOfLines={1}>
            {recordingTitle}
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
        {/* Player Card */}
        <LinearGradient
          colors={['#1A1A2E', '#16213E', '#0F3460']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.playerCard}
        >
          {/* Dynamic waveform visualizer */}
          <WaveformBars isPlaying={isPlaying} />

          {/* Top row: mic badge + meta */}
          <View style={styles.playerTopRow}>
            <View style={styles.playerMicBadge}>
              <MaterialCommunityIcons name="microphone" size={20} color="#fff" />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.playerTitle} numberOfLines={2}>{recordingTitle}</Text>
              <Text style={styles.playerDate}>{date}</Text>
            </View>
          </View>

          {/* Divider */}
          <View style={styles.playerDivider} />

          {/* Controls row: play btn + slider column */}
          <View style={styles.playerControls}>
            <TouchableOpacity style={styles.playButton} onPress={togglePlayback} activeOpacity={0.8}>
              <View style={styles.playButtonRing}>
                <Ionicons
                  name={isPlaying ? 'pause' : 'play'}
                  size={26}
                  color="#fff"
                  style={isPlaying ? {} : { marginLeft: 3 }}
                />
              </View>
            </TouchableOpacity>

            <View style={{ flex: 1 }}>
              {/* Seek bar */}
              <Slider
                style={{ width: '100%', height: 36, marginTop: -4 }}
                minimumValue={0}
                maximumValue={1}
                value={durationMs > 0 ? positionMs / durationMs : 0}
                minimumTrackTintColor="#ffffff"
                maximumTrackTintColor="rgba(255,255,255,0.25)"
                thumbTintColor="#ffffff"
                onSlidingStart={() => { isSeeking.current = true; }}
                onSlidingComplete={async (v) => {
                  isSeeking.current = false;
                  await handleSeek(v);
                }}
              />
              {/* Timestamps */}
              <View style={styles.playerTimestamps}>
                <Text style={styles.playerTimeText}>{formatMs(positionMs)}</Text>
                <Text style={styles.playerTimeText}>{durationMs > 0 ? formatMs(durationMs) : '--:--'}</Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* Animated Subject Selector */}
        <AnimatedSubjectSelector 
          subjectForId={subjectForId} 
          onSelect={() => setShowSubjectPicker(true)} 
        />

        {/* AI Control Bar + Content (unified) */}
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
        onSuccess={async (deckId) => {
          setShowFlashcardModal(false);
          // Load deck data and navigate to study screen
          try {
            const { getFlashcardsPrioritized, getFlashcardDecksWithMetrics } = await import('../../services/api');
            const decks = await getFlashcardDecksWithMetrics();
            const deck = decks.find(d => String(d.id) === String(deckId));
            if (deck) {
              const cards = await getFlashcardsPrioritized(String(deckId));
              setStudyDeck({ id: deckId, title: deck.title, cards });
              setShowStudyScreen(true);
            }
          } catch (e) {
            console.error('Error loading deck for study:', e);
            alertRef.show({ title: 'Error', message: 'No se pudo cargar el mazo', type: 'error' });
          }
        }}
        content={summary || transcription || ''}
        contentType="recording"
        title={recordingData?.name || 'Recording'}
        subjectId={selectedSubjectId || ''}
        userId={recordingData?.user_id ? String(recordingData.user_id) : ''}
      />

      {/* Study Screen Modal */}
      {showStudyScreen && studyDeck && (
        <Modal visible={showStudyScreen} animationType="slide">
          <View style={{ flex: 1 }}>
            {(() => {
              const { FlashcardStudyScreenStandalone } = require('../flashcards/FlashcardStudyScreenStandalone');
              return (
                <FlashcardStudyScreenStandalone
                  activeDeck={{ ...studyDeck, card_count: studyDeck.cards.length, user_id: recordingData?.user_id ? Number(recordingData.user_id) : 0 }}
                  initialCards={studyDeck.cards}
                  currentUserId={recordingData?.user_id ? Number(recordingData.user_id) : 0}
                  onBack={() => {
                    setShowStudyScreen(false);
                    setStudyDeck(null);
                    // Navigate to flashcards screen
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
