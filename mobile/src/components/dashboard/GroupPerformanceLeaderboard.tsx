import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { globalStyles } from '../../styles/globalStyles';
import { dashboardStyles as styles } from '../../styles/Dashboard.styles';
import { getGroupLeaderboard } from '../../services/api/learning/groups';
import type { LeaderboardEntry } from '../../services/api/learning/groups';

interface Props {
  groupPinId: string;
  currentUserId: string;
}

const RANK_ICONS: Record<number, { name: keyof typeof Ionicons.glyphMap; color: string }> = {
  1: { name: 'trophy', color: '#FFD700' },
  2: { name: 'medal', color: '#C0C0C0' },
  3: { name: 'medal', color: '#CD7F32' },
};

const avatarSize = 28;

function getAvatarUri(entry: LeaderboardEntry): string {
  if (entry.profileImage) return entry.profileImage;
  const name = encodeURIComponent(entry.displayName || entry.username || 'User');
  return `https://ui-avatars.com/api/?name=${name}&background=EDEEF2&color=111111&bold=true`;
}

export const GroupPerformanceLeaderboard: React.FC<Props> = ({ groupPinId, currentUserId }) => {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getGroupLeaderboard(groupPinId);
      setEntries(data);
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [groupPinId]);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  if (loading) {
    return (
      <View style={styles.section}>
        <View style={[globalStyles.rowBetweenCenter, globalStyles.mb12]}>
          <Text style={styles.sectionTitle}>{t('dashboard.performance')}</Text>
        </View>
        <ActivityIndicator size="small" color="#999" />
      </View>
    );
  }

  if (entries.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={[globalStyles.rowBetweenCenter, globalStyles.mb12]}>
        <Text style={styles.sectionTitle}>{t('dashboard.performance')}</Text>
        <View style={styles.allChip}><Text style={styles.allChipText}>{t('dashboard.filterAll')}</Text></View>
      </View>

      <View style={styles.perfContainer}>
        {entries.map((entry, index) => {
          const rank = index + 1;
          const isYou = entry.userId === currentUserId;
          const icon = RANK_ICONS[rank] || { name: 'footsteps', color: '#888' };

          return (
            <View key={entry.userId} style={[styles.perfRow, isYou && styles.perfRowYou]}>
              <Text style={styles.perfRank}>#{rank}</Text>
              <View style={styles.perfUser}>
                <Ionicons name={icon.name as any} size={20} color={icon.color} style={{ marginRight: 8 }} />
                <Text style={[styles.perfName, isYou && { fontWeight: '600' }]}>
                  {entry.displayName || entry.username}
                </Text>
              </View>
              <Text style={styles.perfGpa}>{t('dashboard.gpa').substring(0, 4)} {entry.gpa.toFixed(2)}</Text>
              <Image
                source={{ uri: getAvatarUri(entry) }}
                style={{
                  width: avatarSize,
                  height: avatarSize,
                  borderRadius: avatarSize / 2,
                  borderWidth: 1.5,
                  borderColor: isYou ? '#6C63FF' : '#E0E0E0',
                  marginLeft: 8,
                }}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
};
