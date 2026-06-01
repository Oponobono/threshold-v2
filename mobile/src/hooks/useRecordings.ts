import { useEffect, useRef, useState, useCallback } from 'react';
import { Animated, Easing, TextInput, InteractionManager } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useRecordingsManager } from './useRecordingsManager';
import type { GridMediaItem } from '../components/recordings/RecordingsGrid';

export function useRecordings() {
  const router = useRouter();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const meterAnim = useRef(new Animated.Value(0)).current;
  const searchAnim = useRef(new Animated.Value(0)).current;
  const searchInputRef = useRef<TextInput>(null) as React.RefObject<TextInput>;

  const [showYoutubeModal, setShowYoutubeModal] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);

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
    handleDeleteItem,
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
    cleanupAudio,
  } = audioContext;

  // Stop audio when leaving the screen
  useFocusEffect(
    useCallback(() => {
      return () => { cleanupAudio(); };
    }, [cleanupAudio]),
  );

  // Load data on focus
  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        loadYouTubeVideos();
        loadRecordings();
      });
      return () => task.cancel();
    }, [loadRecordings, loadYouTubeVideos]),
  );

  // Pulse animation for recording indicator
  const startPulse = useCallback(() => {
    pulseAnim.setValue(1);
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [pulseAnim]);

  const stopPulse = useCallback(() => {
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
  }, [pulseAnim]);

  useEffect(() => {
    if (isRecording && !isPaused) startPulse();
    else stopPulse();
  }, [isRecording, isPaused, startPulse, stopPulse]);

  // Meter animation
  useEffect(() => {
    const normalised = Math.max(0, Math.min(1, (meteringDb + 60) / 60));
    Animated.timing(meterAnim, {
      toValue: normalised, duration: 80, useNativeDriver: false,
    }).start();
  }, [meteringDb, meterAnim]);

  // Reload recordings after recording stops
  const prevIsRecording = useRef(isRecording);
  useEffect(() => {
    if (prevIsRecording.current === true && isRecording === false) {
      setTimeout(() => loadRecordings(), 800);
    }
    prevIsRecording.current = isRecording;
  }, [isRecording, loadRecordings]);

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

  const handlePressItem = useCallback(
    (item: GridMediaItem) => {
      if (!item.id) {
        console.warn('[useRecordings] Item sin ID válido:', item);
        return;
      }
      if (item.type === 'video') {
        router.push(`/recordings/${item.id}?type=video` as any);
      } else {
        router.push(`/recordings/${encodeURIComponent(item.id)}?type=recording` as any);
      }
    },
    [router],
  );

  const onAddYouTubeVideo = async () => {
    try {
      await handleAddYoutube(youtubeUrl);
      setShowYoutubeModal(false);
      setYoutubeUrl('');
    } catch (e: any) {
      alert(`Error al agregar el video: ${e.message}`);
    }
  };

  return {
    showYoutubeModal, youtubeUrl, showSearch, showFilterModal,
    searchAnim, searchInputRef, pulseAnim, meterAnim,
    isLoadingVideos, isAddingYouTubeVideo, youTubeVideos, recordings,
    searchQuery, setSearchQuery, activeFilter, setActiveFilter,
    sortOrder, setSortOrder, dateFilter, setDateFilter,
    sections, playingId, playSound, stopSound,
    isRecording, isPaused, recordingDuration,
    startRecording, pauseRecording, resumeRecording, stopRecording,
    formatDuration,
    setShowYoutubeModal, setYoutubeUrl, setShowFilterModal,
    onAddYouTubeVideo, toggleSearch, handlePressItem, handleDeleteItem,
  };
}
