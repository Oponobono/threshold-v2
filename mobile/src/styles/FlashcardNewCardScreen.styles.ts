import { StyleSheet } from 'react-native';
import { theme } from './theme';

export const ls = StyleSheet.create({
  sectionLabel: { fontSize: 14, fontWeight: '600', color: theme.colors.text.secondary, textAlign: 'center', marginBottom: 16, marginTop: 8 },
  typeGrid: { gap: 12 },
  typeCard: { borderRadius: 18, padding: 20, borderWidth: 2, alignItems: 'center', gap: 6 },
  typeIcon: { fontSize: 34 },
  typeLabel: { fontSize: 16, fontWeight: '800' },
  typeDesc: { fontSize: 12, color: theme.colors.text.secondary },
  textarea: { height: 90, textAlignVertical: 'top' },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.colors.inputBackground, borderRadius: 14, padding: 10, marginBottom: 8, borderWidth: 1.5, borderColor: theme.colors.border },
  optionRowActive: { borderColor: '#00897B', backgroundColor: '#E0F2F1' },
  optionLabel: { width: 30, height: 30, borderRadius: 8, backgroundColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  optionLabelText: { fontSize: 13, fontWeight: '800', color: '#fff' },
  optionInput: { flex: 1, fontSize: 14, color: theme.colors.text.primary },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 14, backgroundColor: theme.colors.inputBackground, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border },
  switchLabel: { fontSize: 15, fontWeight: '700', color: theme.colors.text.primary },
  directionRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  directionPill: { flex: 1, paddingVertical: 10, paddingHorizontal: 6, borderRadius: 12, borderWidth: 1.5, borderColor: theme.colors.border, alignItems: 'center', gap: 2, backgroundColor: theme.colors.inputBackground },
  directionPillActive: { borderColor: '#5C6BC0', backgroundColor: '#EDE7F6' },
  directionIcon: { fontSize: 18, color: theme.colors.text.secondary },
  directionIconActive: { color: '#5C6BC0' },
  directionLabel: { fontSize: 11, fontWeight: '600', color: theme.colors.text.secondary, textAlign: 'center' },
  directionLabelActive: { color: '#5C6BC0' },
});
