import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { YouTubeVideo } from '../../services/api/types';
import { theme } from '../../styles/theme';
import { subjectDetailStyles as styles } from '../../styles/SubjectDetail.styles';

interface SubjectYouTubeVideosProps {
  videos: YouTubeVideo[];
  onDeleteVideo: (videoId: number | string) => void;
}

/**
 * Componente que muestra la lista de videos de YouTube recientes asociados a la materia.
 * Permite la navegación al reproductor/transcripción y la eliminación del enlace.
 */
export const SubjectYouTubeVideos: React.FC<SubjectYouTubeVideosProps> = ({ videos, onDeleteVideo }) => {
  const { t } = useTranslation();
  const router = useRouter();

  if (videos.length === 0) return null;

  return (
    <View style={styles.sectionBlock}>
      <View style={styles.sectionHeaderRow}>
        <View>
          <Text style={styles.sectionTitle}>{t('youtube.subjectVideos')}</Text>
          <Text style={styles.sectionHint}>{t('youtube.savedVideos')}</Text>
        </View>
      </View>
      <View style={{ gap: 12 }}>
        {videos.map(video => (
          <TouchableOpacity
            key={video.id}
            onPress={() => router.push(`/recordings/${video.id}?type=video` as any)}
            style={{
              backgroundColor: theme.colors.card,
              borderRadius: 12,
              padding: 12,
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <MaterialCommunityIcons name="youtube" size={40} color={theme.colors.text.error} style={{ marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.colors.text.primary, fontWeight: '600', fontSize: 15 }} numberOfLines={2}>
                {video.title || t('youtube.videoDefault')}
              </Text>
              <Text style={{ color: theme.colors.text.secondary, fontSize: 13, marginTop: 2 }}>
                {video.created_at
                  ? new Date(video.created_at).toLocaleDateString()
                  : t('youtube.unknownDate')}
              </Text>
            </View>
            <TouchableOpacity
              onPress={(e) => { e.stopPropagation(); onDeleteVideo(video.id!); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ padding: 4 }}
            >
              <Ionicons name="trash-outline" size={20} color={theme.colors.text.secondary} />
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};
