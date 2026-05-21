import React from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../styles/theme';
import { UserProfile } from '../services/api';

interface EditProfileModalProps {
  visible: boolean;
  profile: UserProfile | null;
  gradingSystems: any[];
  selectedSystemId: number | null;
  onSystemSelect: (id: number) => void;
  editName: string;
  editLastname: string;
  editUsername: string;
  editUniversity: string;
  editMajor: string;
  editSemester: string;
  editStudyGoal: string;
  editPin: string;
  onNameChange: (val: string) => void;
  onLastnameChange: (val: string) => void;
  onUsernameChange: (val: string) => void;
  onUniversityChange: (val: string) => void;
  onMajorChange: (val: string) => void;
  onSemesterChange: (val: string) => void;
  onStudyGoalChange: (val: string) => void;
  onPinChange: (val: string) => void;
  onClose: () => void;
  onSave: () => void;
}

// ─── Sub-componente: campo de input con etiqueta ─────────────────────────────
const Field = ({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  autoCapitalize,
  maxLength,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  maxLength?: number;
  keyboardType?: 'default' | 'numeric';
}) => (
  <View style={{ marginBottom: 14 }}>
    <Text style={{
      fontSize: 11,
      fontWeight: '700',
      color: theme.colors.text.secondary,
      marginBottom: 6,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    }}>
      {label}
    </Text>
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder || ''}
      placeholderTextColor={theme.colors.text.secondary + '80'}
      autoCapitalize={autoCapitalize || 'words'}
      maxLength={maxLength}
      keyboardType={keyboardType || 'default'}
      multiline={multiline}
      numberOfLines={multiline ? 3 : 1}
      textAlignVertical={multiline ? 'top' : 'center'}
      style={{
        backgroundColor: theme.colors.inputBackground,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: theme.borderRadius.md,
        paddingHorizontal: 14,
        paddingVertical: multiline ? 10 : 12,
        fontSize: theme.typography.sizes.sm,
        color: theme.colors.text.primary,
        minHeight: multiline ? 80 : undefined,
        fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
      }}
    />
  </View>
);

/**
 * Modal para editar el perfil del usuario con scroll interno y diseño alineado
 * al sistema de diseño de la aplicación.
 */
export const EditProfileModal: React.FC<EditProfileModalProps> = ({
  visible,
  profile,
  editName,
  editLastname,
  editUsername,
  editUniversity,
  editMajor,
  editSemester,
  editStudyGoal,
  editPin,
  gradingSystems,
  selectedSystemId,
  onSystemSelect,
  onNameChange,
  onLastnameChange,
  onUsernameChange,
  onUniversityChange,
  onMajorChange,
  onSemesterChange,
  onStudyGoalChange,
  onPinChange,
  onClose,
  onSave,
}) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.55)',
          justifyContent: 'flex-end',
        }}>
          {/* Tap overlay para cerrar */}
          <TouchableOpacity
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            activeOpacity={1}
            onPress={onClose}
          />

          {/* Sheet container */}
          <View style={{
            backgroundColor: theme.colors.background,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            maxHeight: '90%',
            // Sombra
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -4 },
            shadowOpacity: 0.15,
            shadowRadius: 20,
            elevation: 20,
          }}>

            {/* Drag handle */}
            <View style={{ alignItems: 'center', paddingTop: 12, paddingBottom: 4 }}>
              <View style={{
                width: 40, height: 4,
                borderRadius: 2,
                backgroundColor: theme.colors.border,
              }} />
            </View>

            {/* Header */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 20,
              paddingVertical: 16,
              borderBottomWidth: 1,
              borderBottomColor: theme.colors.border,
            }}>
              {/* Avatar + nombre actual */}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                {profile?.profile_image ? (
                  <Image
                    source={{ uri: profile.profile_image }}
                    style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: theme.colors.border }}
                  />
                ) : (
                  <View style={{
                    width: 36, height: 36, borderRadius: 18,
                    backgroundColor: theme.colors.primary + '20',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Ionicons name="person" size={18} color={theme.colors.primary} />
                  </View>
                )}
                <View>
                  <Text style={{ fontSize: 15, fontWeight: '800', color: theme.colors.text.primary }}>
                    {t('settings.editProfile', 'Editar Perfil')}
                  </Text>
                  <Text style={{ fontSize: 11, color: theme.colors.text.secondary }}>
                    {profile?.email || ''}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={onClose}
                style={{
                  width: 32, height: 32, borderRadius: 16,
                  backgroundColor: theme.colors.inputBackground,
                  alignItems: 'center', justifyContent: 'center',
                  borderWidth: 1, borderColor: theme.colors.border,
                }}
              >
                <Ionicons name="close" size={16} color={theme.colors.text.secondary} />
              </TouchableOpacity>
            </View>

            {/* Scrollable body */}
            <ScrollView
              style={{ paddingHorizontal: 20 }}
              contentContainerStyle={{ paddingTop: 20, paddingBottom: 24 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Sección: Información Personal */}
              <Text style={{
                fontSize: 11, fontWeight: '800',
                color: theme.colors.primary,
                textTransform: 'uppercase',
                letterSpacing: 1,
                marginBottom: 12,
              }}>
                {t('settings.personalInfo', 'Información Personal')}
              </Text>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Field
                    label={t('register.step1.firstNameLabel', 'Nombre')}
                    value={editName}
                    onChangeText={onNameChange}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Field
                    label={t('register.step1.lastNameLabel', 'Apellido')}
                    value={editLastname}
                    onChangeText={onLastnameChange}
                  />
                </View>
              </View>

              <Field
                label={t('register.step1.usernameLabel', 'Nombre de Usuario')}
                value={editUsername}
                onChangeText={onUsernameChange}
                autoCapitalize="none"
              />

              {/* Separador */}
              <View style={{ height: 1, backgroundColor: theme.colors.border, marginBottom: 16 }} />

              {/* Sección: Info Académica */}
              <Text style={{
                fontSize: 11, fontWeight: '800',
                color: theme.colors.primary,
                textTransform: 'uppercase',
                letterSpacing: 1,
                marginBottom: 12,
              }}>
                {t('settings.academicInfo', 'Información Académica')}
              </Text>

              <Field
                label={t('register.step1.universityLabel', 'Universidad')}
                value={editUniversity}
                onChangeText={onUniversityChange}
              />

              <Field
                label={t('register.step1.majorLabel', 'Carrera / Programa')}
                value={editMajor}
                onChangeText={onMajorChange}
              />

              <Field
                label={t('register.step1.semesterLabel', 'Semestre Actual')}
                value={editSemester}
                onChangeText={onSemesterChange}
                keyboardType="numeric"
                autoCapitalize="none"
              />

              <Text style={{
                fontSize: 11, fontWeight: '700',
                color: theme.colors.text.secondary,
                marginBottom: 6,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}>
                {t('register.step1.studyGoalLabel', 'Objetivo de Estudio')}
              </Text>
              <View style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 8,
                marginBottom: 14,
              }}>
                {['survive', 'pass', 'excel', 'top'].map((goal) => {
                  const isActive = editStudyGoal === goal;
                  return (
                    <TouchableOpacity
                      key={goal}
                      onPress={() => onStudyGoalChange(goal)}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        borderRadius: theme.borderRadius.md,
                        backgroundColor: isActive ? theme.colors.primary : theme.colors.inputBackground,
                        borderWidth: 1,
                        borderColor: isActive ? theme.colors.primary : theme.colors.border,
                        flex: 1,
                        minWidth: '45%',
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{
                        fontSize: theme.typography.sizes.sm,
                        fontWeight: isActive ? '700' : '500',
                        color: isActive ? '#fff' : theme.colors.text.secondary,
                      }}>
                        {t(`register.goals.${goal}`)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Separador */}
              <View style={{ height: 1, backgroundColor: theme.colors.border, marginBottom: 16 }} />

              {/* Sección: Sistema de Calificación */}
              <Text style={{
                fontSize: 11, fontWeight: '800',
                color: theme.colors.primary,
                textTransform: 'uppercase',
                letterSpacing: 1,
                marginBottom: 12,
              }}>
                {t('academic.gradingScales', 'Sistema de Calificación')}
              </Text>
              
              <View style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 8,
                marginBottom: 14,
              }}>
                {gradingSystems.map((system) => {
                  const isActive = selectedSystemId === system.id;
                  return (
                    <TouchableOpacity
                      key={system.id}
                      onPress={() => onSystemSelect(system.id)}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        borderRadius: theme.borderRadius.md,
                        backgroundColor: isActive ? theme.colors.primary : theme.colors.inputBackground,
                        borderWidth: 1,
                        borderColor: isActive ? theme.colors.primary : theme.colors.border,
                        flex: 1,
                        minWidth: '45%',
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{
                        fontSize: theme.typography.sizes.sm,
                        fontWeight: isActive ? '700' : '500',
                        color: isActive ? '#fff' : theme.colors.text.secondary,
                      }} numberOfLines={1}>
                        {system.name}
                      </Text>
                      <Text style={{
                        fontSize: 10,
                        fontWeight: '500',
                        color: isActive ? '#fff' : theme.colors.text.secondary,
                        opacity: 0.8
                      }} numberOfLines={1}>
                        {system.min_value} – {system.max_value}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Separador */}
              <View style={{ height: 1, backgroundColor: theme.colors.border, marginBottom: 16 }} />

              {/* Sección: PIN */}
              <Text style={{
                fontSize: 11, fontWeight: '800',
                color: theme.colors.primary,
                textTransform: 'uppercase',
                letterSpacing: 1,
                marginBottom: 12,
              }}>
                {t('settings.sharePin', 'PIN de Colaboración')}
              </Text>

              {profile?.share_pin ? (
                <View style={{
                  flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                  backgroundColor: theme.colors.inputBackground,
                  borderWidth: 1, borderColor: theme.colors.border,
                  borderRadius: theme.borderRadius.md,
                  paddingHorizontal: 14, paddingVertical: 12,
                  marginBottom: 14,
                }}>
                  <Text style={{
                    fontSize: 22, fontWeight: '900', letterSpacing: 5,
                    color: theme.colors.primary,
                  }}>
                    {profile.share_pin}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Ionicons name="lock-closed" size={13} color={theme.colors.text.secondary} />
                    <Text style={{ fontSize: 11, color: theme.colors.text.secondary, fontWeight: '600' }}>
                      {t('settings.fixed', 'Fijo')}
                    </Text>
                  </View>
                </View>
              ) : (
                <>
                  <Field
                    label={t('settings.createPin', 'Crear PIN (4-8 caracteres)')}
                    value={editPin}
                    onChangeText={onPinChange}
                    autoCapitalize="characters"
                    maxLength={8}
                  />
                  <View style={{
                    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
                    backgroundColor: '#FF9F0A15',
                    borderRadius: theme.borderRadius.md,
                    padding: 10,
                    marginTop: -8,
                    marginBottom: 14,
                  }}>
                    <Ionicons name="warning-outline" size={14} color="#FF9F0A" style={{ marginTop: 1 }} />
                    <Text style={{ fontSize: 11, color: '#FF9F0A', flex: 1, lineHeight: 16, fontWeight: '600' }}>
                      {t('settings.pinFixedWarning', 'Una vez guardado, el PIN no puede modificarse.')}
                    </Text>
                  </View>
                </>
              )}
            </ScrollView>

            {/* Footer con botones */}
            <View style={{
              flexDirection: 'row',
              gap: 10,
              paddingHorizontal: 20,
              paddingTop: 12,
              paddingBottom: Math.max(insets.bottom, 16),
              borderTopWidth: 1,
              borderTopColor: theme.colors.border,
              backgroundColor: theme.colors.background,
            }}>
              <TouchableOpacity
                onPress={onClose}
                style={{
                  flex: 1, paddingVertical: 13,
                  borderRadius: theme.borderRadius.full,
                  backgroundColor: theme.colors.inputBackground,
                  borderWidth: 1, borderColor: theme.colors.border,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 14, fontWeight: '700', color: theme.colors.text.secondary }}>
                  {t('settings.cancel', 'Cancelar')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onSave}
                style={{
                  flex: 2, paddingVertical: 13,
                  borderRadius: theme.borderRadius.full,
                  backgroundColor: theme.colors.primary,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#fff' }}>
                  {t('settings.save', 'Guardar cambios')}
                </Text>
              </TouchableOpacity>
            </View>

          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};
