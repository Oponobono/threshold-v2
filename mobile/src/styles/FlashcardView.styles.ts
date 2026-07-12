import { StyleSheet } from 'react-native';
import { theme } from './theme';

export const s = StyleSheet.create({
  container: { flex: 1, marginTop: 8 },
  scrollContent: { flexGrow: 1, justifyContent: 'flex-start', paddingBottom: 32 },
  hintBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: 'rgba(255,149,0,0.10)', borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 10,
    borderWidth: 1, borderColor: 'rgba(255,149,0,0.25)',
  },
  hintText: { flex: 1, fontSize: 12, color: '#E65100', lineHeight: 17 },
  flipWrapper: { width: '100%', marginBottom: 16 },
  relativeCard: { position: 'relative' },
  absoluteCard: { position: 'absolute', top: 0, left: 0, right: 0 },
  card: {
    borderRadius: 24, padding: 20, minHeight: 250, justifyContent: 'center',
    backfaceVisibility: 'hidden', borderWidth: 1, borderColor: theme.colors.border,
  } as any,
  cardContentWrapper: { width: '100%', paddingTop: 20, paddingBottom: 24 },
  cardFront: {
    backgroundColor: theme.colors.background,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
  },
  cardBack: { backgroundColor: theme.colors.primary + '08' },
  sideLabel: {
    position: 'absolute', top: 12, left: 20,
    fontSize: 10, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 1, color: theme.colors.text.placeholder,
  },
  hintBtn: {
    position: 'absolute', bottom: 36, right: 14,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: theme.colors.inputBackground,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: theme.colors.border,
  },
  hintBtnActive: { backgroundColor: 'rgba(255,149,0,0.12)', borderColor: '#FF9500' },
  explanationBtn: {
    position: 'absolute', bottom: 36, right: 14,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,122,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(0,122,255,0.3)',
  },
  contextBtn: {
    position: 'absolute', bottom: 36, left: 14,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(92,107,192,0.08)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(92,107,192,0.3)',
  },
  tapHint: {
    position: 'absolute', bottom: 12, left: 20,
    flexDirection: 'row', alignItems: 'center', gap: 4,
  },
  tapHintText: { fontSize: 11, color: theme.colors.text.placeholder },
  ratingRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  ratingBtn: {
    flex: 1, borderRadius: 16, paddingVertical: 14,
    alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border, gap: 4,
  },
  ratingHard: { backgroundColor: '#FFF3E0', borderColor: '#FFCC80' },
  ratingEasy: { backgroundColor: '#E8F5E9', borderColor: '#A5D6A7' },
  ratingEmoji: { fontSize: 22 },
  ratingLabel: { fontSize: 13, fontWeight: '700' },
});
