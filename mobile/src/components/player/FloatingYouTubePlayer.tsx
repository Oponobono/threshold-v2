import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Linking } from 'react-native';
import YoutubeIframe from 'react-native-youtube-iframe';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { usePlayerStore } from '../../store/usePlayerStore';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PLAYER_WIDTH = SCREEN_WIDTH * 0.75;
const PLAYER_HEIGHT = (PLAYER_WIDTH * 9) / 16; // 16:9 aspect ratio

export const FloatingYouTubePlayer = () => {
  const { videoId, isVisible, isPlaying, setPlaying, closePlayer, onVideoEnd, videoTitle, setVideoTitle } = usePlayerStore();
  const insets = useSafeAreaInsets();

  // Fetch video metadata when videoId changes
  React.useEffect(() => {
    if (videoId) {
      fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`)
        .then(res => res.json())
        .then(data => {
          if (data && data.title) {
            setVideoTitle(data.title);
          }
        })
        .catch(err => console.warn('Failed to fetch youtube metadata', err));
    }
  }, [videoId, setVideoTitle]);

  // Initialize off-screen; useEffect will position correctly once insets are available
  const translateX = useSharedValue(SCREEN_WIDTH - PLAYER_WIDTH - 20);
  const translateY = useSharedValue(-PLAYER_HEIGHT - 100); // off-screen until positioned

  // Set initial position after insets are available (avoids using hook values in shared value init)
  useEffect(() => {
    translateY.value = SCREEN_HEIGHT - PLAYER_HEIGHT - insets.bottom - 100;
  }, [insets.bottom]);

  const dragGesture = Gesture.Pan()
    .onChange((event) => {
      'worklet';
      translateX.value += event.changeX;
      translateY.value += event.changeY;
    })
    .onEnd(() => {
      'worklet';
      // Snap to left or right edge
      const isLeft = translateX.value < (SCREEN_WIDTH - PLAYER_WIDTH) / 2;
      translateX.value = withSpring(isLeft ? 20 : SCREEN_WIDTH - PLAYER_WIDTH - 20);

      // Keep within vertical bounds
      const minY = insets.top + 50;
      const maxY = SCREEN_HEIGHT - PLAYER_HEIGHT - insets.bottom - 80;

      if (translateY.value < minY) {
        translateY.value = withSpring(minY);
      } else if (translateY.value > maxY) {
        translateY.value = withSpring(maxY);
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  const openExternally = async () => {
    if (!videoId) return;
    closePlayer(); // Cerramos el reproductor interno
    
    const nativeUrl = `vnd.youtube:${videoId}`;
    const webUrl = `https://www.youtube.com/watch?v=${videoId}`;
    
    try {
      const canOpen = await Linking.canOpenURL(nativeUrl);
      if (canOpen) {
        await Linking.openURL(nativeUrl);
      } else {
        await Linking.openURL(webUrl);
      }
    } catch {
      await Linking.openURL(webUrl);
    }
  };

  if (!isVisible || !videoId) return null;

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      {/* Drag handle: only the bar area is draggable */}
      <GestureDetector gesture={dragGesture}>
        <View style={styles.dragHandle}>
          <Ionicons name="move" size={16} color="#ffffff80" />
          <Text style={styles.dragTitle} numberOfLines={1}>
            {videoTitle || 'YouTube'}
          </Text>
        </View>
      </GestureDetector>

      <View style={styles.actionsContainer}>
        <TouchableOpacity
          onPress={openExternally}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.actionButton}
        >
          <Ionicons name="open-outline" size={18} color="#fff" />
        </TouchableOpacity>
        
        <TouchableOpacity
          onPress={closePlayer}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.actionButton}
        >
          <Ionicons name="close-circle" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.playerWrapper}>
        <YoutubeIframe
          height={PLAYER_HEIGHT}
          width={PLAYER_WIDTH}
          play={isPlaying}
          videoId={videoId}
          onChangeState={(state: string) => {
            if (state === 'ended') {
              setPlaying(false);
              if (onVideoEnd) onVideoEnd();
            }
            if (state === 'playing') setPlaying(true);
            if (state === 'paused') setPlaying(false);
          }}
          webViewStyle={{ opacity: 0.99 }} // prevents android WebView blank-screen bug
        />
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: PLAYER_WIDTH,
    backgroundColor: '#000',
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    zIndex: 99999,
  },
  dragHandle: {
    height: 32,
    backgroundColor: '#1a1a1a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 12,
  },
  dragTitle: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
    marginLeft: 8,
    marginRight: 60, // Space for absolute buttons
  },
  actionsContainer: {
    position: 'absolute',
    top: 4,
    right: 8,
    zIndex: 100000, // above drag handle and video
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionButton: {
    // optional styling for hit slop space
  },
  playerWrapper: {
    width: PLAYER_WIDTH,
    height: PLAYER_HEIGHT,
  },
});
