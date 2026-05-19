import React from 'react';
import { View, Text, Modal, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../styles/theme';
import { settingsStyles as styles } from '../styles/Settings.styles';

interface DeleteAccountModalProps {
  visible: boolean;
  step: 'confirm' | 'password' | 'data' | 'final';
  passwordValue: string;
  confirmTextValue: string;
  expectedConfirmText: string;
  deletionDataCount: any;
  isLoading: boolean;
  onPasswordChange: (val: string) => void;
  onConfirmTextChange: (val: string) => void;
  onClose: () => void;
  onStepChange: (step: 'confirm' | 'password' | 'data' | 'final') => void;
  onVerifyPassword: () => void;
  onFinalConfirm: () => void;
}

/**
 * Modal en 4 pasos para la eliminación permanente de la cuenta de usuario.
 * 
 * Pasos:
 * 1. Confirmación inicial de lectura de advertencia.
 * 2. Ingreso de contraseña de la cuenta por seguridad.
 * 3. Previsualización de todos los datos y registros que se perderán (obtenidos del backend).
 * 4. Confirmación final escribiendo el nombre de usuario o "ELIMINAR".
 */
export const DeleteAccountModal: React.FC<DeleteAccountModalProps> = ({
  visible,
  step,
  passwordValue,
  confirmTextValue,
  expectedConfirmText,
  deletionDataCount,
  isLoading,
  onPasswordChange,
  onConfirmTextChange,
  onClose,
  onStepChange,
  onVerifyPassword,
  onFinalConfirm
}) => {
  const { t } = useTranslation();

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          
          {/* STEP 1: CONFIRMATION */}
          {step === 'confirm' && (
            <>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t('account.deleteAccountConfirm', 'Eliminar Cuenta')}</Text>
                <TouchableOpacity onPress={onClose}>
                  <Ionicons name="close" size={24} color={theme.colors.text.secondary} />
                </TouchableOpacity>
              </View>
              <View style={styles.modalBody}>
                <Text style={styles.modalLabel}>{t('account.deleteWarning', 'Advertencia importante')}</Text>
                <Text style={styles.modalDesc}>
                  {t('account.deleteWarningMsg', 'Esta acción deshabilitará tu cuenta permanentemente. Tienes 14 días para recuperarla antes de que se borre todo definitivamente.')}
                </Text>
                <View style={{ marginTop: 12, padding: 12, backgroundColor: '#FFE5E5', borderRadius: 8 }}>
                  <Text style={{ fontSize: 12, color: '#8B0000' }}>
                    {t('account.deleteIrreversible', '⚠️ Después de 14 días, no podremos recuperar tus datos.')}
                  </Text>
                </View>
              </View>
              <View style={styles.modalFooter}>
                <TouchableOpacity style={styles.modalBtnSecondary} onPress={onClose}>
                  <Text style={styles.modalBtnSecondaryText}>{t('settings.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalBtnPrimary, { backgroundColor: '#FF2D55' }]}
                  onPress={() => onStepChange('password')}
                >
                  <Text style={styles.modalBtnPrimaryText}>{t('account.continueBtn', 'Continuar')}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* STEP 2: PASSWORD VERIFICATION */}
          {step === 'password' && (
            <>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t('account.verifyPassword', 'Verificar Contraseña')}</Text>
                <TouchableOpacity onPress={onClose}>
                  <Ionicons name="close" size={24} color={theme.colors.text.secondary} />
                </TouchableOpacity>
              </View>
              <View style={styles.modalBody}>
                <Text style={styles.modalLabel}>{t('account.passwordVerifyMsg', 'Para confirmar, ingresa tu contraseña')}</Text>
                <TextInput 
                  style={styles.modalInput} 
                  value={passwordValue} 
                  onChangeText={onPasswordChange} 
                  secureTextEntry 
                  placeholder="••••••••"
                />
              </View>
              <View style={styles.modalFooter}>
                <TouchableOpacity style={styles.modalBtnSecondary} onPress={() => onStepChange('confirm')}>
                  <Text style={styles.modalBtnSecondaryText}>{t('account.backBtn', 'Atrás')}</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalBtnPrimary, { backgroundColor: '#FF2D55' }]}
                  onPress={onVerifyPassword}
                  disabled={isLoading}
                >
                  <Text style={styles.modalBtnPrimaryText}>
                    {isLoading ? t('common.loading', 'Cargando...') : t('account.continueBtn')}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* STEP 3: DATA PREVIEW */}
          {step === 'data' && deletionDataCount && (
            <>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t('account.whatWillBeLost', 'Datos que se perderán')}</Text>
                <TouchableOpacity onPress={onClose}>
                  <Ionicons name="close" size={24} color={theme.colors.text.secondary} />
                </TouchableOpacity>
              </View>
              <View style={styles.modalBody}>
                <Text style={styles.modalDesc}>
                  {t('account.deletionDataWarning', 'Estos datos serán eliminados permanentemente después de 14 días:')}
                </Text>
                <View style={{ marginTop: 12, gap: 8 }}>
                  {deletionDataCount.subjects > 0 && (
                    <Text style={styles.modalLabel}>📚 {deletionDataCount.subjects} {t('settings.subject', 'materias')}</Text>
                  )}
                  {deletionDataCount.recordings > 0 && (
                    <Text style={styles.modalLabel}>🎙️ {deletionDataCount.recordings} {t('settings.recording', 'grabaciones')}</Text>
                  )}
                  {deletionDataCount.videos > 0 && (
                    <Text style={styles.modalLabel}>🎬 {deletionDataCount.videos} {t('settings.video', 'videos')}</Text>
                  )}
                  {deletionDataCount.photos > 0 && (
                    <Text style={styles.modalLabel}>📷 {deletionDataCount.photos} {t('settings.photo', 'fotos')}</Text>
                  )}
                  {deletionDataCount.decks > 0 && (
                    <Text style={styles.modalLabel}>🃏 {deletionDataCount.decks} {t('settings.deck', 'mazos')}</Text>
                  )}
                </View>
                <View style={{ marginTop: 16, padding: 12, backgroundColor: '#E3F2FD', borderRadius: 8 }}>
                  <Text style={{ fontSize: 12, color: '#1976D2' }}>
                    {t('account.recoveryInfo', 'ℹ️ Puedes recuperar tu cuenta iniciando sesión con tus credenciales en cualquier momento dentro de 14 días.')}
                  </Text>
                </View>
              </View>
              <View style={styles.modalFooter}>
                <TouchableOpacity style={styles.modalBtnSecondary} onPress={() => onStepChange('password')}>
                  <Text style={styles.modalBtnSecondaryText}>{t('account.backBtn')}</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalBtnPrimary, { backgroundColor: '#FF2D55' }]}
                  onPress={() => onStepChange('final')}
                >
                  <Text style={styles.modalBtnPrimaryText}>{t('account.continueBtn')}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* STEP 4: FINAL CONFIRMATION */}
          {step === 'final' && (
            <>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{t('account.confirmDeletion', 'Confirmación Final')}</Text>
                <TouchableOpacity onPress={onClose}>
                  <Ionicons name="close" size={24} color={theme.colors.text.secondary} />
                </TouchableOpacity>
              </View>
              <View style={styles.modalBody}>
                <Text style={styles.modalLabel}>
                  {t('account.typeToConfirm', `Escribe "${expectedConfirmText}" para confirmar`)}
                </Text>
                <TextInput 
                  style={[styles.modalInput, confirmTextValue === expectedConfirmText ? { borderColor: '#34C759' } : {}]}
                  value={confirmTextValue} 
                  onChangeText={onConfirmTextChange} 
                  placeholder={expectedConfirmText}
                />
                <Text style={{ fontSize: 11, color: theme.colors.text.secondary, marginTop: 8 }}>
                  {t('account.oneWayRoad', '⚠️ Esta es la última oportunidad para cambiar de idea.')}
                </Text>
              </View>
              <View style={styles.modalFooter}>
                <TouchableOpacity style={styles.modalBtnSecondary} onPress={() => onStepChange('data')}>
                  <Text style={styles.modalBtnSecondaryText}>{t('account.backBtn')}</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[
                    styles.modalBtnPrimary, 
                    { 
                      backgroundColor: confirmTextValue === expectedConfirmText ? '#FF2D55' : '#ccc'
                    }
                  ]}
                  onPress={onFinalConfirm}
                  disabled={isLoading || confirmTextValue !== expectedConfirmText}
                >
                  <Text style={styles.modalBtnPrimaryText}>
                    {isLoading ? t('common.loading') : t('account.deleteBtn')}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
          
        </View>
      </View>
    </Modal>
  );
};
