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
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { styles } from '../../styles/CustomAlert.styles';

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


