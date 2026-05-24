import { StyleSheet } from 'react-native';
import { theme } from './theme';
import { globalStyles } from './globalStyles';

export const calendarScreenStyles = StyleSheet.create({
  headerContainer: globalStyles.standardHeader,
  headerTitle: {
    ...globalStyles.screenTitle,
    flex: 1,
  },
  todayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.primary + '15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.primary + '30',
  },
  todayPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: theme.colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  headerRightContainer: {
    gap: 8,
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: 40,
  },
  agendaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  agendaTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.colors.text.primary,
    textTransform: 'capitalize',
    letterSpacing: -0.2,
  },
  agendaBadge: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  agendaBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
