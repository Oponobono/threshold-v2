import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { globalStyles } from '../../styles/globalStyles';
import { dashboardStyles as styles } from '../../styles/Dashboard.styles';
import { groupLeaderboardCache, LeaderboardState, LeaderboardEntry } from '../../services/domain/GroupLeaderboardCache';

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
  const [state, setState] = useState<LeaderboardState>({ status: 'idle' });

  useEffect(() => {
    // Cache-first: carga snapshot inmediatamente
    groupLeaderboardCache.load(groupPinId).then(setState);
    // Background refresh sin bloquear render
    groupLeaderboardCache.refresh(groupPinId).then(setState);
  }, [groupPinId]);

  if (state.status === 'idle' || state.status === 'loading') {
    return (
      <View style={styles.section}>
        <View style={[globalStyles.rowBetweenCenter, globalStyles.mb12]}>
          <Text style={styles.sectionTitle}>{t('dashboard.performance')}</Text>
        </View>
        <ActivityIndicator size="small" color="#999" />
      </View>
    );
  }

  if (state.status === 'unavailable') {
    return (
      <View style={styles.section}>
        <View style={[globalStyles.rowBetweenCenter, globalStyles.mb12]}>
          <Text style={styles.sectionTitle}>{t('dashboard.performance')}</Text>
        </View>
        <Text style={{ color: '#888', fontStyle: 'italic' }}>
          No hay datos disponibles del grupo.
        </Text>
      </View>
    );
  }

  const { snapshot } = state;
  if (snapshot.entries.length === 0) {
    return (
      <View style={styles.section}>
        <View style={[globalStyles.rowBetweenCenter, globalStyles.mb12]}>
          <Text style={styles.sectionTitle}>{t('dashboard.performance')}</Text>
        </View>
        <Text style={{ color: '#888', fontStyle: 'italic' }}>
          El grupo no tiene miembros o no se ha reportado rendimiento.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <View style={[globalStyles.rowBetweenCenter, globalStyles.mb12]}>
        <Text style={styles.sectionTitle}>{t('dashboard.performance')}</Text>
        <View style={styles.allChip}><Text style={styles.allChipText}>{t('dashboard.filterAll')}</Text></View>
      </View>

      <View style={styles.perfContainer}>
        {snapshot.entries.map((entry, index) => {
          const rank = index + 1;
          const isYou = (entry.userId || entry.user_id) === currentUserId;
          const icon = RANK_ICONS[rank] || { name: 'footsteps', color: '#888' };

          return (
            <View key={entry.userId || entry.user_id} style={[styles.perfRow, isYou && styles.perfRowYou]}>
              <Text style={styles.perfRank}>#{rank}</Text>
              <View style={styles.perfUser}>
                <Ionicons name={icon.name as any} size={20} color={icon.color} style={{ marginRight: 8 }} />
                <View>
                  <Text style={[styles.perfName, isYou && { fontWeight: '600' }]}>
                    {entry.displayName || entry.username}
                  </Text>
                  {state.status === 'stale' && isYou && (
                    <Text style={{ fontSize: 10, color: '#aaa' }}>{t('offline')}</Text>
                  )}
                </View>
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
