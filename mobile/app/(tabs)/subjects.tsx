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
import { OfflineIndicator } from '../../src/components/ui/OfflineIndicator';
import { ExplanationOverlay } from '../../src/components/evaluation/ExplanationOverlay';
import { useSubjects, ACTIVITY_CONFIG } from '../../src/hooks/useSubjects';
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
        <View style={{ flex: 1 }}>
          <View style={globalStyles.row}>
            <Ionicons name="book-outline" size={20} color={theme.colors.primary} style={globalStyles.mr8} />
            <Text style={styles.headerTitle}>{t('subjects.title') || 'Materias'}</Text>
            <AutoUploadIndicator size={18} />
          </View>
          <OfflineIndicator />
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
              <View style={styles.gpaAmbientGlow} />
              <View style={styles.heroContentRow}>
                <View style={styles.gpaContainer}>
                  <View style={styles.semesterGpaCircle}>
                    <Text style={styles.semesterGpaValue}>{overallGpa.toFixed(1)}</Text>
                    <Text style={styles.semesterGpaLabel}>{t('subjects.semesterGpa')}</Text>
                  </View>
                </View>

                <View style={styles.miniGridContainer}>
                  <View style={styles.miniCard}>
                    <Text style={styles.miniCardTitle}>{t('subjects.totalSubjects', { defaultValue: 'MATERIAS' })}</Text>
                    <Text style={styles.miniCardValue}>{g.subjects.length}</Text>
                  </View>

                  <View style={styles.miniCard}>
                    <Text style={styles.miniCardTitle}>{t('subjects.semesterCredits', { defaultValue: 'CRÉDITOS' })}</Text>
                    <Text style={styles.miniCardValue}>
                      {g.totalCredits}
                      <Text style={styles.miniCardSub}>cr</Text>
                    </Text>
                  </View>

                  <View style={styles.miniCard}>
                    <Text style={styles.miniCardTitle}>{t('subjects.semesterApproved', { defaultValue: 'APROBADAS' })}</Text>
                    <Text style={styles.miniCardValue}>{approvedCount}</Text>
                  </View>

                  <View style={atRiskCount > 0 ? styles.miniCardInRisk : styles.miniCard}>
                    <Text style={atRiskCount > 0 ? styles.miniCardTitleRisk : styles.miniCardTitle}>
                      {t('subjects.semesterAtRisk', { defaultValue: 'EN RIESGO' })}
                    </Text>
                    <Text style={atRiskCount > 0 ? styles.miniCardValueRisk : styles.miniCardValue}>
                      {atRiskCount}
                    </Text>
                  </View>
                </View>
              </View>

              {/* ── Motor de aprendizaje: footer del hero ── */}
              <View style={styles.heroEngineRow}>
                <View style={styles.heroEngineChip}>
                  <Text style={styles.heroEngineIcon}>⚡</Text>
                  <Text style={styles.heroEngineText}>
                    {g.dueDecksToday > 0
                      ? `${g.dueDecksToday} mazo${g.dueDecksToday !== 1 ? 's' : ''} para hoy`
                      : 'Sin repasos pendientes'}
                  </Text>
                </View>
                {g.studyStreak > 0 && (
                  <>
                    <Text style={styles.heroEngineSep}>·</Text>
                    <View style={styles.heroEngineChip}>
                      <Text style={styles.heroEngineIcon}>🔥</Text>
                      <Text style={styles.heroEngineText}>Racha: {g.studyStreak} día{g.studyStreak !== 1 ? 's' : ''}</Text>
                    </View>
                  </>
                )}
              </View>
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
                    const delta = (subject as any).delta ?? parseFloat((avg - 3.0).toFixed(2));
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
                  <ScrollView style={{ maxHeight: 160 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                    {g.recentActivity.map((item, idx, arr) => {
                      const config = ACTIVITY_CONFIG[item.type];
                      return (
                        <View key={item.id || idx} style={[styles.timelineItem, idx < arr.length - 1 && { position: 'relative' }]}>
                          <View style={[styles.timelineDot, { backgroundColor: item.subjectColor, justifyContent: 'center', alignItems: 'center' }]}>
                            <Ionicons name={config.icon as any} size={10} color="#FFFFFF" />
                          </View>
                          {idx < arr.length - 1 && <View style={styles.timelineLine} />}
                          <View style={styles.timelineContent}>
                            <Text style={styles.timelineName} numberOfLines={1}>
                              {item.title}
                            </Text>
                            <Text style={styles.timelineMeta}>
                              <Text style={{ color: config.color, fontWeight: '600' }}>{config.label}</Text> • {item.subjectName}
                            </Text>
                            {item.subtitle ? <Text style={[styles.timelineMeta, { marginTop: 2 }]} numberOfLines={1}>{item.subtitle}</Text> : null}
                          </View>
                          <Text style={styles.timelineTime}>{item.relativeTime}</Text>
                        </View>
                      );
                    })}
                  </ScrollView>
                </View>
              </View>
            )}
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
                const delta = (subject as any).delta ?? parseFloat((avgScore - 3.0).toFixed(2));
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
                        <View style={[styles.gridIcon, { backgroundColor: cardColor }]}>
                          <SubjectIcon iconName={subject.icon} color={theme.colors.text.primary} size={18} />
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
                          {((subject as any).due_cards || (subject as any).pending_flashcards) ? (
                            <View style={styles.dueMiniBadge}>
                              <Text style={styles.dueMiniText}>
                                {((subject as any).due_cards || (subject as any).pending_flashcards) === 1
                                  ? '1 mazo pendiente'
                                  : `${(subject as any).due_cards || (subject as any).pending_flashcards} mazos pendientes`}
                              </Text>
                            </View>
                          ) : (
                            <View style={{ height: 20, marginTop: 4 }} />
                          )}
                        </View>
                      </View>

                      <View style={styles.gridBody}>
                        <Text style={styles.gridName} numberOfLines={1}>{subject.name}</Text>
                        {subject.professor && (
                          <Text style={styles.gridProf} numberOfLines={1}>
                            Prof. {subject.professor}{(subject as any).room ? ` • Aula ${(subject as any).room}` : ''}
                          </Text>
                        )}
                      </View>

                      <View style={styles.gridMetaRow}>
                        {subject.credits ? (
                          <View style={styles.gridMetaBadge}>
                            <Text style={styles.gridMetaBadgeText}>{subject.credits} {t('subjects.credits')}</Text>
                          </View>
                        ) : null}
                        <Text style={styles.gridTargetText}>{t('subjects.requiredPass')}: {(subject.target_grade ?? 3.0).toFixed(1)}</Text>
                      </View>

                      {((subject as any).next_milestone || (subject as any).next_assessment) && (
                        <Text style={styles.gridNextMilestone} numberOfLines={1}>
                          {t('subjects.nextMilestone', 'Próximo hito')}: {((subject as any).next_milestone || (subject as any).next_assessment)}
                        </Text>
                      )}

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

        {g.subjects.length > 0 && <ScheduleGrid />}
      </ScrollView>

      <ExplanationOverlay
        visible={g.overlayVisible}
        explanation={g.overlayText}
        onDismiss={() => g.setOverlayVisible(false)}
      />
    </SafeAreaView>
  );
}
