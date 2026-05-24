import { StyleSheet } from 'react-native';
import { theme } from './theme';

export const calendarAgendaStyles = StyleSheet.create({
  eventsColumn: {
    gap: 10,
  },
  eventItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.colors.border,
    elevation: 1,
  },
  colorBar: {
    width: 4,
    height: '100%',
    minHeight: 36,
    borderRadius: 2,
    marginRight: 12,
  },
  eventTextContainer: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text.primary,
  },
  eventTime: {
    fontSize: 13,
    color: theme.colors.text.secondary,
    marginTop: 2,
    fontWeight: '400',
  },
  eventTypeBadge: {
    width: 30,
    height: 30,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 10,
  },
  emptyText: {
    color: theme.colors.text.secondary,
    fontSize: 14,
    fontWeight: '500',
  },
});
