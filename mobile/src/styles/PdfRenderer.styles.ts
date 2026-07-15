import { StyleSheet } from 'react-native';
import { theme } from './theme';

export const pdfRendererStyles = StyleSheet.create({
  page: {
    padding: 20,
    paddingBottom: 40,
  },
  baseText: {
    fontSize: 14,
    lineHeight: 22,
    color: theme.colors.text.primary,
    marginBottom: 8,
  },
  heading: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.text.primary,
    marginTop: 20,
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  subheading: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text.primary,
    marginTop: 14,
    marginBottom: 6,
  },
  selectedBlock: {
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    borderRadius: 4,
  },
  highlightedBlock: {
    backgroundColor: 'rgba(255, 204, 0, 0.3)',
    borderRadius: 4,
  },
});
