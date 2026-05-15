import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
  StatusBar,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../src/styles/theme';
import { recordingsStyles as styles } from '../src/styles/RecordingsScreen.styles';

import { PremiumLoading } from '../src/components/PremiumLoading';
import { RecordingsGrid, GridMediaItem } from '../src/components/RecordingsGrid';
import { YouTubeAddModal } from '../src/components/YouTubeAddModal';
import { FilterSortModal } from '../src/components/FilterSortModal';
import { AudioRecorderBottomBar } from '../src/components/AudioRecorderBottomBar';
import { useRecordingsManager } from '../src/hooks/useRecordingsManager';
import { AutoUploadIndicator } from '../src/components/AutoUploadIndicator';


/**
 * Pantalla principal de Grabaciones y Multimedia (RecordingsScreen)
 *
 * Agrupa y muestra en una cuadrícula (grid) los audios grabados en la app
 * y los videos de YouTube guardados. Gestiona la barra de grabación flotante,
 * la búsqueda, filtros, ordenamiento y la sincronización con la API.
 */
export default function RecordingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const [showYoutubeModal, setShowYoutubeModal] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  
  const searchAnim = useRef(new Animated.Value(0)).current;
  const searchInputRef = useRef<TextInput>(null);

  const {
    audioContext,
    youTubeVideos,
    isLoadingVideos,
    isAddingYouTubeVideo,
    searchQuery,
    setSearchQuery,
    activeFilter,
    setActiveFilter,
    sortOrder,
    setSortOrder,
    dateFilter,
    setDateFilter,
    sections,
    loadYouTubeVideos,
    loadRecordings,
    handleAddYoutube,
    handleDeleteItem
  } = useRecordingsManager();

  const {
    isRecording,
    isPaused,
    recordings,
    recordingDuration,
    meteringDb,
    playingId,
    startRecording,
    pauseRecording,
    resumeRecording,
    stopRecording,
    playSound,
    stopSound,
    formatDuration,
  } = audioContext;

  /**
   * Alterna la visibilidad de la barra de búsqueda con una animación de rebote (spring).
   * Al abrirse, enfoca automáticamente el input; al cerrarse, limpia la búsqueda actual.
   */
  const toggleSearch = () => {
    const opening = !showSearch;
    setShowSearch(opening);
    Animated.spring(searchAnim, {
      toValue: opening ? 1 : 0,
      useNativeDriver: false,
      bounciness: 4,
    }).start();
    if (opening) {
      setTimeout(() => searchInputRef.current?.focus(), 150);
    } else {
      setSearchQuery('');
    }
  };

  /**
   * Efecto para animar el medidor de decibeles de manera fluida.
   * Interpola el valor de decibeles (-160 a 0) hacia un valor normalizado (0 a 1).
   */
  const meterAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const normalised = Math.max(0, Math.min(1, (meteringDb + 60) / 60));
    Animated.timing(meterAnim, {
      toValue: normalised,
      duration: 80,
      useNativeDriver: false,
    }).start();
  }, [meteringDb, meterAnim]);



  useFocusEffect(
    useCallback(() => {
      loadYouTubeVideos();
      loadRecordings();
    }, [loadRecordings, loadYouTubeVideos])
  );

  /**
   * Inicia la animación de pulso infinito (agrandar y encoger) 
   * utilizada para el indicador visual rojo durante la grabación activa.
   */
  const startPulse = useCallback(() => {
    pulseAnim.setValue(1);
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [pulseAnim]);

  /**
   * Detiene la animación de pulso y reinicia el valor a su estado inicial.
   */
  const stopPulse = useCallback(() => {
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
  }, [pulseAnim]);

  useEffect(() => {
    if (isRecording && !isPaused) startPulse();
    else stopPulse();
  }, [isRecording, isPaused, startPulse, stopPulse]);

  const prevIsRecording = useRef(isRecording);
  useEffect(() => {
    if (prevIsRecording.current === true && isRecording === false) {
      setTimeout(() => loadRecordings(), 800);
    }
    prevIsRecording.current = isRecording;
  }, [isRecording, loadRecordings]);

  /**
   * Maneja el evento de presión sobre un ítem de la cuadrícula multimedia.
   * Navega a la pantalla de detalle correspondiente según si es un video de YouTube o un audio.
   * 
   * @param {GridMediaItem} item - El elemento multimedia seleccionado (audio o video).
   */
  const handlePressItem = useCallback(
    (item: GridMediaItem) => {
      if (!item.id) {
        console.warn('[recordings.tsx] Item sin ID válido:', item);
        return;
      }

      if (item.type === 'video') {
        router.push(`/recordings/${item.id}?type=video` as any);
      } else {
        router.push(
          `/recordings/${encodeURIComponent(item.id)}?type=recording` as any
        );
      }
    },
    [router]
  );

  /**
   * Orquesta el flujo de agregar un video de YouTube llamando al administrador de grabaciones
   * y controlando el estado del modal (cerrarlo y limpiar el input).
   */
  const onAddYouTubeVideo = async () => {
    try {
      await handleAddYoutube(youtubeUrl);
      setShowYoutubeModal(false);
      setYoutubeUrl('');
    } catch (e: any) {
      alert(`Error al agregar el video: ${e.message}`);
    }
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (isLoadingVideos && youTubeVideos.length === 0 && recordings.length === 0) {
    return <PremiumLoading text={t('recordings.loadingList') || 'CARGANDO'} />;
  }

  const isEmpty = sections.length === 0;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { flex: 1 }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar
        barStyle="dark-content"
        backgroundColor={theme.colors.card}
        translucent={false}
      />

      {/* Safe-area top */}
      <View style={{ height: insets.top, backgroundColor: theme.colors.card }} />

      {/* Header */}
      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {t('recordings.multimedia')}
        </Text>
        {/* Right actions: Search · YouTube */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <TouchableOpacity
            style={[
              styles.backBtn,
              showSearch && {
                backgroundColor: `${theme.colors.primary}12`,
                borderRadius: 20,
              },
            ]}
            onPress={toggleSearch}
          >
            <Ionicons
              name={showSearch ? 'search' : 'search-outline'}
              size={22}
              color={showSearch ? theme.colors.primary : theme.colors.text.primary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => setShowYoutubeModal(true)}
          >
            <MaterialCommunityIcons name="youtube" size={26} color={theme.colors.text.error} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => setShowFilterModal(true)}
          >
            <Ionicons
              name={dateFilter !== 'all' || sortOrder === 'asc' ? 'filter' : 'filter-outline'}
              size={22}
              color={theme.colors.text.primary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Collapsible search bar ─────────────────────────────────────── */}
      <Animated.View
        style={{
          overflow: 'hidden',
          maxHeight: searchAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 56],
          }),
          opacity: searchAnim,
          backgroundColor: theme.colors.card,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
          paddingHorizontal: theme.spacing.lg,
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.colors.background,
            borderRadius: 14,
            paddingHorizontal: 12,
            height: 40,
            gap: 8,
            borderWidth: 1,
            borderColor: theme.colors.border,
          }}
        >
          <Ionicons name="search" size={16} color={theme.colors.text.placeholder} />
          <TextInput
            ref={searchInputRef}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('recordings.searchPlaceholder')}
            placeholderTextColor={theme.colors.text.placeholder}
            style={{ flex: 1, fontSize: 14, color: theme.colors.text.primary, paddingVertical: 0 }}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color={theme.colors.text.placeholder} />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      {/* ── Filter pills (match AI modal chip style) ─────────────────── */}
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: theme.colors.card,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: 10,
          gap: 8,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
          alignItems: 'center',
        }}
      >
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(['all', 'recording', 'video'] as const).map((f) => {
            const labels = {
              all:       t('recordings.filterAll'),
              recording: t('recordings.filterAudio'),
              video:     t('recordings.filterVideo'),
            };
            const icons = {
              all:       'layers-outline'       as const,
              recording: 'mic-outline'          as const,
              video:     'logo-youtube'         as const,
            };
            const isActive = activeFilter === f;
            return (
              <TouchableOpacity
                key={f}
                onPress={() => setActiveFilter(f)}
                activeOpacity={0.72}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                  paddingHorizontal: 13,
                  paddingVertical: 7,
                  borderRadius: 20,
                  borderWidth: 1.5,
                  borderColor: isActive
                  ? theme.colors.text.primary
                  : theme.colors.border,
                backgroundColor: isActive
                  ? theme.colors.text.primary
                  : 'transparent',
              }}
            >
              <Ionicons
                name={icons[f]}
                size={13}
                color={isActive ? theme.colors.white : theme.colors.text.secondary}
              />
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: isActive ? '700' : '500',
                  color: isActive ? theme.colors.white : theme.colors.text.secondary,
                  letterSpacing: -0.1,
                }}
              >
                {labels[f]}
              </Text>
            </TouchableOpacity>
          );
        })}
        </View>
        <View style={{ flex: 1 }} />
        <AutoUploadIndicator size={18} />
      </View>


      {/* Main scrollable content */}
      <ScrollView
        contentContainerStyle={[styles.listContent, { paddingBottom: 120 }]}
        showsVerticalScrollIndicator={false}
      >
        {isEmpty ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons
              name="microphone-off"
              size={64}
              color={theme.colors.border}
            />
            <Text style={styles.emptyText}>
              {t('dashboard.audioRecorderModal.emptyState')}
            </Text>
          </View>
        ) : (
          <RecordingsGrid
            sections={sections}
            playingId={playingId}
            onPlay={playSound}
            onStop={stopSound}
            onDelete={handleDeleteItem}
            onPress={handlePressItem}
          />
        )}
      </ScrollView>

      {/* ── FILTER & SORT MODAL ─────────────────────────────────────────── */}
      <FilterSortModal
        visible={showFilterModal}
        sortOrder={sortOrder}
        dateFilter={dateFilter}
        onSortChange={setSortOrder}
        onFilterChange={setDateFilter}
        onClose={() => setShowFilterModal(false)}
      />

      <YouTubeAddModal
        visible={showYoutubeModal}
        youtubeUrl={youtubeUrl}
        isAdding={isAddingYouTubeVideo}
        onUrlChange={setYoutubeUrl}
        onCancel={() => {
          setShowYoutubeModal(false);
          setYoutubeUrl('');
        }}
        onAdd={onAddYouTubeVideo}
      />

      <AudioRecorderBottomBar
        isRecording={isRecording}
        isPaused={isPaused}
        recordingDuration={recordingDuration}
        formatDuration={formatDuration}
        pulseAnim={pulseAnim}
        meterAnim={meterAnim}
        insetsBottom={insets.bottom}
        onStart={startRecording}
        onPause={pauseRecording}
        onResume={resumeRecording}
        onStop={stopRecording}
      />
    </View>
  );
}
