import { StyleSheet } from 'react-native';
import { theme } from './theme';

export const styles = StyleSheet.create({
  scroll: {
    maxHeight: 42,
    flexGrow: 0,
    minHeight: 42,
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 8,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  pillActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.colors.text.secondary,
    maxWidth: 120,
  },
  pillTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
});
