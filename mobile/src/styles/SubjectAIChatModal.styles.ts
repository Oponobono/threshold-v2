import { StyleSheet, Platform } from 'react-native';

// ─── Tokens de color ──────────────────────────────────────────────────────────
export const PRIMARY  = '#7B72FF';
export const ASK_CLR  = '#00C896';
const BG_SHEET = '#0E0E18';
const BORDER   = 'rgba(255,255,255,0.08)';
export const TXT_PRI  = '#F0F0F8';
export const TXT_SEC  = 'rgba(240,240,248,0.45)';
const USER_BG  = '#1E1E30';
const AI_BG    = `${PRIMARY}18`;

export const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.62)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: BG_SHEET,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
    height: '92%',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  handle: {
    width: 38, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignSelf: 'center', marginBottom: 16,
  },
  headerContainer: {
    marginBottom: 12,
    paddingHorizontal: 20,
    gap: 12,
  },
  headerTopRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10,
  },
  headerBottomRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 8,
  },
  aiIconWrap: {
    width: 34, height: 34,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  title: {
    fontSize: 16, fontWeight: '800', color: TXT_PRI, letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 11, color: TXT_SEC,
  },
  contextChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: `${ASK_CLR}14`,
    borderRadius: 12, borderWidth: 1, borderColor: `${ASK_CLR}30`,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  contextChipText: {
    fontSize: 11, fontWeight: '700', color: ASK_CLR,
  },
  clearBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: BORDER,
  },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: BORDER,
  },
  goBackBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: BORDER,
    marginRight: 8,
  },

  // Lista de mensajes
  messageList: {
    paddingHorizontal: 16, paddingBottom: 12, paddingTop: 4,
    flexGrow: 1,
  },
  infoBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 8, paddingHorizontal: 16, marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 12, alignSelf: 'center',
  },
  infoBannerText: {
    fontSize: 11, color: TXT_SEC, textAlign: 'center', flexShrink: 1,
  },

  // Estado vacío
  emptyState: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingTop: 40, gap: 12, paddingHorizontal: 24,
  },
  emptyIconWrap: {
    width: 64, height: 64,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
    backgroundColor: 'transparent',
  },
  emptyTitle: {
    fontSize: 18, fontWeight: '800', color: TXT_PRI, letterSpacing: -0.4,
  },
  emptySubtitle: {
    fontSize: 13, color: TXT_SEC, textAlign: 'center', lineHeight: 20,
    marginBottom: 12,
  },
  suggestionChip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    width: '100%', gap: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14, borderWidth: 1, borderColor: BORDER,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  suggestionText: {
    flex: 1, fontSize: 13, color: TXT_PRI, fontWeight: '500',
  },

  // Burbujas de chat
  bubbleRow: {
    flexDirection: 'row', marginBottom: 10, alignItems: 'flex-end',
  },
  bubbleRowUser: { justifyContent: 'flex-end' },
  bubbleRowAI:   { justifyContent: 'flex-start', gap: 8 },
  aiAvatar: {
    width: 26, height: 26,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  bubble: {
    maxWidth: '78%', borderRadius: 18,
    paddingHorizontal: 14, paddingVertical: 10,
    flexShrink: 1,
  },
  bubbleUser: {
    backgroundColor: USER_BG,
    borderBottomRightRadius: 4,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  bubbleAI: {
    backgroundColor: AI_BG,
    borderBottomLeftRadius: 4,
    borderWidth: 1, borderColor: `${PRIMARY}25`,
  },
  bubbleText: { fontSize: 14, lineHeight: 21, flexShrink: 1 },
  bubbleTextUser: { color: TXT_PRI },
  bubbleTextAI:   { color: TXT_PRI },

  // Input
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4,
    borderTopWidth: 1, borderTopColor: BORDER,
    backgroundColor: 'rgba(14,14,24,0.95)',
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 18, borderWidth: 1, borderColor: BORDER,
    color: TXT_PRI, fontSize: 14,
    paddingHorizontal: 14, paddingVertical: 10,
    maxHeight: 100,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 14,
    backgroundColor: PRIMARY,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: PRIMARY,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5, shadowRadius: 10, elevation: 8,
  },
  sendBtnDisabled: {
    opacity: 0.35, shadowOpacity: 0, elevation: 0,
  },
  
  // Selector de proveedor LLM
  providerSelector: {
    flexDirection: 'row', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8, padding: 4,
    borderWidth: 1, borderColor: BORDER,
  },
  providerOption: {
    width: 28, height: 28,
    borderRadius: 6,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  providerOptionActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  providerOptionDisabled: {
    opacity: 0.4,
  },
  providerLabel: {
    fontSize: 14,
  },
  providerLabelActive: {
    fontSize: 14,
  },
  providerLabelDisabled: {
    opacity: 0.5,
  },
  
  // Toast
  toastContainer: {
    position: 'absolute',
    top: 10,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(123,114,255,0.9)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    zIndex: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 6,
  },
  toastText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },

  // Generation panel
  genBtn: {
    borderColor: `${PRIMARY}40`,
    backgroundColor: `${PRIMARY}14`,
  },
  genPanel: {
    position: 'absolute',
    bottom: 80, left: 16, right: 16,
    backgroundColor: '#16162A',
    borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: `${PRIMARY}30`,
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25, shadowRadius: 16, elevation: 12,
    zIndex: 200,
  },
  genPanelHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 6,
  },
  genPanelTitle: { fontSize: 15, fontWeight: '800', color: TXT_PRI },
  genPanelSubtitle: { fontSize: 12, color: TXT_SEC, marginBottom: 14 },
  genCountLabel: { fontSize: 12, fontWeight: '600', color: TXT_PRI, marginTop: 14, marginBottom: 8 },
  genCountInput: {
    backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1, borderColor: BORDER,
    borderRadius: 12, color: TXT_PRI, fontSize: 15,
    paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16,
  },
  genConfirmBtn: {
    backgroundColor: PRIMARY, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45, shadowRadius: 10, elevation: 8,
  },
  genConfirmBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  // Lightbox
  lightboxOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
});

// ─── Markdown ─────────────────────────────────────────────────────────────────
export const markdownStyles = StyleSheet.create({
  body: {
    fontSize: 14,
    lineHeight: 21,
    color: TXT_PRI,
  },
  strong: {
    fontWeight: 'bold',
  },
  em: {
    fontStyle: 'italic',
  },
  link: {
    color: PRIMARY,
    textDecorationLine: 'underline',
  },
  heading1: { fontSize: 18, fontWeight: 'bold', color: TXT_PRI, marginTop: 10, marginBottom: 4 },
  heading2: { fontSize: 16, fontWeight: 'bold', color: TXT_PRI, marginTop: 8, marginBottom: 4 },
  heading3: { fontSize: 15, fontWeight: 'bold', color: TXT_PRI, marginTop: 6, marginBottom: 4 },
  bullet_list: { marginTop: 4, marginBottom: 4 },
  ordered_list: { marginTop: 4, marginBottom: 4 },
  list_item: { marginBottom: 4 },
  paragraph: { marginTop: 4, marginBottom: 4 },
  code_inline: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 4, borderRadius: 4, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  code_block: { backgroundColor: 'rgba(0,0,0,0.3)', padding: 10, borderRadius: 8, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginVertical: 6 },
  table: { marginVertical: 10 },
  thead: { display: 'none' },
  tbody: { display: 'none' },
  tr: { display: 'none' },
  th: { display: 'none' },
  td: { display: 'none' },
});

// ─── Estilos para tablas desplazables ──────────────────────────────────────────
export const tableStyles = StyleSheet.create({
  container: {
    marginVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: `${PRIMARY}25`,
    backgroundColor: 'rgba(0,0,0,0.15)',
    overflow: 'hidden',
  } as any,
  scrollView: {
    flexGrow: 0,
  } as any,
  table: {
    // borderCollapse no existe en React Native
  } as any,
  row: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: `${PRIMARY}15`,
  } as any,
  cell: {
    width: 120,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRightWidth: 1,
    borderRightColor: `${PRIMARY}15`,
    justifyContent: 'center',
  } as any,
  headerCell: {
    backgroundColor: `${PRIMARY}20`,
    borderBottomWidth: 2,
    borderBottomColor: `${PRIMARY}40`,
  } as any,
  cellText: {
    fontSize: 12,
    lineHeight: 16,
    color: TXT_PRI,
  } as any,
  headerText: {
    fontSize: 12,
    fontWeight: '700',
    color: PRIMARY,
  } as any,
});
