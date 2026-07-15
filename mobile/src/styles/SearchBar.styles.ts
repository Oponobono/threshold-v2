import { StyleSheet } from 'react-native';
import { theme } from './theme';

export const searchBarStyles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 12,
    paddingVertical: 0,
    fontSize: 15,
    color: theme.colors.text.primary,
    backgroundColor: theme.colors.background,
  },
  clearBtn: {
    padding: 6,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  resultCount: {
    fontSize: 12,
    color: theme.colors.text.secondary,
  },
  navBtns: {
    flexDirection: 'row',
    gap: 4,
  },
  navBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: `${theme.colors.primary}15`,
  },
  navBtnDisabled: {
    backgroundColor: 'transparent',
  },
  navBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  navBtnTextDisabled: {
    color: theme.colors.border,
  },
});
