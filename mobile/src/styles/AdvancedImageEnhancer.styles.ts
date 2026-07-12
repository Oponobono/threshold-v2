import { StyleSheet } from 'react-native';
import { theme } from './theme';

export const advancedImageEnhancerStyles = StyleSheet.create({
  container: { flex: 1, marginBottom: 16 },
  previewContainer: { flex: 1, backgroundColor: '#000', borderRadius: 16, overflow: 'hidden', marginBottom: 16, justifyContent: 'center' },
  loader: { flex: 1 },
  canvas: { flex: 1 },
  activeFilterBadge: { position: 'absolute', top: 12, right: 12, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  activeFilterText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  filtersContainer: { height: 100 },
  filtersTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.text.primary, marginBottom: 8 },
  filtersScroll: { gap: 12, paddingRight: 16 },
  filterBtn: { alignItems: 'center', width: 72 },
  filterBtnActive: { opacity: 1 },
  filterIconContainer: { width: 52, height: 52, borderRadius: 26, backgroundColor: theme.colors.inputBackground, borderWidth: 1, borderColor: theme.colors.border, justifyContent: 'center', alignItems: 'center', marginBottom: 6 },
  filterIconContainerActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '10' },
  filterText: { fontSize: 11, color: theme.colors.text.secondary, fontWeight: '500', textAlign: 'center' },
  filterTextActive: { color: theme.colors.text.primary, fontWeight: '700' },
});
