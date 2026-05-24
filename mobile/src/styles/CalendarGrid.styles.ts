import { StyleSheet } from 'react-native';
import { theme } from './theme';

export const calendarGridStyles = StyleSheet.create({
  calendarCard: {
    backgroundColor: theme.colors.background,
    borderRadius: 24,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
  },
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: theme.colors.inputBackground,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.colors.text.primary,
    textTransform: 'capitalize',
    letterSpacing: -0.3,
  },
  weekLabels: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  weekLabelText: {
    width: '14.28%',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: theme.colors.text.secondary,
    textTransform: 'uppercase',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    width: '14.28%',
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  cellText: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.colors.text.primary,
  },
  selectedCell: {
    backgroundColor: theme.colors.primary,
    borderRadius: 12,
  },
  selectedCellText: {
    color: '#FFF',
    fontWeight: '700',
  },
  todayCell: {
    borderWidth: 1.5,
    borderColor: theme.colors.primary,
    borderRadius: 12,
  },
  todayCellText: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
  dotsContainer: {
    flexDirection: 'row',
    position: 'absolute',
    bottom: 6,
    gap: 3,
  },
  activityDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
});
