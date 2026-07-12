import { StyleSheet } from 'react-native';
import { Dimensions } from 'react-native';
import { theme } from './theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
export const HERO_CARD_WIDTH = SCREEN_WIDTH - 48;

export const cHCardStyles = StyleSheet.create({
  card: {
    width: HERO_CARD_WIDTH,
    backgroundColor: theme.colors.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1.5,
    borderColor: 'transparent',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  cardActive: {
    borderColor: theme.colors.primary,
    backgroundColor: '#FAFBFF',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  platformBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 100,
    borderWidth: 1,
  },
  platformText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  momentumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255, 149, 0, 0.10)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
  },
  momentumText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FF9500',
  },
  instructorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  instructorText: {
    fontSize: 12,
    color: theme.colors.text.placeholder,
    fontWeight: '500',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 8,
  },
  tagBadge: {
    backgroundColor: theme.colors.primary + '18',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  tagText: {
    fontSize: 10,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  mainUrlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  mainUrlText: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  courseName: {
    fontSize: 20,
    fontWeight: '800',
    color: theme.colors.text.primary,
    letterSpacing: -0.4,
    lineHeight: 26,
    marginBottom: 6,
  },
  urlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 16,
  },
  urlText: {
    fontSize: 11,
    color: theme.colors.text.placeholder,
    fontWeight: '500',
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: theme.colors.border,
    marginBottom: 14,
    opacity: 0.6,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: theme.colors.text.primary,
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: 10,
    color: theme.colors.text.placeholder,
    fontWeight: '500',
    marginTop: 1,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: theme.colors.border,
  },
  progressBarBg: {
    height: 3,
    backgroundColor: theme.colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: theme.colors.success,
    borderRadius: 4,
  },
  cardAllGlobal: {
    backgroundColor: theme.colors.card,
    borderColor: 'transparent',
  },
  cardActiveGlobal: {
    borderColor: theme.colors.primary,
    borderWidth: 1.5,
    backgroundColor: '#FAFBFF',
  },
});
