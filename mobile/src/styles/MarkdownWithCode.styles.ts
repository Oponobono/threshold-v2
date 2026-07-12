import { StyleSheet } from 'react-native';

export const s = StyleSheet.create({
  markdownContainer: {
    flex: 1,
    width: '100%',
  },
  codeInline: {
    backgroundColor: 'rgba(17, 30, 37, 0.10)',
    color: '#0E7490',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
    fontFamily: 'monospace',
    fontSize: 14,
  },
});

export const markdownStyles = StyleSheet.create({
  body: {
    fontSize: 16,
    color: '#333333',
    lineHeight: 24,
    textAlign: 'left',
  },
  paragraph: {
    marginTop: 4,
    marginBottom: 4,
  },
});
