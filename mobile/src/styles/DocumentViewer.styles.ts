import { StyleSheet } from 'react-native';
import { theme } from './theme';

export const documentViewerStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: theme.colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  backBtn: {
    marginRight: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    color: theme.colors.text.primary,
  },
  errorText: {
    fontSize: 15,
    color: theme.colors.text.primary,
    textAlign: 'center',
  },
  errorHint: {
    fontSize: 12,
    color: theme.colors.text.secondary,
    textAlign: 'center',
  },
});
