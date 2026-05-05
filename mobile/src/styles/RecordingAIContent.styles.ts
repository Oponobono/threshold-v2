import { StyleSheet } from 'react-native';
import { theme } from './theme';

export const localStyles = StyleSheet.create({
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: 12,
    overflow: 'hidden',
  },
  headerTitleContainer: {
    flex: 1,
    paddingLeft: 16,
    paddingVertical: 14,
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
  },
  headerTitle: {
    color: theme.colors.text.primary,
    fontWeight: '700',
    fontSize: 15,
  },
  tabToggle: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
  },
  tabToggleActive: {
    backgroundColor: `${theme.colors.primary}15`,
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    minHeight: 120,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 10,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  actionButtonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 15,
  },
});

export const markdownStyles = StyleSheet.create({
  body: {
    fontSize: 15,
    color: theme.colors.text.primary,
    lineHeight: 24,
  },
  heading1: { fontSize: 20, fontWeight: '700', color: theme.colors.primary, marginTop: 16, marginBottom: 8 },
  heading2: { fontSize: 18, fontWeight: '700', color: theme.colors.primary, marginTop: 16, marginBottom: 8 },
  heading3: { fontSize: 16, fontWeight: '700', color: theme.colors.primary, marginTop: 16, marginBottom: 8 },
  paragraph: { marginBottom: 12 },
  list_item: { marginBottom: 6 },
  bullet_list: { marginTop: 4, marginBottom: 12 },
  strong: { fontWeight: 'bold', color: theme.colors.text.primary },
});
