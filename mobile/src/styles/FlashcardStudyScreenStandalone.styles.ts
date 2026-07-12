import { StyleSheet } from 'react-native';
import { theme } from './theme';

export const s = StyleSheet.create({
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    gap: 8,
  },
  titleBlock: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 4,
  },
  deckTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.text.primary,
    maxWidth: '65%',
  },
  inlineBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  inlineBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  counter: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text.secondary,
  },
  // Progress
  progressBg: {
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.border,
    marginBottom: 14,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: 2,
  },
  // Session done
  sessionDone: { alignItems: 'center', paddingVertical: 24, gap: 10 },
  doneEmoji: { fontSize: 52 },
  doneTitle: { fontSize: 22, fontWeight: '700', color: theme.colors.text.primary, letterSpacing: -0.4 },
  doneSubtitle: { fontSize: 14, color: theme.colors.text.secondary, marginBottom: 8 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  statChip: { borderRadius: 14, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center', minWidth: 80 },
  statChipNum: { fontSize: 22, fontWeight: '800' },
  statChipLabel: { fontSize: 11, fontWeight: '600' },
  backBtn: { backgroundColor: theme.colors.primary, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 32, marginTop: 8 },
  backBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  // Feedback Toast
  feedbackToast: {
    position: 'absolute',
    bottom: 80,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    gap: 8,
  },
  feedbackEmoji: { fontSize: 20 },
  feedbackMessage: { fontSize: 14, fontWeight: '600', color: '#333' },
});

export const confusionStyles = StyleSheet.create({
  banner: {
    width: '100%',
    backgroundColor: '#FFFBF0',
    borderWidth: 1.5,
    borderColor: '#FFB300',
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    gap: 6,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#E65100',
  },
  bannerSubtitle: {
    fontSize: 12,
    color: '#795548',
    lineHeight: 17,
    marginBottom: 4,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    borderRadius: 10,
    padding: 10,
    marginTop: 6,
    gap: 8,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  suggestionConcepts: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4A2F00',
    marginBottom: 2,
  },
  suggestionReason: {
    fontSize: 11,
    color: '#795548',
    lineHeight: 15,
  },
  generateBtn: {
    backgroundColor: '#FF8F00',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 90,
    alignItems: 'center',
  },
  generateBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 11,
  },
});
