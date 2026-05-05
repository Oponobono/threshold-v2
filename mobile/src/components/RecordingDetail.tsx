import React, { useEffect, useState, useCallback, useRef } from 'react';
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
} from 'react-native';
import { alertRef } from './CustomAlert';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { theme } from '../styles/theme';
import { detailStyles as styles } from '../styles/RecordingDetailScreen.styles';
import { RecordingAITabs, AITabType } from './RecordingAITabs';
import { RecordingAIContent } from './RecordingAIContent';
import { PremiumLoading } from './PremiumLoading';
import { FlashcardCreatorModal } from './FlashcardCreatorModal';
import {
  getSubjects,
  Subject,
  getAudioRecordings,
  AudioRecording,
  upsertAudioTranscript,
  updateAudioRecording,
} from '../services/api';

import { SubjectPickerModal } from './SubjectPickerModal';
import { AnimatedSubjectSelector } from './AnimatedSubjectSelector';
import { WaveformBars } from './WaveformBars';
import { transcribeWithWhisper, summarizeWithGroq } from '../utils/groqHelpers';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const GROQ_API_KEY: string = process.env.EXPO_PUBLIC_GROQ_API_KEY ?? '';
const AUDIO_DIR = () => `${FileSystem.documentDirectory}Threshold/audio/`;
const TRANSCRIPTS_DIR = () => `${FileSystem.documentDirectory}Threshold/transcripts/`;

function getLocalKey(recordingData: AudioRecording | null, id: string): string {
  if (recordingData?.id) return recordingData.id.toString();
  return id.replace(/\.m4a$/, '');
}

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
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [showSubjectPicker, setShowSubjectPicker] = useState(false);

  // Flashcard generation
  const [showFlashcardModal, setShowFlashcardModal] = useState(false);

  // Derived values
  const audioUri = recordingData?.local_uri
    || `${AUDIO_DIR()}${recordingId.endsWith('.m4a') ? recordingId : `${recordingId}.m4a`}`;

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
  const subjectForId = subjects.find(s => s.id === selectedSubjectId);

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------
  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
      soundRef.current = null;
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
          r.local_uri.endsWith(recordingId) ||
          r.local_uri.endsWith(`${recordingId}.m4a`)
        ) ?? null;
      } catch (e) { console.warn('recordings:', e); }

      if (rec) { setRecordingData(rec); setSelectedSubjectId(rec.subject_id ?? null); }

      const key = rec?.id?.toString() ?? recordingId.replace(/\.m4a$/, '');
      await loadPersistedTexts(key);
    } catch (e) {
      console.error('loadInitialData:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPersistedTexts = async (key: string) => {
    const dir = TRANSCRIPTS_DIR();
    try {
      const ti = await FileSystem.getInfoAsync(`${dir}transcript_${key}.json`);
      if (ti.exists) {
        const parsed = JSON.parse(await FileSystem.readAsStringAsync(`${dir}transcript_${key}.json`));
        if (parsed.text) { setTranscription(parsed.text); setShowTutorial(false); }
      }
    } catch (e) { console.warn('transcript file:', e); }
    try {
      const si = await FileSystem.getInfoAsync(`${dir}summary_${key}.json`);
      if (si.exists) {
        const parsed = JSON.parse(await FileSystem.readAsStringAsync(`${dir}summary_${key}.json`));
        if (parsed.text) setSummary(parsed.text);
      }
    } catch (e) { console.warn('summary file:', e); }
  };

  // ---------------------------------------------------------------------------
  // Persist text locally + optionally register in DB
  // ---------------------------------------------------------------------------
  const saveTextToFile = async (text: string, type: 'transcript' | 'summary') => {
    const key = getLocalKey(recordingData, recordingId);
    const dir = TRANSCRIPTS_DIR();
    const fileUri = `${dir}${type}_${key}.json`;
    try {
      const di = await FileSystem.getInfoAsync(dir);
      if (!di.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      await FileSystem.writeAsStringAsync(fileUri, JSON.stringify({ text, date: new Date().toISOString() }));
      if (recordingData?.id) {
        await upsertAudioTranscript({
          recording_id: recordingData.id,
          // Guardar la URI del archivo local para acceso offline
          ...(type === 'transcript' ? { transcript_uri: fileUri } : { summary_uri: fileUri }),
          // Guardar el texto inline para que el asistente IA pueda leerlo sin acceder al dispositivo
          ...(type === 'transcript' ? { transcript_text: text } : {}),
        }).catch(e => console.warn('upsert transcript DB:', e));
      }
    } catch (e) { console.error('saveTextToFile:', e); }
  };


  // ---------------------------------------------------------------------------
  // Subject association
  // ---------------------------------------------------------------------------
  const handleSubjectChange = async (newId: number | null) => {
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
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        // 100ms interval (10fps) prevents UI thread locks while keeping slider smooth
        { shouldPlay: true, progressUpdateIntervalMillis: 100 },
      );
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
    if (!GROQ_API_KEY) {
      alertRef.show({ title: t('common.error') || 'Error', message: t('common.errors.groqApiKeyMissing'), type: 'error' });
      return;
    }

    setIsTranscribing(true);
    setTranscription(null);
    setSummary(null);

    try {
      const text = await transcribeWithWhisper(audioUri, GROQ_API_KEY);
      
      if (!text) {
        alertRef.show({ title: t('common.error') || 'Error', message: t('recordings.errors.noVoiceDetected'), type: 'warning' });
        return;
      }

      setTranscription(text);
      setShowTutorial(false);
      await saveTextToFile(text, 'transcript');
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
    if (!GROQ_API_KEY) {
      alertRef.show({ title: t('common.error') || 'Error', message: t('common.errors.groqApiKeyMissing'), type: 'error' });
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
        <Text style={[styles.headerTitle, { flex: 1, textAlign: 'center' }]} numberOfLines={1}>
          {recordingTitle}
        </Text>
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
        onSuccess={(deckId) => {
          alertRef.show({
            title: t('flashcards.generate.success'),
            message: t('flashcards.generate.success'),
            type: 'success',
          });
        }}
        content={summary || transcription || ''}
        contentType="recording"
        title={recordingData?.name || 'Recording'}
        subjectId={selectedSubjectId || 0}
        userId={recordingData?.user_id || 0}
      />
    </View>
  );
};
