import { StyleSheet, Dimensions } from 'react-native';
import { theme } from './theme';
import { globalStyles } from './globalStyles';

const SCREEN_W = Dimensions.get('window').width;
const GRID_COL_W = (SCREEN_W - theme.spacing.lg * 2 - 16 - 1) / 2;

export const galleryStyles = StyleSheet.create({
  header: globalStyles.standardHeader,
  logoText: globalStyles.screenTitle,
  scanBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: theme.colors.inputBackground,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: theme.borderRadius.full, borderWidth: 1, borderColor: theme.colors.border,
  },
  scanText: { fontSize: theme.typography.sizes.sm, fontWeight: '600', color: theme.colors.text.primary },
  tabRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: theme.spacing.lg, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
    gap: 4,
  },
  searchBarContainer: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: 12,
    backgroundColor: theme.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  searchInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.inputBackground,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: theme.typography.sizes.md,
    color: theme.colors.text.primary,
    height: '100%',
  },
  tab: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingHorizontal: 13, paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: theme.colors.border,
    backgroundColor: 'transparent',
  },
  tabActive: { backgroundColor: theme.colors.text.primary, borderColor: theme.colors.text.primary },
  tabText: { fontSize: 13, fontWeight: '500', color: theme.colors.text.secondary, letterSpacing: -0.1 },
  tabTextActive: { fontWeight: '700', color: theme.colors.white },
  itemCount: { marginLeft: 'auto', fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary },
  settingsBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: theme.spacing.lg, paddingVertical: 10,
    backgroundColor: theme.colors.inputBackground,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  settingsLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  settingsThumb: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: theme.colors.border,
  },
  settingsTitle: { fontSize: theme.typography.sizes.sm, fontWeight: '700', color: theme.colors.text.primary },
  settingsSubtitle: { fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary, marginTop: 1 },
  ocrBtn: {
    backgroundColor: theme.colors.primaryTransparent.light,
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: theme.borderRadius.full, marginLeft: 8,
  },
  ocrBtnText: { fontSize: theme.typography.sizes.xs, fontWeight: '700', color: theme.colors.primary },
  scroll: { paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.lg, paddingBottom: 40 },
  section: { marginBottom: theme.spacing.xl },
  sectionHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
  },
  sectionTitle: { fontSize: theme.typography.sizes.md, fontWeight: '800', color: theme.colors.text.primary },
  sectionMeta: { fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary },
  starredRow: { gap: 12, paddingVertical: 4 },
  starredCard: {
    width: 100, borderRadius: theme.borderRadius.lg,
    overflow: 'hidden', backgroundColor: theme.colors.background,
    borderWidth: 1, borderColor: theme.colors.border, ...globalStyles.shadow,
  },
  starredImage: { width: '100%', height: 80 },
  starredSubject: { fontSize: theme.typography.sizes.sm, fontWeight: '700', color: theme.colors.text.primary, padding: 6, paddingBottom: 0 },
  starredDate: { fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary, paddingHorizontal: 6, paddingBottom: 4 },
  starBtn: {
    position: 'absolute', bottom: 28, right: 6,
    backgroundColor: theme.colors.background + 'cc',
    borderRadius: 10, padding: 3,
  },
  gridContainer: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 16,
  },
  gridCard: {
    width: GRID_COL_W,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1, borderColor: theme.colors.border, ...globalStyles.shadow,
  },
  gridImage: { width: '100%', height: 110 },
  ocrOverlay: {
    position: 'absolute', top: 8, right: 8,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: theme.colors.background + 'ee',
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: theme.borderRadius.full,
  },
  ocrOverlayText: { fontSize: theme.typography.sizes.xs, fontWeight: '700', color: theme.colors.primary },
  gridInfo: { padding: 8 },
  gridSubject: { fontSize: theme.typography.sizes.xs, fontWeight: '700', color: theme.colors.text.primary },
  gridDate: { fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary, marginBottom: 4 },
  gridOcr: { fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary, fontStyle: 'italic', marginBottom: 8 },
  attachBtn: {
    backgroundColor: theme.colors.text.primary,
    paddingVertical: 5, borderRadius: theme.borderRadius.full, alignItems: 'center',
  },
  attachBtnText: { fontSize: theme.typography.sizes.xs, fontWeight: '700', color: theme.colors.white },
  hintRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingTop: 4,
  },
  hintText: { fontSize: theme.typography.sizes.xs, color: theme.colors.text.secondary, textAlign: 'center' },
});
