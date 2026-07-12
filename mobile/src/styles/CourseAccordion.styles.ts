import { StyleSheet } from 'react-native';
import { theme } from './theme';

export const styles = StyleSheet.create({
  wrapper: {
    marginTop: 16,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'transparent',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingRight: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  icon: {
    marginRight: 8,
  },
  title: {
    color: theme.colors.text.primary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginRight: 8,
    flexShrink: 1,
  },
  platformBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  platformText: {
    color: theme.colors.text.secondary,
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  linkBtn: {
    padding: 4,
  },
});
