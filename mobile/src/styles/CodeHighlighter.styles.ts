import { StyleSheet } from 'react-native';

export const s = StyleSheet.create({
  codeBlockContainer: {
    marginVertical: 10,
    borderRadius: 10,
    overflow: 'hidden',
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: '#111E25',
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  languageText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    fontFamily: 'monospace',
    textTransform: 'uppercase',
  },
  codeWrapper: {
    padding: 14,
  },
  codeText: {
    fontSize: 13,
    fontFamily: 'monospace',
    lineHeight: 18,
    color: '#FFFFFF',
  },
});
