/**
 * CustomAlert.tsx
 * Drop-in replacement for React Native's Alert.alert().
 *
 * Usage (in any component):
 *   const { showAlert } = useCustomAlert();
 *   showAlert({ title: 'Éxito', type: 'success', buttons: [{ text: 'OK' }] });
 *
 * Usage (outside React, e.g. hooks without UI):
 *   import { alertRef } from './CustomAlert';
 *   alertRef.show({ title: 'Error', type: 'error' });
 */
import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AlertType = 'success' | 'error' | 'warning' | 'info' | 'confirm' | 'biometric';

export interface AlertButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

export interface AlertOptions {
  title: string;
  message?: string;
  type?: AlertType;
  buttons?: AlertButton[];
}

interface AlertContextType {
  showAlert: (options: AlertOptions) => void;
}

// ─── Global ref so non-component code (hooks, utils) can trigger alerts ───────
type ShowFn = (opts: AlertOptions) => void;
export const alertRef: { show: ShowFn } = {
  show: () => console.warn('[CustomAlert] Provider not mounted yet.'),
};

// ─── Context ──────────────────────────────────────────────────────────────────

const AlertContext = createContext<AlertContextType>({ showAlert: () => {} });
export const useCustomAlert = () => useContext(AlertContext);

// ─── Icon & accent per type ───────────────────────────────────────────────────

const TYPE_META: Record<AlertType, { icon: string; color: string }> = {
  success:   { icon: 'checkmark-circle',  color: '#22C55E' },
  error:     { icon: 'close-circle',       color: '#EF4444' },
  warning:   { icon: 'warning',            color: '#F59E0B' },
  info:      { icon: 'information-circle', color: '#3B82F6' },
  confirm:   { icon: 'help-circle',        color: '#111111' },
  biometric: { icon: 'finger-print',       color: '#111111' },
};

// ─── Provider ─────────────────────────────────────────────────────────────────

interface InternalState extends AlertOptions { visible: boolean }
const INITIAL: InternalState = { visible: false, title: '' };


export const CustomAlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<InternalState>(INITIAL);
  const scaleAnim  = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  const showAlert = useCallback((options: AlertOptions) => {
    setState({ ...options, visible: true });
    scaleAnim.setValue(0.85);
    opacityAnim.setValue(0);
    Animated.parallel([
      Animated.spring(scaleAnim,   { toValue: 1, useNativeDriver: true, damping: 18, stiffness: 280 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
  }, [opacityAnim, scaleAnim]);

  // Wire up the global ref so non-component code can use it
  alertRef.show = showAlert;

  const dismiss = (cb?: () => void) => {
    Animated.parallel([
      Animated.timing(scaleAnim,   { toValue: 0.9, duration: 130, useNativeDriver: true }),
      Animated.timing(opacityAnim, { toValue: 0,   duration: 130, useNativeDriver: true }),
    ]).start(() => {
      setState(INITIAL);
      cb?.();
    });
  };

  const meta    = TYPE_META[state.type ?? 'info'];
  const buttons: AlertButton[] = state.buttons?.length
    ? state.buttons
    : [{ text: 'Aceptar', style: 'default' }];

  return (
    <AlertContext.Provider value={{ showAlert }}>
      {children}

      <Modal transparent visible={state.visible} animationType="none" statusBarTranslucent>
        <Animated.View style={[styles.overlay, { opacity: opacityAnim, paddingBottom: Math.max(insets.bottom + 80, 100) }]}>
          <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>

            {/* Icon */}
            <View style={[styles.iconCircle, { backgroundColor: `${meta.color}14` }]}>
              <Ionicons name={meta.icon as any} size={34} color={meta.color} />
            </View>

            {/* Title */}
            <Text style={styles.title}>{state.title}</Text>

            {/* Message */}
            {state.message ? <Text style={styles.message}>{state.message}</Text> : null}

            {/* Divider */}
            <View style={styles.divider} />

            {/* Buttons */}
            <View style={[styles.buttonRow, buttons.length === 1 && { justifyContent: 'center' }]}>
              {buttons.map((btn, i) => {
                const isDestructive = btn.style === 'destructive';
                const isCancel      = btn.style === 'cancel';
                const isPrimary     = !isDestructive && !isCancel;
                return (
                  <TouchableOpacity
                    key={i}
                    style={[
                      styles.btn,
                      buttons.length === 1 && styles.btnFull,
                      isPrimary     && styles.btnPrimary,
                      isDestructive && styles.btnDestructive,
                      isCancel      && styles.btnCancel,
                      i > 0 && { marginLeft: 10 },
                    ]}
                    activeOpacity={0.75}
                    onPress={() => dismiss(btn.onPress)}
                  >
                    <Text style={[
                      styles.btnText,
                      isPrimary     && styles.btnTextPrimary,
                      isDestructive && styles.btnTextDestructive,
                      isCancel      && styles.btnTextCancel,
                    ]}>
                      {btn.text}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

          </Animated.View>
        </Animated.View>
      </Modal>
    </AlertContext.Provider>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 28,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: theme.colors.white,
    borderRadius: 24,
    paddingTop: 32,
    paddingBottom: 24,
    paddingHorizontal: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 16,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text.primary,
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  message: {
    fontSize: 14,
    color: theme.colors.text.secondary,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 4,
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: theme.colors.border,
    marginVertical: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
  },
  btn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnFull: { flex: 1 },
  btnPrimary:     { backgroundColor: theme.colors.primary },
  btnDestructive: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  btnCancel:      { backgroundColor: theme.colors.card },
  btnText:             { fontSize: 15, fontWeight: '600' },
  btnTextPrimary:      { color: '#FFFFFF' },
  btnTextDestructive:  { color: '#EF4444' },
  btnTextCancel:       { color: theme.colors.text.secondary },
});
