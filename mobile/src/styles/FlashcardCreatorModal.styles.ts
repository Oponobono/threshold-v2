import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  title: { fontSize: 18, fontWeight: '600' },
  closeBtn: { fontSize: 24, color: '#999' },
  content: { flex: 1, padding: 16 },
  inputSection: { marginTop: 8 },
  subtitle: { fontSize: 13, color: '#666', marginBottom: 18, lineHeight: 19 },
  label: { fontSize: 15, fontWeight: '600', marginBottom: 6 },
  hint: { fontSize: 12, color: '#999', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12, fontSize: 16, marginBottom: 20 },
  previewSection: { marginTop: 8 },
  previewTitle: { fontSize: 16, fontWeight: '600', marginBottom: 6 },
  cardCountText: { fontSize: 13, color: '#666', marginBottom: 16 },
  cardPreview: { backgroundColor: '#f9f9f9', borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#eee' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardIndex: { fontSize: 13, fontWeight: '600', color: '#555' },
  deleteBtn: { fontSize: 13, color: '#ff6b6b' },
  cardLabel: { fontSize: 11, fontWeight: '600', color: '#999', marginBottom: 8 },
  cardInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 13, marginBottom: 10, minHeight: 50 },
  optionsGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    justifyContent: 'space-between', 
    marginBottom: 10, 
    gap: 8 
  },
  gridItem: { 
    width: '48%', 
  },
  optionBox: { 
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff', 
    borderWidth: 2, 
    borderColor: '#ddd', 
    borderRadius: 8, 
    padding: 10, 
    minHeight: 60,
  },
  optionBoxCorrect: { 
    borderColor: '#4CAF50', 
    backgroundColor: '#f1f8f5' 
  },
  optionInput: { 
    flex: 1,
    fontSize: 12, 
    color: '#333',
  },
  correctMark: { 
    fontSize: 18, 
    color: '#4CAF50', 
    fontWeight: '700',
    marginLeft: 8,
  },
  booleanRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginBottom: 10, 
    gap: 8 
  },
  booleanBox: { 
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff', 
    borderWidth: 2, 
    borderColor: '#ddd', 
    borderRadius: 8, 
    padding: 12, 
    minHeight: 50,
  },
  booleanBoxCorrect: { 
    borderColor: '#4CAF50', 
    backgroundColor: '#f1f8f5' 
  },
  booleanText: { 
    fontSize: 14, 
    fontWeight: '600', 
    color: '#333',
  },
  completeSection: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  successText: { fontSize: 20, fontWeight: '700', color: '#4CAF50', marginBottom: 12 },
  completeMessage: { fontSize: 14, color: '#666' },
  directionRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  directionBtn: { flex: 1, paddingVertical: 8, paddingHorizontal: 4, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', alignItems: 'center', backgroundColor: '#fff' },
  directionBtnActive: { borderColor: '#4CAF50', backgroundColor: '#f1f8f5' },
  directionText: { fontSize: 12, color: '#666', fontWeight: '500' },
  directionTextActive: { color: '#4CAF50', fontWeight: '700' },
});
