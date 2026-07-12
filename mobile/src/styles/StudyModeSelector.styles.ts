import { StyleSheet } from 'react-native';
import { theme } from './theme';

export const s = StyleSheet.create({
  sectionTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.text.primary, marginBottom: 10 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  modeCard: {
    width: '47.5%', backgroundColor: theme.colors.inputBackground,
    borderRadius: 16, padding: 14, borderWidth: 1.5,
    borderColor: theme.colors.border, alignItems: 'center', gap: 4,
  },
  modeIcon: { fontSize: 26 },
  modeLabel: { fontSize: 13, fontWeight: '700', color: theme.colors.text.primary },
  modeDesc: { fontSize: 11, color: theme.colors.text.secondary, textAlign: 'center' },
  activeDot: { width: 6, height: 6, borderRadius: 3, marginTop: 2 },
});
