import { StyleSheet } from 'react-native';
import { theme } from './theme';

export const chatStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  closeBtn: {
    width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
  },
  headerTitleContainer: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
  },
  headerTitle: {
    fontSize: 18, fontWeight: '800', color: theme.colors.text.primary,
  },
  badge: {
    backgroundColor: `${theme.colors.primary}20`,
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, marginLeft: 4,
  },
  badgeText: {
    fontSize: 11, fontWeight: '700', color: theme.colors.primary,
  },
  loadingContainer: {
    flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12,
  },
  loadingText: {
    fontSize: 16, fontWeight: '700', color: theme.colors.text.primary, marginTop: 8,
  },
  loadingSub: {
    fontSize: 14, color: theme.colors.text.secondary, textAlign: 'center',
  },
  chatList: {
    padding: 16, paddingBottom: 32,
  },
  messageBubble: {
    flexDirection: 'row', marginBottom: 16, alignItems: 'flex-end',
  },
  messageUser: {
    justifyContent: 'flex-end',
  },
  messageBot: {
    justifyContent: 'flex-start',
  },
  botIcon: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: `${theme.colors.primary}15`,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 8,
  },
  messageContent: {
    maxWidth: '80%', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 20,
  },
  messageContentUser: {
    backgroundColor: theme.colors.primary, borderBottomRightRadius: 4,
  },
  messageContentBot: {
    backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15, lineHeight: 22,
  },
  messageTextUser: {
    color: '#fff',
  },
  messageTextBot: {
    color: theme.colors.text.primary,
  },
  inputContainer: {
    paddingHorizontal: 16, paddingTop: 12,
    borderTopWidth: 1, borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.background,
  },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 10,
  },
  input: {
    flex: 1, backgroundColor: theme.colors.card,
    borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 24, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12,
    fontSize: 15, color: theme.colors.text.primary,
    maxHeight: 120, minHeight: 48,
  },
  sendBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: theme.colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: theme.colors.border,
  },
});
