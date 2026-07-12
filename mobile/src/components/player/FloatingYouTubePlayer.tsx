import React, { useCallback, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Dimensions, Linking } from 'react-native';
import YoutubeIframe, { YoutubeIframeRef } from 'react-native-youtube-iframe';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { usePlayerStore } from '../../store/usePlayerStore';
import { MediaPlaybackService } from '../../services/media/MediaPlaybackService';
import { styles, PLAYER_WIDTH, PLAYER_HEIGHT } from '../../styles/FloatingYouTubePlayer.styles';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const FloatingYouTubePlayer = () => {
  const {
    provider, mediaId, listId, isVisible, isPlaying,
    setPlaying, closePlayer, onVideoEnd,
    mediaTitle, setMediaTitle, courseId,
  } = usePlayerStore();

  const playerRef = useRef<YoutubeIframeRef>(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (provider !== 'youtube' || !mediaId) return;
    fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${mediaId}&format=json`)
      .then(res => res.json())
      .then(data => { if (data?.title) setMediaTitle(data.title); })
      .catch(() => {});
  }, [mediaId, provider, setMediaTitle]);

  const translateX = useSharedValue(SCREEN_WIDTH - PLAYER_WIDTH - 20);
  const translateY = useSharedValue(-PLAYER_HEIGHT - 100);

  useEffect(() => {
    translateY.value = SCREEN_HEIGHT - PLAYER_HEIGHT - insets.bottom - 100;
  }, [insets.bottom]);

  const captureCurrentVideo = useCallback(async () => {
    if (!playerRef.current || !courseId || provider !== 'youtube') return;
    try {
      const url = await playerRef.current.getVideoUrl();
      if (!url) return;
      const match = url.match(/[?&]v=([a-zA-Z0-9_-]+)/);
      const currentId = match?.[1];
      if (currentId) {
        MediaPlaybackService.onMediaChanged(provider, courseId, currentId, listId);
      }
    } catch {}
  }, [courseId, mediaId, listId, provider]);

  const handleStateChange = useCallback((state: string) => {
    if (state === 'playing') {
      setPlaying(true);
      captureCurrentVideo();
    }
    if (state === 'paused') {
      setPlaying(false);
      captureCurrentVideo();
    }
    if (state === 'ended') {
      setPlaying(false);
      captureCurrentVideo();
      if (onVideoEnd) onVideoEnd();
    }
  }, [setPlaying, captureCurrentVideo, onVideoEnd]);

  const dragGesture = Gesture.Pan()
    .onChange((event) => {
      'worklet';
      translateX.value += event.changeX;
      translateY.value += event.changeY;
    })
    .onEnd(() => {
      'worklet';
      const isLeft = translateX.value < (SCREEN_WIDTH - PLAYER_WIDTH) / 2;
      translateX.value = withSpring(isLeft ? 16 : SCREEN_WIDTH - PLAYER_WIDTH - 16, { damping: 18, stiffness: 180 });
      const minY = insets.top + 50;
      const maxY = SCREEN_HEIGHT - PLAYER_HEIGHT - insets.bottom - 80;
      if (translateY.value < minY) translateY.value = withSpring(minY, { damping: 18 });
      else if (translateY.value > maxY) translateY.value = withSpring(maxY, { damping: 18 });
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
  }));

  const handleClose = useCallback(async () => {
    await captureCurrentVideo();
    closePlayer();
  }, [captureCurrentVideo, closePlayer]);

  const openExternally = useCallback(async () => {
    await captureCurrentVideo();
    closePlayer();
    if (provider) {
      MediaPlaybackService.openExternally(provider, mediaId, listId);
    }
  }, [provider, mediaId, listId, captureCurrentVideo, closePlayer]);

  if (!isVisible || provider !== 'youtube' || (!mediaId && !listId)) return null;

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <View style={styles.accentBar} />

      <GestureDetector gesture={dragGesture}>
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <View style={styles.badge}>
              <Ionicons name="logo-youtube" size={11} color="#FF0000" />
              <Text style={styles.badgeText}>YouTube</Text>
            </View>
            <Text style={styles.title} numberOfLines={1}>
              {mediaTitle || (isPlaying ? 'Reproduciendo…' : 'En pausa')}
            </Text>
          </View>
          <View style={styles.actions}>
            <TouchableOpacity
              onPress={openExternally}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={styles.iconBtn}
            >
              <Ionicons name="arrow-redo-outline" size={16} color="#A8A8AC" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleClose}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={styles.iconBtn}
            >
              <Ionicons name="close" size={18} color="#A8A8AC" />
            </TouchableOpacity>
          </View>
        </View>
      </GestureDetector>

      <View style={styles.playerWrapper}>
        <YoutubeIframe
          ref={playerRef}
          height={PLAYER_HEIGHT}
          width={PLAYER_WIDTH}
          play={isPlaying}
          videoId={mediaId || undefined}
          playList={!mediaId && listId ? listId : undefined}
          initialPlayerParams={listId ? { list: listId, listType: 'playlist' } : undefined}
          onChangeState={handleStateChange}
          webViewStyle={{ opacity: 0.99 }}
        />
      </View>
    </Animated.View>
  );
};
