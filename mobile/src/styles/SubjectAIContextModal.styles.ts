import { StyleSheet } from 'react-native';
import { theme } from './theme';

export const contextModalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    height: '88%',
    paddingTop: 12,
    paddingHorizontal: 20,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: theme.colors.border,
    alignSelf: 'center', marginBottom: 16,
  },
  header: {
    flexDirection: 'row', alignItems: 'flex-start',
    gap: 12, marginBottom: 12,
  },
  title: {
    fontSize: 18, fontWeight: '800',
    color: theme.colors.text.primary, letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13, marginTop: 4,
    color: theme.colors.text.secondary, lineHeight: 18,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: theme.colors.card,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: theme.colors.border,
  },
  selectionBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: `${theme.colors.primary}15`,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
    alignSelf: 'flex-start', marginBottom: 14,
  },
  selectionBadgeText: {
    fontSize: 12, fontWeight: '700', color: theme.colors.primary,
  },
  scrollContent: {
    paddingTop: 8, paddingBottom: 20,
  },
  emptyState: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 40, gap: 10,
  },
  emptyTitle: {
    fontSize: 15, fontWeight: '700', color: theme.colors.text.primary,
  },
  emptyText: {
    fontSize: 13, color: theme.colors.text.secondary,
    textAlign: 'center', lineHeight: 19,
  },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 16,
  },
  askBtn: {
    backgroundColor: '#10B981',
  },
  generateBtn: {
    backgroundColor: theme.colors.primary,
  },
  actionBtnDisabled: {
    backgroundColor: theme.colors.border,
  },
  actionBtnText: {
    color: '#fff', fontWeight: '700', fontSize: 13,
  },
});
