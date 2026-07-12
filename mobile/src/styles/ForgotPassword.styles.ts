import { StyleSheet } from 'react-native';

export const forgotPasswordStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F9F9F7',
  },
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 8,
    gap: 4,
    alignSelf: 'flex-start',
  },
  backText: {
    fontSize: 15,
    color: '#8A8A8E',
    fontWeight: '400',
  },
  iconContainer: {
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 24,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(197, 160, 89, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(197, 160, 89, 0.30)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B6B6B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 8,
  },
  form: {
    gap: 4,
  },
  otpSection: {
    marginBottom: 4,
  },
  otpLabel: {
    fontSize: 12,
    color: '#8A8A8E',
    letterSpacing: 3,
    fontFamily: 'monospace',
    textAlign: 'center',
    marginBottom: 4,
  },
  resendBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
  resendText: {
    fontSize: 14,
    color: '#C5A059',
    fontWeight: '500',
  },
});
