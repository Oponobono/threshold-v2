import { StyleSheet } from 'react-native';
import { theme } from './theme';

export const documentSelectionToolbarStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.colors.card,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    paddingBottom: 20,
  },
  preview: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  previewText: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.primary,
  },
  divider: {
    width: 1,
    height: 20,
    backgroundColor: theme.colors.border,
  },
});
