import { StyleSheet } from 'react-native';

const BG_SHEET = '#0E0E18';
const BG_CARD = '#1C1C2A';
const BORDER = 'rgba(255,255,255,0.08)';
export const TXT_PRI = '#F0F0F8';
const PAD = 20;

export const PRIMARY = '#7B72FF';
export const ASK_CLR = '#00C896';
export const TXT_SEC = 'rgba(240,240,248,0.45)';

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
    height: '92%',
    paddingTop: 12,
    overflow: 'hidden',
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  handle: {
    width: 38, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignSelf: 'center', marginBottom: 18,
  },
  header: {
    flexDirection: 'row', alignItems: 'center',
    gap: 12, marginBottom: 12,
    paddingHorizontal: PAD,
  },
  aiIconWrap: {
    width: 34, height: 34,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  title: {
    fontSize: 17, fontWeight: '800', color: TXT_PRI, letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 12, color: TXT_SEC, marginTop: 2,
  },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: BORDER,
  },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: PAD, marginBottom: 12,
    paddingHorizontal: 12, height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: BORDER,
  },
  searchInput: {
    flex: 1,
    fontSize: 14, color: TXT_PRI,
    paddingVertical: 0,
  },
  filterRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: PAD, paddingBottom: 14,
  },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  chipActive: {
    borderColor: `${PRIMARY}60`,
    backgroundColor: `${PRIMARY}18`,
  },
  chipText: { fontSize: 13, fontWeight: '600', color: TXT_SEC },
  chipTextActive: { color: PRIMARY },
  chipBadge: {
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
  },
  chipBadgeActive: { backgroundColor: `${PRIMARY}22` },
  chipBadgeText: { fontSize: 10, fontWeight: '700', color: TXT_SEC },
  listContent: {
    paddingHorizontal: PAD, paddingBottom: 24, paddingTop: 4,
  },
  listItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, paddingHorizontal: 12,
    marginBottom: 6,
    borderRadius: 14,
    backgroundColor: BG_CARD,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  listItemSelected: {
    backgroundColor: `${PRIMARY}12`,
    borderColor: `${PRIMARY}40`,
  },
  listIconBg: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 10,
  },
  listInfo: {
    flex: 1, marginRight: 8,
  },
  listLabel: {
    fontSize: 13, fontWeight: '600', color: TXT_PRI,
  },
  listMeta: {
    fontSize: 10, color: TXT_SEC, marginTop: 2,
  },
  listCheck: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  listCheckActive: {
    backgroundColor: PRIMARY,
    borderWidth: 0,
  },
  seeMoreBtn: {
    alignItems: 'center', paddingVertical: 14, marginTop: 2,
  },
  seeMoreText: {
    fontSize: 13, fontWeight: '700', color: PRIMARY,
  },
  loadingText: {
    fontSize: 14, fontWeight: '600', color: PRIMARY, marginTop: 12,
  },
  emptyState: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 60, gap: 12, paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 16, fontWeight: '700', color: TXT_PRI,
  },
  emptyText: {
    fontSize: 13, color: TXT_SEC,
    textAlign: 'center', lineHeight: 20,
  },
  actionBar: {
    paddingHorizontal: PAD,
    paddingTop: 14,
    paddingBottom: 6,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    backgroundColor: 'rgba(14,14,24,0.88)',
    gap: 10,
  },
  counterBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'center',
    backgroundColor: `${PRIMARY}15`,
    borderRadius: 20, borderWidth: 1, borderColor: `${PRIMARY}30`,
    paddingHorizontal: 14, paddingVertical: 6,
  },
  counterText: {
    fontSize: 12, fontWeight: '700', color: PRIMARY,
  },
  btnRow: {
    flexDirection: 'row', gap: 10,
  },
  btn: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8,
    paddingVertical: 15, borderRadius: 18,
  },
  btnPrimary: {
    backgroundColor: ASK_CLR,
    shadowColor: ASK_CLR,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  btnPrimaryText: {
    color: '#fff', fontSize: 14, fontWeight: '800', letterSpacing: -0.2,
  },
  btnSecondary: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  btnSecondaryText: {
    color: TXT_PRI, fontSize: 14, fontWeight: '700', letterSpacing: -0.2,
  },
  btnDisabled: {
    opacity: 0.35,
    shadowOpacity: 0,
    elevation: 0,
  },
  toast: {
    position: 'absolute',
    bottom: 120,
    left: PAD,
    right: PAD,
    backgroundColor: 'rgba(20,20,36,0.97)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,200,60,0.40)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 14,
  },
  toastText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFD96A',
    lineHeight: 19,
    textAlign: 'center',
  },
});
