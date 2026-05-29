import React, { useMemo } from 'react';
import { View, Text, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { globalStyles } from '../../src/styles/globalStyles';
import { theme } from '../../src/styles/theme';
import { subjectsStyles as styles } from '../../src/styles/Subjects.styles';
import { AutoUploadIndicator } from '../../src/components/ui/AutoUploadIndicator';
import { ExplanationOverlay } from '../../src/components/evaluation/ExplanationOverlay';
import { useSubjects } from '../../src/hooks/useSubjects';
import { SubjectIcon } from '../../src/components/subjects/SubjectIcon';
import { ScheduleGrid } from '../../src/components/subjects/ScheduleGrid';
import { SCALE_MAX } from '../../src/utils/grades';

export default function SubjectsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const g = useSubjects(t);

  const overallGpa = useMemo(() => {
    if (g.subjects.length === 0) return 0;
    const sum = g.subjects.reduce((acc, s) => {
      const raw = s.avg_score ?? 0;
      return acc + (raw > SCALE_MAX * 2 ? (raw / 100) * SCALE_MAX : raw);
    }, 0);
    return sum / g.subjects.length;
  }, [g.subjects]);

  const approvedCount = useMemo(() => {
    return g.subjects.filter(s => {
      const raw = s.avg_score ?? 0;
      const avg = raw > SCALE_MAX * 2 ? (raw / 100) * SCALE_MAX : raw;
      return avg >= 3.0;
    }).length;
  }, [g.subjects]);

  const atRiskCount = useMemo(() => {
    return g.subjects.length - approvedCount;
  }, [g.subjects, approvedCount]);

  const semesterMessage = useMemo(() => {
    if (g.criticalSubjects.length === 0) return t('subjects.semesterMessageGood');
    if (g.criticalSubjects.length === 1) return t('subjects.semesterMessageRisk', { subject: g.criticalSubjects[0].name });
    return t('subjects.semesterMessageMultipleRisk', { count: g.criticalSubjects.length });
  }, [g.criticalSubjects, t]);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={globalStyles.safeArea}>
      <View style={styles.header}>
        <View style={globalStyles.row}>
          <Ionicons name="book-outline" size={20} color={theme.colors.primary} style={globalStyles.mr8} />
          <Text style={styles.headerTitle}>{t('subjects.title') || 'Materias'}</Text>
          <AutoUploadIndicator size={18} />
        </View>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={theme.colors.text.secondary} />
          <TextInput
            style={styles.searchInput}
            placeholder={t('subjects.searchPlaceholder')}
            placeholderTextColor={theme.colors.text.secondary}
            value={g.search}
            onChangeText={g.setSearch}
          />
        </View>
        <TouchableOpacity style={styles.filterBtn}>
          <Feather name="sliders" size={18} color={theme.colors.text.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {g.subjects.length > 0 && (
          <>
            <View style={styles.semesterHero}>
              <View style={styles.semesterHeroTop}>
                <View style={styles.semesterGpaCircle}>
                  <Text style={styles.semesterGpaValue}>{overallGpa.toFixed(1)}</Text>
                  <Text style={styles.semesterGpaLabel}>{t('subjects.semesterGpa')}</Text>
                </View>
                <View style={styles.semesterHeroStats}>
                  <View style={styles.semesterHeroStatRow}>
                    <Text style={styles.semesterHeroStatLabel}>{t('subjects.totalSubjects')}</Text>
                    <Text style={styles.semesterHeroStatValue}>{g.subjects.length}</Text>
                  </View>
                  <View style={styles.semesterHeroStatRow}>
                    <Text style={styles.semesterHeroStatLabel}>{t('subjects.semesterCredits', 'Créditos')}</Text>
                    <Text style={styles.semesterHeroStatValue}>{g.totalCredits}</Text>
                  </View>
                  <View style={styles.semesterHeroStatRow}>
                    <Text style={styles.semesterHeroStatLabel}>{t('subjects.semesterApproved')}</Text>
                    <Text style={styles.semesterHeroStatValue}>{approvedCount}</Text>
                  </View>
                  <View style={styles.semesterHeroStatRow}>
                    <Text style={styles.semesterHeroStatLabel}>{t('subjects.semesterAtRisk')}</Text>
                    <Text style={[styles.semesterHeroStatValue, atRiskCount > 0 && styles.semesterHeroStatValueDanger]}>
                      {atRiskCount}
                    </Text>
                  </View>
                </View>
              </View>
              <Text style={styles.semesterMessage}>
                <Text style={styles.semesterMessageHighlight}>{semesterMessage}</Text>
              </Text>
            </View>

            {g.criticalSubjects.length > 0 && (
              <View style={styles.criticalSection}>
                <View style={styles.criticalHeader}>
                  <Text style={styles.criticalTitle}>{t('subjects.attentionNeededTitle')}</Text>
                  <View style={styles.criticalBadge}>
                    <Text style={styles.criticalBadgeText}>{g.criticalSubjects.length}</Text>
                  </View>
                </View>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.criticalScroll}
                >
                  {g.criticalSubjects.map((subject, idx) => {
                    const raw = subject.avg_score ?? 0;
                    const avg = raw > SCALE_MAX * 2 ? (raw / 100) * SCALE_MAX : raw;
                    const target = subject.target_grade ?? 3.0;
                    const delta = avg - target;
                    const color = subject.color || '#FF2D55';

                    return (
                      <TouchableOpacity
                        key={subject.id || idx}
                        style={styles.criticalCard}
                        activeOpacity={0.7}
                        onPress={() => router.push(`/subjects/${subject.id}`)}
                      >
                        <View style={styles.criticalCardTop}>
                          <View style={[styles.criticalCardDot, { backgroundColor: color }]} />
                          <Text style={styles.criticalCardName} numberOfLines={1}>{subject.name}</Text>
                        </View>
                        <Text style={styles.criticalCardScore}>{avg.toFixed(1)}</Text>
                        <Text style={styles.criticalCardDelta}>
                          {delta >= 0 ? '+' : ''}{delta.toFixed(2)} {t('subjects.semesterGpa')}
                        </Text>
                        <View style={styles.criticalCardAction}>
                          <Text style={styles.criticalCardActionText}>{t('subjects.reviewAction')}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {g.recentActivity.length > 0 && (
              <View style={styles.timelineSection}>
                <View style={styles.timelineHeader}>
                  <Text style={styles.timelineTitle}>{t('subjects.recentActivityTitle')}</Text>
                </View>
                <View style={styles.timelineCard}>
                  {g.recentActivity.map((item, idx, arr) => (
                    <View key={item.id || idx} style={[styles.timelineItem, idx < arr.length - 1 && { position: 'relative' }]}>
                      <View style={[styles.timelineDot, { backgroundColor: item.subjectColor }]} />
                      {idx < arr.length - 1 && <View style={styles.timelineLine} />}
                      <View style={styles.timelineContent}>
                        <Text style={styles.timelineName} numberOfLines={1}>
                          {item.name || t('subjects.noAssessments')}
                        </Text>
                        <Text style={styles.timelineMeta}>{item.subjectName}</Text>
                      </View>
                      <Text style={styles.timelineTime}>{item.relativeTime}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <ScheduleGrid />
          </>
        )}

        {g.filteredSubjects.length === 0 ? (
          <View style={[globalStyles.center, { paddingVertical: 60 }]}>
            <MaterialCommunityIcons name="book-open-variant" size={48} color="rgba(255,255,255,0.1)" />
            <Text style={[{ color: theme.colors.text.secondary }, globalStyles.mt16]}>
              {g.search ? t('subjects.noResults', 'Sin resultados') : t('subjects.noSubjects', 'No hay materias')}
            </Text>
          </View>
        ) : (
          <View style={styles.gridSection}>
            <View style={styles.gridHeader}>
              <Text style={styles.gridTitle}>{t('subjects.enrolledSubjects')}</Text>
              <Text style={styles.gridCount}>{g.filteredSubjects.length} {t('subjects.items')}</Text>
            </View>
            <View style={styles.grid}>
              {g.filteredSubjects.map((subject, index) => {
                const raw = subject.avg_score ?? 0;
                const avgScore = raw > SCALE_MAX * 2 ? (raw / 100) * SCALE_MAX : raw;
                const target = subject.target_grade ?? 3.0;
                const delta = avgScore - target;
                const isPositive = delta >= 0;
                const cardColor = subject.color || '#5856D6';
                const isLow = avgScore < 3.0;

                return (
                  <View key={subject.id || index} style={styles.gridCol}>
                    <TouchableOpacity
                      style={styles.gridCard}
                      activeOpacity={0.7}
                      onPress={() => router.push(`/subjects/${subject.id}`)}
                    >
                      <View style={styles.gridTopRow}>
                        <View style={[styles.gridIcon, { backgroundColor: cardColor + '18' }]}>
                          <SubjectIcon iconName={subject.icon} color={cardColor} size={18} />
                        </View>

                        <View style={styles.gridScoreGroup}>
                          <View style={styles.gridScoreRow}>
                            <Text style={[styles.gridScore, { color: isLow ? theme.colors.danger : theme.colors.text.primary }]}>
                              {avgScore.toFixed(1)}
                            </Text>
                            <Text style={styles.gridScoreMax}>/5.0</Text>
                          </View>
                          <View style={styles.gridDelta}>
                            <Ionicons
                              name={isPositive ? 'arrow-up' : 'arrow-down'}
                              size={10}
                              color={isPositive ? theme.colors.success : theme.colors.danger}
                            />
                            <Text style={[styles.gridDeltaText, { color: isPositive ? theme.colors.success : theme.colors.danger }]}>
                              {isPositive ? '+' : ''}{delta.toFixed(2)}
                            </Text>
                          </View>
                        </View>
                      </View>

                      <View style={styles.gridBody}>
                        <Text style={styles.gridName} numberOfLines={1}>{subject.name}</Text>
                        {subject.professor && (
                          <Text style={styles.gridProf} numberOfLines={1}>{subject.professor}</Text>
                        )}
                      </View>

                      <View style={styles.gridMetaRow}>
                        {subject.credits ? (
                          <View style={styles.gridMetaBadge}>
                            <Text style={styles.gridMetaBadgeText}>{subject.credits} {t('subjects.credits')}</Text>
                          </View>
                        ) : null}
                        <Text style={styles.gridTargetText}>{t('subjects.requiredPass')}: {target.toFixed(1)}</Text>
                      </View>

                      <View style={styles.gridProgress}>
                        <View style={styles.gridProgressTrack}>
                          <View style={[styles.gridProgressFill, {
                            width: `${Math.min(subject.completion_percent ?? 0, 100)}%`,
                            backgroundColor: isLow ? theme.colors.danger : cardColor,
                          }]} />
                        </View>
                        <Text style={styles.gridProgressText}>
                          {Math.round(subject.completion_percent ?? 0)}%
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>

      <ExplanationOverlay
        visible={g.overlayVisible}
        explanation={g.overlayText}
        onDismiss={() => g.setOverlayVisible(false)}
      />
    </SafeAreaView>
  );
}
