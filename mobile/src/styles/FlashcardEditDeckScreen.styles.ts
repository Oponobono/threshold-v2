import { StyleSheet, Platform } from 'react-native';
import { theme } from './theme';

export const styles = StyleSheet.create({
  container: {
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  subjectScrollContainer: {
    paddingHorizontal: 0,
    paddingVertical: 4,
    gap: 8,
  },
  subjectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: theme.colors.inputBackground,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
    minWidth: 110,
  },
  subjectBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 6,
  },
  subjectName: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.text.primary,
    flex: 1,
  },
  submitBtn: {
    backgroundColor: theme.colors.primary,
    borderRadius: 28,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Platform.OS === 'ios' ? 12 : 16,
  },
  submitBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
  },
});
