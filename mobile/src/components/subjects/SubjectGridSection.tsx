import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  LayoutAnimation,
  UIManager,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { SubjectCard } from './SubjectCard';
import { SubjectRow } from './SubjectRow';
import { theme } from '../../styles/theme';
import { SCALE_MAX } from '../../utils/grades';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const STORAGE_KEY_VIEW = 'subjects_view_mode';
const STORAGE_KEY_TAB  = 'subjects_status_tab';
const MAX_VISIBLE_PER_GROUP = 3;

type StatusTab = 'active' | 'completed' | 'all';
type ViewMode  = 'list' | 'grid';

interface GroupedSection {
  courseId: string | null;
  courseName: string;
  coursePlatform?: string;
  data: any[];
}


interface SubjectGridSectionProps {
  subjects: any[];
  courseName?: string;
  onSubjectPress: (subject: any) => void;
  onContinue: (subject: any) => void;
  onComplete: (subject: any) => void;
  onCreateSubject: () => void;
  subHeader?: React.ReactNode;
  /** Sections grouped by course — for the Todas tab grouped view */
  groupedSections?: GroupedSection[];
  /** True when user selected a specific course in the picker */
  isCourseFiltered?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSubjectStatus(s: any): 'active' | 'completed' | 'notstarted' {
  const p = s.total_lessons && s.total_lessons > 0
    ? (s.completed_lessons || 0) / s.total_lessons
    : (s.completion_percent || 0) / 100;
  const pct = Math.min(Math.round(p * 100), 100);
  if (pct >= 100) return 'completed';
  if (pct > 0)   return 'active';
  return 'notstarted';
}

function getSubjectAvg(s: any): number {
  const raw = s.avg_score ?? 0;
  return raw > SCALE_MAX * 2 ? (raw / 100) * SCALE_MAX : raw;
}

function sortSubjects(list: any[]): any[] {
  return [...list].sort((a, b) => {
    const order = (s: any) => getSubjectStatus(s) === 'active' ? 0 : getSubjectStatus(s) === 'notstarted' ? 1 : 2;
    if (order(a) !== order(b)) return order(a) - order(b);
    const aT = a.last_accessed_at ? new Date(a.last_accessed_at).getTime() : 0;
    const bT = b.last_accessed_at ? new Date(b.last_accessed_at).getTime() : 0;
    return bT - aT;
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatusFilterBar: React.FC<{
  tab: StatusTab;
  counts: { active: number; completed: number; all: number };
  onTabChange: (t: StatusTab) => void;
}> = ({ tab, counts, onTabChange }) => {
  const TABS: Array<{ key: StatusTab; label: string }> = [
    { key: 'active',    label: 'En curso'  },
    { key: 'completed', label: 'Completas' },
    { key: 'all',       label: 'Todas'     },
  ];
  return (
    <View style={filterSt.bar} accessibilityRole="tablist">
      {TABS.map(({ key, label }) => {
        const isActive = tab === key;
        return (
          <TouchableOpacity
            key={key}
            style={[filterSt.tab, isActive && filterSt.tabActive]}
            onPress={() => onTabChange(key)}
            activeOpacity={0.7}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
          >
            <Text style={[filterSt.tabLabel, isActive && filterSt.tabLabelActive]}>{label}</Text>
            <View style={[filterSt.badge, isActive && filterSt.badgeActive]}>
              <Text style={[filterSt.badgeText, isActive && filterSt.badgeTextActive]}>{counts[key]}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const ViewToggle: React.FC<{ mode: ViewMode; onToggle: () => void }> = ({ mode, onToggle }) => (
  <TouchableOpacity
    style={toggleSt.btn}
    onPress={onToggle}
    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    accessibilityRole="button"
    accessibilityLabel={mode === 'list' ? 'Cambiar a cuadrícula' : 'Cambiar a lista'}
  >
    <Ionicons name={mode === 'list' ? 'grid-outline' : 'list-outline'} size={17} color={theme.colors.text.secondary} />
  </TouchableOpacity>
);

const CourseGroupHeader: React.FC<{
  courseName: string; total: number; avgGpa: number | null;
  activeCount: number; isCollapsed: boolean; onToggle: () => void;
}> = ({ courseName, total, avgGpa, activeCount, isCollapsed, onToggle }) => (
  <TouchableOpacity
    style={groupSt.header}
    onPress={onToggle}
    activeOpacity={0.7}
    accessibilityRole="header"
    accessibilityState={{ expanded: !isCollapsed }}
    accessibilityLabel={`Curso ${courseName}, ${total} materias, ${activeCount} en curso. ${isCollapsed ? 'Colapsado. Toca para expandir' : 'Expandido. Toca para colapsar'}`}
  >
    <View style={groupSt.headerLeft}>
      <Text style={groupSt.headerTitle} numberOfLines={2}>{courseName}</Text>
      <View style={groupSt.headerMeta}>
        <Text style={groupSt.headerMetaText}>
          {total} materia{total !== 1 ? 's' : ''}{avgGpa && avgGpa > 0 ? ` · Prom. ${avgGpa.toFixed(1)}` : ''}
        </Text>
        {activeCount > 0 && (
          <View style={groupSt.activeBadge}>
            <Text style={groupSt.activeBadgeText}>{activeCount} en curso</Text>
          </View>
        )}
      </View>
    </View>
    <Ionicons name={isCollapsed ? 'chevron-down' : 'chevron-up'} size={16} color={theme.colors.text.secondary} />
  </TouchableOpacity>
);

const EmptyTabState: React.FC<{
  tab: StatusTab; onCreateSubject: () => void; onSwitchToAll: () => void;
}> = ({ tab, onCreateSubject, onSwitchToAll }) => {
  if (tab === 'active') return (
    <View style={emptySt.container}>
      <Ionicons name="checkmark-circle-outline" size={32} color={theme.colors.success} style={{ opacity: 0.6, marginBottom: 8 }} />
      <Text style={emptySt.title}>No tienes materias en curso</Text>
      <Text style={emptySt.subtitle}>Todas tus materias están completas o sin iniciar</Text>
      <TouchableOpacity style={emptySt.linkBtn} onPress={onSwitchToAll}>
        <Text style={emptySt.linkText}>Ver todas las materias</Text>
        <Ionicons name="arrow-forward" size={13} color={theme.colors.primary} />
      </TouchableOpacity>
    </View>
  );
  if (tab === 'completed') return (
    <View style={emptySt.container}>
      <Ionicons name="trophy-outline" size={32} color={theme.colors.text.placeholder} style={{ opacity: 0.5, marginBottom: 8 }} />
      <Text style={emptySt.title}>Sin materias completas aún</Text>
      <Text style={emptySt.subtitle}>Las materias que completes aparecerán aquí</Text>
    </View>
  );
  return (
    <View style={emptySt.container}>
      <Ionicons name="book-outline" size={32} color={theme.colors.primary} style={{ opacity: 0.5, marginBottom: 8 }} />
      <Text style={emptySt.title}>Agrega tu primera materia</Text>
      <TouchableOpacity style={emptySt.addBtn} onPress={onCreateSubject}>
        <Ionicons name="add" size={16} color="#FFFFFF" />
        <Text style={emptySt.addBtnText}>Nueva materia</Text>
      </TouchableOpacity>
    </View>
  );
};

// ─── Main ─────────────────────────────────────────────────────────────────────

export const SubjectGridSection: React.FC<SubjectGridSectionProps> = ({
  subjects,
  onSubjectPress,
  onContinue,
  onComplete,
  onCreateSubject,
  subHeader,
  groupedSections,
  isCourseFiltered = false,
}) => {
  const { t } = useTranslation();
  const [tab, setTab]               = useState<StatusTab>('active');
  const [viewMode, setViewMode]     = useState<ViewMode>('list');
  const [collapsed, setCollapsed]   = useState<Record<string, boolean>>({});
  const [expanded, setExpanded]     = useState<Record<string, boolean>>({});
  const [ready, setReady]           = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [v, s] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY_VIEW),
          AsyncStorage.getItem(STORAGE_KEY_TAB),
        ]);
        if (v === 'grid' || v === 'list') setViewMode(v);
        if (s === 'active' || s === 'completed' || s === 'all') setTab(s);
      } catch { /* ignore */ }
      setReady(true);
    })();
  }, []);

  const handleTabChange = useCallback((t: StatusTab) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setTab(t);
    AsyncStorage.setItem(STORAGE_KEY_TAB, t).catch(() => {});
  }, []);

  const handleViewToggle = useCallback(() => {
    const next: ViewMode = viewMode === 'list' ? 'grid' : 'list';
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setViewMode(next);
    AsyncStorage.setItem(STORAGE_KEY_VIEW, next).catch(() => {});
  }, [viewMode]);

  const handleToggle = useCallback((key: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setCollapsed(p => ({ ...p, [key]: !p[key] }));
  }, []);

  const handleExpand = useCallback((key: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(p => ({ ...p, [key]: true }));
  }, []);

  const counts = useMemo(() => ({
    active:    subjects.filter(s => getSubjectStatus(s) === 'active').length,
    completed: subjects.filter(s => getSubjectStatus(s) === 'completed').length,
    all:       subjects.length,
  }), [subjects]);

  const filteredSubjects = useMemo(() => {
    if (tab === 'active')    return sortSubjects(subjects.filter(s => getSubjectStatus(s) === 'active'));
    if (tab === 'completed') return sortSubjects(subjects.filter(s => getSubjectStatus(s) === 'completed'));
    return sortSubjects(subjects);
  }, [subjects, tab]);

  // Grouped sections with per-tab filtering applied to each group's subjects.
  // Works for all tabs: active, completed, and all.
  const groupedForTab = useMemo(() => {
    if (!groupedSections || isCourseFiltered) return null;
    return groupedSections
      .map(sec => {
        const allInGroup = sortSubjects(sec.data);
        const tabFiltered =
          tab === 'active'    ? allInGroup.filter(s => getSubjectStatus(s) === 'active') :
          tab === 'completed' ? allInGroup.filter(s => getSubjectStatus(s) === 'completed') :
          allInGroup;
        const activeCount = allInGroup.filter(s => getSubjectStatus(s) === 'active').length;
        const scored = allInGroup.filter(s => getSubjectAvg(s) > 0);
        const avgGpa = scored.length ? scored.reduce((sum, s) => sum + getSubjectAvg(s), 0) / scored.length : null;
        return { ...sec, allSubjects: tabFiltered, activeCount, avgGpa };
      })
      .filter(sec => sec.allSubjects.length > 0);
  }, [groupedSections, isCourseFiltered, tab]);

  const renderItem = useCallback((subject: any, isLast: boolean) => {
    const status = getSubjectStatus(subject);
    if (viewMode === 'grid') {
      return (
        <View key={subject.id} style={{ flex: 1 }}>
          <SubjectCard
            subject={subject}
            onPress={onSubjectPress}
            onContinue={subject.external_url ? onContinue : undefined}
            onComplete={status !== 'completed' ? onComplete : undefined}
          />
        </View>
      );
    }
    return (
      <SubjectRow
        key={subject.id}
        subject={subject}
        onPress={() => onSubjectPress(subject)}
        onContinue={subject.external_url ? () => onContinue(subject) : undefined}
        onComplete={status !== 'completed' ? () => onComplete(subject) : undefined}
        isLast={isLast}
      />
    );
  }, [viewMode, onSubjectPress, onContinue, onComplete]);

  const renderFlat = useCallback((list: any[]) => {
    if (viewMode === 'grid') {
      const rows: React.ReactElement[] = [];
      for (let i = 0; i < list.length; i += 2) {
        rows.push(
          <View key={`gr-${i}`} style={listSt.gridRow}>
            {renderItem(list[i], false)}
            {list[i + 1] ? renderItem(list[i + 1], false) : <View style={{ flex: 1 }} />}
          </View>
        );
      }
      return <View style={listSt.gridWrap}>{rows}</View>;
    }
    return (
      <View style={listSt.listWrap}>
        {list.map((s, idx) => renderItem(s, idx === list.length - 1))}
      </View>
    );
  }, [viewMode, renderItem]);

  // Reset "Ver más" expansion when tab changes to avoid stale counts
  useEffect(() => {
    setExpanded({});
  }, [tab]);

  const renderGrouped = useCallback((sections: NonNullable<typeof groupedForTab>) => {
    return sections.map(sec => {
      const key = `${tab}:${sec.courseId ?? 'independent'}`;
      const colKey = sec.courseId ?? 'independent';
      const isCol = collapsed[colKey] ?? false;
      const isExp = expanded[key] ?? false;
      const visible = isCol ? [] : isExp ? sec.allSubjects : sec.allSubjects.slice(0, MAX_VISIBLE_PER_GROUP);
      const hidden  = sec.allSubjects.length - MAX_VISIBLE_PER_GROUP;
      const showMore = !isCol && !isExp && hidden > 0;
      return (
        <View key={key} style={groupSt.section}>
          <CourseGroupHeader
            courseName={sec.courseName} total={sec.allSubjects.length}
            avgGpa={sec.avgGpa} activeCount={sec.activeCount}
            isCollapsed={isCol} onToggle={() => handleToggle(colKey)}
          />
          {!isCol && (
            <>
              {viewMode === 'grid' ? (
                <View style={listSt.gridWrap}>
                  {(() => {
                    const rows: React.ReactElement[] = [];
                    for (let i = 0; i < visible.length; i += 2) {
                      rows.push(
                        <View key={`gr-${i}`} style={listSt.gridRow}>
                          {renderItem(visible[i], false)}
                          {visible[i + 1] ? renderItem(visible[i + 1], false) : <View style={{ flex: 1 }} />}
                        </View>
                      );
                    }
                    return rows;
                  })()}
                </View>
              ) : (
                <View style={[listSt.listWrap, groupSt.listInset]}>
                  {visible.map((s, idx) => renderItem(s, idx === visible.length - 1 && !showMore))}
                </View>
              )}
              {showMore && (
                <TouchableOpacity
                  style={groupSt.verMas}
                  onPress={() => handleExpand(key)}
                  activeOpacity={0.7}
                >
                  <Text style={groupSt.verMasText}>Ver {hidden} más</Text>
                  <Ionicons name="chevron-down" size={13} color={theme.colors.text.secondary} />
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      );
    });
  }, [groupedForTab, collapsed, expanded, tab, viewMode, renderItem, handleToggle, handleExpand]);

  if (!ready) return null;

  const showGrouped = !isCourseFiltered && groupedForTab !== null && groupedForTab.length > 1;
  const isEmpty     = showGrouped
    ? groupedForTab!.length === 0
    : filteredSubjects.length === 0;

  return (
    <View style={secSt.container}>
      {/* Header */}
      <View style={secSt.header}>
        <View style={secSt.titleRow}>
          <Text style={secSt.title}>{t('subjects.yourSubjects', 'Tus materias')}</Text>
          <ViewToggle mode={viewMode} onToggle={handleViewToggle} />
        </View>
        {subHeader && <View style={secSt.subHeaderWrap}>{subHeader}</View>}
        <StatusFilterBar tab={tab} counts={counts} onTabChange={handleTabChange} />
      </View>

      {/* Content */}
      {isEmpty ? (
        <EmptyTabState tab={tab} onCreateSubject={onCreateSubject} onSwitchToAll={() => handleTabChange('all')} />
      ) : showGrouped ? (
        <View style={secSt.groupedWrap}>{renderGrouped(groupedForTab!)}</View>
      ) : (
        renderFlat(filteredSubjects)
      )}
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const secSt = StyleSheet.create({
  container:    { marginBottom: 16 },
  header:       { gap: 10, marginBottom: 12 },
  titleRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title:        { fontSize: theme.typography.sizes.sm, fontWeight: '800', color: theme.colors.text.secondary, textTransform: 'uppercase', letterSpacing: 0.8 },
  subHeaderWrap:{ marginTop: 2 },
  groupedWrap:  { gap: 4 },
});

const filterSt = StyleSheet.create({
  bar:            { flexDirection: 'row', backgroundColor: theme.colors.card, borderRadius: 10, padding: 3, gap: 2 },
  tab:            { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 7, paddingHorizontal: 4, borderRadius: 8 },
  tabActive:      { backgroundColor: theme.colors.white, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, elevation: 2 },
  tabLabel:       { fontSize: 12, fontWeight: '500', color: theme.colors.text.secondary },
  tabLabelActive: { fontWeight: '700', color: theme.colors.text.primary },
  badge:          { backgroundColor: theme.colors.border, borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeActive:    { backgroundColor: theme.colors.text.primary },
  badgeText:      { fontSize: 10, fontWeight: '700', color: theme.colors.text.secondary },
  badgeTextActive:{ color: theme.colors.white },
});

const toggleSt = StyleSheet.create({
  btn: { width: 32, height: 32, borderRadius: 8, backgroundColor: theme.colors.card, alignItems: 'center', justifyContent: 'center' },
});

const groupSt = StyleSheet.create({
  section:         { marginBottom: 4, backgroundColor: theme.colors.white, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, overflow: 'hidden' },
  header:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 14, gap: 8 },
  headerLeft:      { flex: 1, gap: 3 },
  headerTitle:     { fontSize: 13, fontWeight: '700', color: theme.colors.text.primary, lineHeight: 17 },
  headerMeta:      { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  headerMetaText:  { fontSize: 11, color: theme.colors.text.secondary },
  activeBadge:     { backgroundColor: '#FEF3C7', borderRadius: 5, paddingHorizontal: 6, paddingVertical: 1, borderWidth: 0.5, borderColor: '#FDE68A' },
  activeBadgeText: { fontSize: 10, fontWeight: '600', color: '#D97706' },
  listInset:       { borderTopWidth: 0.5, borderTopColor: theme.colors.border },
  verMas:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, borderTopWidth: 0.5, borderTopColor: theme.colors.border },
  verMasText:      { fontSize: 12, fontWeight: '600', color: theme.colors.text.secondary },
});

const listSt = StyleSheet.create({
  listWrap:  { backgroundColor: theme.colors.white, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, overflow: 'hidden' },
  gridWrap:  { gap: 10, padding: 2 },
  gridRow:   { flexDirection: 'row', gap: 10 },
});

const emptySt = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', paddingVertical: 32, backgroundColor: theme.colors.white, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, gap: 6 },
  title:     { fontSize: 14, fontWeight: '600', color: theme.colors.text.primary, textAlign: 'center' },
  subtitle:  { fontSize: 12, color: theme.colors.text.secondary, textAlign: 'center', paddingHorizontal: 24, lineHeight: 17 },
  linkBtn:   { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: theme.colors.border },
  linkText:  { fontSize: 13, fontWeight: '600', color: theme.colors.text.primary },
  addBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, backgroundColor: theme.colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  addBtnText:{ color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
});


