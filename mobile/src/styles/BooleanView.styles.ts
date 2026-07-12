import { StyleSheet } from 'react-native';
import { theme } from './theme';

export const s = StyleSheet.create({
  hintBadge: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: 'rgba(255,149,0,0.09)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,149,0,0.25)' },
  hintText: { flex: 1, fontSize: 12, color: '#E65100', lineHeight: 17 },
  hintBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.04)', borderWidth: 1, borderColor: '#E0E0E0', marginLeft: 8, flexShrink: 0 },
  hintBtnActive: { backgroundColor: 'rgba(255,149,0,0.12)', borderColor: '#FF9500' },
  explanationBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,122,255,0.08)', borderWidth: 1, borderColor: 'rgba(0,122,255,0.3)', flexShrink: 0 },
  contextBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(92,107,192,0.08)', borderWidth: 1, borderColor: 'rgba(92,107,192,0.3)', flexShrink: 0 },
  questionCard: { backgroundColor: theme.colors.background, borderRadius: 20, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: theme.colors.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  questionLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, color: theme.colors.text.placeholder, marginBottom: 10 },
  questionTextWrapper: { flex: 1, width: '100%', justifyContent: 'flex-start' },
  questionText: { fontSize: 16, fontWeight: '600', color: theme.colors.text.primary, lineHeight: 24 },
  btnRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  boolBtn: { flex: 1, borderRadius: 20, paddingVertical: 22, alignItems: 'center', borderWidth: 2, gap: 8, justifyContent: 'center' },
  boolBtnTrue: { backgroundColor: '#E8F5E9', borderColor: '#81C784' },
  boolBtnFalse: { backgroundColor: '#FFEBEE', borderColor: '#EF9A9A' },
  boolBtnSuccess: { borderWidth: 2.5, borderColor: '#4CAF50' },
  boolBtnError: { borderWidth: 2.5, borderColor: '#EF5350' },
  boolIcon: { fontSize: 32 },
  boolLabel: { fontSize: 15, fontWeight: '800', color: theme.colors.text.primary },
  resultIcon: { position: 'absolute' as any, top: 10, right: 10 },
  explanationBox: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: 'rgba(0,122,255,0.07)', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: 'rgba(0,122,255,0.18)' },
  explanationTitle: { fontSize: 11, fontWeight: '700', color: theme.colors.info, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  explanationText: { fontSize: 13, color: theme.colors.text.primary, lineHeight: 19 },
});
