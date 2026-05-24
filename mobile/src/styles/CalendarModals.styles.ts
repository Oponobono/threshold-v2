import { StyleSheet, Dimensions } from 'react-native';
import { theme } from './theme';

const { height: screenHeight } = Dimensions.get('window');

export const modalStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: screenHeight * 0.75,
    backgroundColor: 'transparent',
  },
  content: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  tasksList: {
    gap: 0,
  },
  taskItem: {
    paddingVertical: 12,
    gap: 10,
  },
  taskItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  taskColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  taskName: {
    fontSize: 15,
    fontWeight: '600',
    color: theme.colors.text.primary,
    flex: 1,
  },
  taskDetails: {
    gap: 8,
    marginLeft: 24,
  },
  eventBody: {
    gap: 16,
    paddingVertical: 8,
  },
  eventTitleRow: {
    borderLeftWidth: 4,
    paddingLeft: 12,
    marginBottom: 4,
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text.primary,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 13,
    color: theme.colors.text.secondary,
    flex: 1,
  },
  closeButton: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
