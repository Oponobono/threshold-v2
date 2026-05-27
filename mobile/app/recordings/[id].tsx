import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { theme } from '../../src/styles/theme';
import { VideoDetail } from '../../src/components/ai/VideoDetail';
import { RecordingDetail } from '../../src/components/recordings/RecordingDetail';
import { getYouTubeVideos, getAudioRecordings } from '../../src/services/api';

// ---------------------------------------------------------------------------
// Screen - Router for recordings and videos
// ---------------------------------------------------------------------------
export default function RecordingDetailScreen() {
  const { id, type } = useLocalSearchParams<{ id: string; type?: string }>();
  const router = useRouter();
  const [contentType, setContentType] = useState<'recording' | 'video' | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Determine if this is a video or recording based on parameter or by searching
  useEffect(() => {
    determineContentType();
  }, [id, type]);

  const determineContentType = async () => {
    setIsLoading(true);
    try {
      // If type is explicitly provided, use it
      if (type === 'video') {
        setContentType('video');
        setIsLoading(false);
        return;
      }
      if (type === 'recording') {
        setContentType('recording');
        setIsLoading(false);
        return;
      }

      // Otherwise, search for the ID in both collections
      try {
        const videos = await getYouTubeVideos();
        const videoFound = videos.find(v => v.id?.toString() === id);
        if (videoFound) {
          setContentType('video');
          setIsLoading(false);
          return;
        }
      } catch (e) {
        console.warn('Error fetching videos:', e);
      }

      try {
        const recordings = await getAudioRecordings();
        const recordingFound = recordings.find(r =>
          r.id?.toString() === id ||
          r.local_uri.endsWith(id) ||
          r.local_uri.endsWith(`${id}.m4a`)
        );
        if (recordingFound) {
          setContentType('recording');
          setIsLoading(false);
          return;
        }
      } catch (e) {
        console.warn('Error fetching recordings:', e);
      }

      // Default to recording if not found
      setContentType('recording');
    } catch (e) {
      console.error('Error determining content type:', e);
      setContentType('recording');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading || !id || !contentType) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }}>
        <Stack.Screen options={{ headerShown: false }} />
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Stack.Screen options={{ headerShown: false }} />
      {contentType === 'video' ? (
        <VideoDetail videoId={id} onBack={() => router.back()} />
      ) : (
        <RecordingDetail recordingId={id} onBack={() => router.back()} />
      )}
    </View>
  );
}
