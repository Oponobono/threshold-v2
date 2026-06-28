import React, { useMemo, useState, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, ScrollView, Modal, Pressable } from 'react-native';
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
import { ScheduleGrid } from '../../src/components/subjects/ScheduleGrid';
import { SCALE_MAX } from '../../src/utils/grades';
import { useGroupedSubjects } from '../../src/hooks/useGroupedSubjects';
import { SubjectCard } from '../../src/components/subjects/SubjectCard';
import { openCourseLink } from '../../src/utils/linking';
import { ZyrenIngestionModal } from '../../src/components/subjects/ZyrenIngestionModal';
import { CreateSubjectModal } from '../../src/components/dashboard/CreateSubjectModal';
import { MomentumService } from '../../src/services/MomentumService';
import { useDataStore } from '../../src/store/useDataStore';
import { CoursePills } from '../../src/components/ui/CoursePills';
import { updateSubject, updateCourseCounters } from '../../src/services/api/subjects';

const MomentumCard = ({ score }: { score: number }) => {
  const isDanger = score < 0.5;
  return (
    <View style={[
      styles.miniCard, 
      isDanger && { backgroundColor: 'rgba(231, 76, 60, 0.08)', borderColor: 'rgba(231, 76, 60, 0.2)' }
    ]}>
      <Text style={styles.miniCardTitle}>MOMENTUM</Text>
      <Text style={[styles.miniCardValue, isDanger && { color: '#E74C3C' }]}>
        {isDanger ? '⚠️' : '🔥'} {Math.round(score * 100)}%
      </Text>
    </View>
  );
};

export default function SubjectsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const g = useSubjects(t);
  const { courses, loadAllData, refreshCourses, refreshSubjects } = useDataStore();
  const { groupedSections, toggleCourse, collapsedCourses, aggregatedMomentumScore } = useGroupedSubjects(courses, g.filteredSubjects);

  // ── Fase 5: Estado del modal de ingesta de Zyren ──
  const [zyrenModalVisible, setZyrenModalVisible] = useState(false);
  const [zyrenSubject, setZyrenSubject] = useState<{ id: string; name: string; courseId?: string | null; courseName?: string; milestone?: string } | null>(null);

  const [isCreationMenuVisible, setIsCreationMenuVisible] = useState(false);
  const [isCreateSubjectModalVisible, setIsCreateSubjectModalVisible] = useState(false);
  // ── Tab de curso seleccionado (null = todas) ──
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  const handleClassComplete = useCallback(async (subject: any, courseName: string) => {
    try {
      const newCompleted = (subject.completed_lessons || 0) + 1;
      await updateSubject(subject.id, { completed_lessons: newCompleted });
      await refreshSubjects();
      if (subject.course_id) {
        await updateCourseCounters(subject.course_id);
        await refreshCourses();
        MomentumService.boostMomentum(subject.course_id).catch(console.warn);
      }
    } catch (e) {
      console.warn('[handleClassComplete] Error persisting completed_lessons:', e);
    }
    setZyrenSubject({
      id: subject.id,
      name: subject.name,
      courseId: subject.course_id,
      courseName,
      milestone: subject.next_micro_milestone || subject.next_milestone,
    });
    setZyrenModalVisible(true);
  }, [refreshSubjects, refreshCourses]);

  const handleContinueClass = useCallback(async (url: string) => {
    await openCourseLink(url);
  }, []);

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

  // ── Cursos para CoursePills (derivados de las secciones agrupadas) ──
  const coursesForPills = useMemo(() => {
    return groupedSections
      .filter(s => s.courseId !== 'independent' && s.courseId)
      .map(s => ({ id: s.courseId as string, name: s.courseName, platform: s.coursePlatform }));
  }, [groupedSections]);

  // ── Subjects filtered by selected tab ──
  const displayedSubjects = useMemo(() => {
    if (selectedCourseId === null) return g.filteredSubjects;
    const section = groupedSections.find(s => (s.courseId ?? 'independent') === selectedCourseId);
    return section?.data ?? [];
  }, [selectedCourseId, groupedSections, g.filteredSubjects]);

  // ── Course name for selected tab (for handleClassComplete) ──
  const selectedCourseName = useMemo(() => {
    if (!selectedCourseId) return '';
    return groupedSections.find(s => (s.courseId ?? 'independent') === selectedCourseId)?.courseName ?? '';
  }, [selectedCourseId, groupedSections]);

  // ── Agrupar materias en pares para grilla de 2 columnas ──
  const displayedPairs = useMemo(() => {
    const pairs: [any, any | null][] = [];
    for (let i = 0; i < displayedSubjects.length; i += 2) {
      pairs.push([displayedSubjects[i], displayedSubjects[i + 1] ?? null]);
    }
    return pairs;
  }, [displayedSubjects]);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={globalStyles.safeArea}>
      <View style={styles.header}>
        <View style={[globalStyles.row, { justifyContent: 'space-between', flex: 1 }]}>
          <View>
            <View style={globalStyles.row}>
              <Ionicons name="book-outline" size={20} color={theme.colors.primary} style={globalStyles.mr8} />
              <Text style={styles.headerTitle}>{t('subjects.title') || 'Materias'}</Text>
              <AutoUploadIndicator size={18} />
            </View>
            <OfflineIndicator />
          </View>
          <TouchableOpacity style={styles.addBtn} onPress={() => setIsCreationMenuVisible(true)}>
            <Ionicons name="add" size={24} color={theme.colors.text.inverse} />
          </TouchableOpacity>
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

      <FlatList
        data={displayedPairs}
        keyExtractor={(_, index) => `pair-${index}`}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { gap: 10 }]}
        renderItem={({ item: [left, right] }) => (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <SubjectCard
              subject={left}
              onPress={() => router.push(`/subjects/${left.id}`)}
              onContinue={left.external_url ? () => handleContinueClass(left.external_url) : undefined}
              onComplete={() => handleClassComplete(left, left.courseName || selectedCourseName)}
            />
            {right ? (
              <SubjectCard
                subject={right}
                onPress={() => router.push(`/subjects/${right.id}`)}
                onContinue={right.external_url ? () => handleContinueClass(right.external_url) : undefined}
                onComplete={() => handleClassComplete(right, right.courseName || selectedCourseName)}
              />
            ) : (
              <View style={{ flex: 1 }} />
            )}
          </View>
        )}
        ListEmptyComponent={
          g.filteredSubjects.length === 0 ? (
            <View style={[globalStyles.center, { paddingVertical: 60 }]}>
              <MaterialCommunityIcons name="book-open-variant" size={48} color="rgba(255,255,255,0.1)" />
              <Text style={[{ color: theme.colors.text.secondary }, globalStyles.mt16]}>
                {g.search ? t('subjects.noResults', 'Sin resultados') : t('subjects.noSubjects', 'No hay materias')}
              </Text>
              {!g.search && (
                <TouchableOpacity 
                  style={[globalStyles.mt24, styles.addBtn, { width: 'auto', paddingHorizontal: 20, borderRadius: 24, flexDirection: 'row', gap: 8 }]} 
                  onPress={() => setIsCreationMenuVisible(true)}
                >
                  <Ionicons name="add" size={20} color={theme.colors.text.inverse} />
                  <Text style={{ color: theme.colors.text.inverse, fontWeight: '700' }}>Crear materia</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : null
        }
        ListFooterComponent={g.subjects.length > 0 ? <ScheduleGrid /> : null}
        ListHeaderComponent={
          g.subjects.length > 0 ? (
            <>
              <View style={styles.semesterHero}>
              {/* Background decorations: concentric arcs emanating from the GPA circle */}
              <View style={styles.gpaAmbientGlow} />
              <View style={styles.heroArc1} />
              <View style={styles.heroArc2} />
              <View style={styles.heroArc3} />

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

                  <MomentumCard score={aggregatedMomentumScore} />
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
            {/* ── CoursePills (filtro de cursos) ── */}
            {coursesForPills.length > 0 && (
              <CoursePills
                courses={coursesForPills}
                selectedCourseId={selectedCourseId}
                onSelectCourse={setSelectedCourseId}
              />
            )}
            </>
          ) : null
        }
      />

      <ExplanationOverlay
        visible={g.overlayVisible}
        explanation={g.overlayText}
        onDismiss={() => g.setOverlayVisible(false)}
      />

      <CreateSubjectModal
        visible={isCreateSubjectModalVisible}
        onClose={() => {
          setIsCreateSubjectModalVisible(false);
          loadAllData(true);
          refreshCourses();
        }}
      />

      <Modal visible={isCreationMenuVisible} transparent animationType="fade" onRequestClose={() => setIsCreationMenuVisible(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }} onPress={() => setIsCreationMenuVisible(false)}>
          <Pressable style={{ backgroundColor: theme.colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }} onPress={() => null}>
            <View style={{ width: 40, height: 4, backgroundColor: theme.colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />
            <Text style={{ fontSize: 20, fontWeight: '700', color: theme.colors.text.primary, marginBottom: 16 }}>¿Qué deseas crear?</Text>
            
            <TouchableOpacity 
              style={{ flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: theme.colors.background, borderRadius: 16, marginBottom: 12 }}
              onPress={() => { setIsCreationMenuVisible(false); setTimeout(() => setIsCreateSubjectModalVisible(true), 300); }}
            >
              <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: theme.colors.primary + '20', justifyContent: 'center', alignItems: 'center', marginRight: 16 }}>
                <Ionicons name="book" size={24} color={theme.colors.primary} />
              </View>
              <View>
                <Text style={{ fontSize: 16, fontWeight: '600', color: theme.colors.text.primary }}>Nueva Materia / Módulo</Text>
                <Text style={{ fontSize: 14, color: theme.colors.text.secondary, marginTop: 4 }}>Para clases individuales de tu Universidad</Text>
              </View>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {zyrenSubject && (
        <ZyrenIngestionModal
          visible={zyrenModalVisible}
          onClose={() => setZyrenModalVisible(false)}
          courseName={zyrenSubject.courseName || ''}
          subjectName={zyrenSubject.name}
          subjectId={zyrenSubject.id}
          subjectColor={zyrenSubject.color}
          subjectIcon={zyrenSubject.icon}
          currentMilestone={zyrenSubject.milestone}
        />
      )}
    </SafeAreaView>
  );
}


