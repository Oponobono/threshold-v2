import { StyleSheet } from 'react-native';
import { theme } from './theme';
import { globalStyles } from './globalStyles';

export const gradesStyles = StyleSheet.create({
  header: globalStyles.standardHeader,
  logoText: globalStyles.screenTitle,
  termPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: theme.colors.inputBackground,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: theme.borderRadius.full, borderWidth: 1, borderColor: theme.colors.border,
  },
  termText: { fontSize: theme.typography.sizes.sm, fontWeight: '600', color: theme.colors.text.primary },
  filtersContainer: { paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm, gap: 8 },
  filterRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  filterPill: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4,
    backgroundColor: theme.colors.inputBackground,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: theme.borderRadius.full, borderWidth: 1, borderColor: theme.colors.border,
  },
  filterText: { fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary, flex: 1 },
  applyBtn: {
    backgroundColor: theme.colors.text.primary,
    paddingHorizontal: 20, paddingVertical: 8,
    borderRadius: theme.borderRadius.full,
  },
  applyBtnText: { color: theme.colors.text.inverse, fontWeight: '700', fontSize: theme.typography.sizes.sm },
  scroll: { paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.lg, gap: 16, paddingBottom: 40 },
  card: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.lg, padding: theme.spacing.lg,
    borderWidth: 1, borderColor: theme.colors.border, overflow: 'hidden',
    ...globalStyles.shadow,
  },
  gpaRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  gpaLabel: { fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary, marginBottom: 2 },
  gpaValue: { fontSize: theme.typography.sizes.xxxl, fontWeight: '900', color: theme.colors.text.primary },
  divider: { width: 1, height: 50, backgroundColor: theme.colors.border, marginHorizontal: 12 },
  miniSparkline: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 40, marginLeft: 12 },
  miniBar: { width: 8, borderRadius: 2 },
  scaleText: { fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary, marginBottom: 6 },
  projectedRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  projectedText: { fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary },
  editScaleText: { fontSize: theme.typography.sizes.sm, color: theme.colors.primary, fontWeight: '600' },
  section: { gap: 12 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  sectionContextText: { fontSize: theme.typography.sizes.sm, color: theme.colors.text.secondary, fontWeight: '500' },
  projectionHeaderRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  sectionTitle: { fontSize: theme.typography.sizes.md, fontWeight: '800', color: theme.colors.text.primary },
  addBtn: {
    backgroundColor: theme.colors.text.primary,
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: theme.borderRadius.full, marginLeft: 8,
  },
  addBtnText: { color: theme.colors.text.inverse, fontWeight: '700', fontSize: theme.typography.sizes.sm },
  bulkBtn: {
    backgroundColor: theme.colors.inputBackground,
    borderWidth: 1, borderColor: theme.colors.border,
  },
  assessCard: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.lg, padding: theme.spacing.md,
    borderWidth: 1, borderColor: theme.colors.border, ...globalStyles.shadow,
  },
  assessTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  assessIconBox: {
    width: 42, height: 42, borderRadius: 12,
    justifyContent: 'center', alignItems: 'center',
  },
  assessName: { fontSize: theme.typography.sizes.sm, fontWeight: '700', color: theme.colors.text.primary, marginBottom: 4 },
  tagsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 },
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: theme.borderRadius.full },
  tagText: { fontSize: theme.typography.sizes.xs, fontWeight: '600', color: theme.colors.text.secondary },
  dateText: { fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary },
  weightText: { fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary },
  scoreBadge: { alignItems: 'flex-end' },
  scoreText: { fontSize: theme.typography.sizes.sm, fontWeight: '700' },
  scorePct: { fontSize: theme.typography.sizes.xl, fontWeight: '900' },
  progressBar: {
    height: 5, backgroundColor: theme.colors.inputBackground,
    borderRadius: 3, marginBottom: 10, overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3 },
  assessActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionPill: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: theme.borderRadius.full, borderWidth: 1, borderColor: theme.colors.border,
    backgroundColor: theme.colors.inputBackground,
  },
  actionPillText: { fontSize: theme.typography.sizes.xs, fontWeight: '600', color: theme.colors.text.secondary },
  deleteBtn: { borderColor: theme.colors.dangerTransparent, backgroundColor: theme.colors.dangerTransparent },
  fabAdd: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: theme.colors.text.primary,
    justifyContent: 'center', alignItems: 'center',
    marginLeft: 'auto',
  },
  currentProjectionCentered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    marginBottom: 12,
  },
  currentProjectionLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'nowrap',
  },
  currentProjectionLabel: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text.secondary,
    fontWeight: '600',
    textAlign: 'center',
    flexShrink: 1,
  },
  currentProjectionValue: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.success,
    fontWeight: '800',
    textAlign: 'center',
  },
  descText: { fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary, marginVertical: 6 },
  simInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 12,
  },
  simInputWrapper: {
    flex: 1,
    minWidth: 0,
  },
  simInputLabel: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.text.secondary,
    marginBottom: 4,
    fontWeight: '600',
  },
  simAddBtn: {
    backgroundColor: theme.colors.text.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  simInput: {
    flex: 1, backgroundColor: theme.colors.inputBackground,
    borderRadius: theme.borderRadius.md, borderWidth: 1, borderColor: theme.colors.border,
    padding: 8, fontSize: theme.typography.sizes.sm, color: theme.colors.text.primary, textAlign: 'center',
  },
  simChartCard: {
    marginBottom: 12,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: '#DCE7F3',
    backgroundColor: '#EEF4FA',
    paddingVertical: 10,
    alignItems: 'center',
  },
  simChart: {
    borderRadius: theme.borderRadius.md,
  },
  simSummary: {
    backgroundColor: theme.colors.successTransparent, borderRadius: theme.borderRadius.md, padding: theme.spacing.sm, marginBottom: 12,
  },
  simSummaryText: { fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary, fontWeight: '600' },
  projGpaText: { fontSize: theme.typography.sizes.md, color: theme.colors.text.primary, fontWeight: '700', marginTop: 2 },
  simActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginTop: 2,
  },
  simActionPrimary: {
    minWidth: 118,
    backgroundColor: theme.colors.text.primary,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: theme.borderRadius.full,
    alignItems: 'center',
  },
  simActionPrimaryText: {
    color: theme.colors.text.inverse,
    fontWeight: '700',
    fontSize: theme.typography.sizes.sm,
  },
  simActionSecondary: {
    minWidth: 118,
    backgroundColor: theme.colors.inputBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: theme.borderRadius.full,
    alignItems: 'center',
  },
  simActionSecondaryText: {
    color: theme.colors.text.primary,
    fontWeight: '700',
    fontSize: theme.typography.sizes.sm,
  },
  bulkCard: { borderLeftWidth: 3, borderLeftColor: theme.colors.primary },
  bulkCardInner: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chooseFileText: { fontSize: theme.typography.sizes.sm, color: theme.colors.primary, fontWeight: '600', marginTop: 4 },
  smallBadgeBtn: {
    backgroundColor: theme.colors.primaryTransparent.light,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: theme.borderRadius.full,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)',
    minWidth: 105,
  },
  smallBadgeText: { color: theme.colors.text.primary, fontWeight: '700', fontSize: 11 },

  // Header actions
  headerActionBtn: { marginLeft: 10 },

  // Subject filter bar
  subjectFilterContent: { paddingHorizontal: 20, paddingVertical: 6, gap: 6, alignItems: 'center' },
  subjectFilterChip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, alignSelf: 'center',
    paddingHorizontal: 13, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: 'transparent',
  },
  subjectFilterChipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  subjectFilterChipText: { fontSize: 13, fontWeight: '500', color: theme.colors.text.secondary, letterSpacing: -0.1 },
  subjectFilterChipTextActive: { fontWeight: '700', color: theme.colors.white },

  // GPA metrics
  gpaMetricLabel: {
    fontSize: 11, color: theme.colors.text.secondary, marginBottom: 8,
    fontWeight: '600', textTransform: 'uppercase', textAlign: 'center',
  },
  gpaMetricValue: { fontSize: 44, fontWeight: '900', color: theme.colors.text.primary, letterSpacing: -1, lineHeight: 44 },
  gpaDivider: { width: 1, height: 50, backgroundColor: theme.colors.border },

  // Scale badge
  scaleBadgeRow: { flexDirection: 'row', justifyContent: 'center', marginBottom: 4 },
  scaleBadge: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.colors.inputBackground,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border,
  },
  scaleBadgeText: { fontSize: 10, fontWeight: '700', color: theme.colors.text.secondary },

  // Projected meta
  projectedMetaRow: { alignItems: 'center', marginBottom: 12 },
  projectedMetaText: { fontSize: 10, color: theme.colors.text.secondary, textTransform: 'uppercase', fontWeight: '700' },

  // Sparkline
  sparklineRow: { flexDirection: 'row', alignItems: 'flex-end', height: 32, gap: 4 },
  sparklineBar: { flex: 1, borderRadius: 2 },
  sparklineBarPlaceholder: {
    flex: 1, backgroundColor: theme.colors.text.secondary,
    opacity: 0.1, borderRadius: 2, height: '30%',
  },

  // Assessment list item
  assessItem: {
    paddingVertical: 10, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: theme.colors.border,
    flexDirection: 'row', alignItems: 'center', gap: 14,
  },
  assessItemLast: { borderBottomWidth: 0 },
  assessItemPending: { opacity: 0.6 },
  assessGlobalIndexBox: { width: 24, alignItems: 'flex-start', justifyContent: 'center' },
  assessGlobalIndexText: { fontSize: 11, color: theme.colors.text.secondary, fontWeight: '600', opacity: 0.6 },
  assessInfo: { flex: 1 },
  assessNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 1 },
  assessPendingBadge: { backgroundColor: theme.colors.warning, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  assessPendingText: { fontSize: 9, fontWeight: '600', color: '#FFF' },
  assessMeta: { fontSize: 11, color: theme.colors.text.secondary, fontWeight: '500' },
  assessScoreWrap: { alignItems: 'flex-end', justifyContent: 'center' },
  assessScore: { fontSize: 16, fontWeight: '700', color: theme.colors.text.primary, letterSpacing: -0.3 },
  assessScoreScale: { fontSize: 14, fontWeight: '500', color: theme.colors.text.secondary, opacity: 0.6 },
  assessPct: { fontSize: 11, color: theme.colors.text.secondary, fontWeight: '600', marginTop: 1, textTransform: 'uppercase' },
  assessStatus: { fontSize: 12, fontWeight: '600' },
  assessDateDiscreet: { fontSize: 10, color: theme.colors.text.secondary, fontWeight: '500', marginTop: 4, letterSpacing: -0.2 },

  // Action cards
  actionCardContent: { flexDirection: 'column', flex: 1, gap: 4 },
  actionCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  // Section actions
  sectionActions: { flexDirection: 'row' },

  // Empty assessments
  emptyAssessments: { padding: 32, alignItems: 'center' },
});
