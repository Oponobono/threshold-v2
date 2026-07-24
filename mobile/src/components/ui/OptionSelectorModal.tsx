import React from 'react';
import { View, Text, FlatList, TouchableOpacity, TouchableWithoutFeedback, StyleSheet, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { theme } from '../../styles/theme';
import { dashboardStyles as styles } from '../../styles/Dashboard.styles';

export interface SelectorOption {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  subtitle?: string;
}

interface OptionSelectorModalProps {
  visible: boolean;
  title: string;
  options: SelectorOption[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onClose: () => void;
  allowClear?: boolean;
  clearLabel?: string;
  cancelLabel?: string;
}

export const OptionSelectorModal: React.FC<OptionSelectorModalProps> = ({
  visible,
  title,
  options,
  selectedId,
  onSelect,
  onClose,
  allowClear = true,
  clearLabel = 'Quitar selección',
  cancelLabel = 'Cancelar',
}) => {
  const insets = useSafeAreaInsets();
  const mountTime = React.useRef(0);

  if (visible && mountTime.current === 0) {
    mountTime.current = Date.now();
    console.log(`[Modal-${title}] Initializing mountTime to`, mountTime.current);
  } else if (!visible && mountTime.current !== 0) {
    mountTime.current = 0;
    console.log(`[Modal-${title}] Resetting mountTime because visible is false`);
  }

  const handleBackdropPress = () => {
    const elapsed = Date.now() - mountTime.current;
    console.log(`[Modal-${title}] Backdrop pressed. Elapsed since open: ${elapsed}ms`);
    
    // Si el toque ocurre menos de 500ms después de abrir el modal, es un ghost tap
    if (elapsed < 500) {
      console.log(`[Modal-${title}] Ignored ghost tap on backdrop!`);
      return;
    }
    console.log(`[Modal-${title}] Valid close requested by user via backdrop`);
    onClose();
  };

  const handleCancelPress = () => {
    console.log(`[Modal-${title}] Cancel button pressed by user`);
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={handleBackdropPress}>
        <View style={styles.sheetBackdrop}>
          <TouchableWithoutFeedback onPress={(e) => {
            console.log(`[Modal-${title}] Tap inside sheetContent intercepted`);
            e.stopPropagation();
          }}>
            <View style={[styles.sheetContent, { maxHeight: '70%', paddingBottom: Math.max(insets.bottom, 20) }]}>
              <Text style={[styles.sheetTitle, { marginBottom: 16 }]}>{title}</Text>
              
              <FlatList
                data={options}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                  const isSelected = selectedId === item.id;
                  return (
                    <TouchableOpacity 
                      style={[
                        styles.quickAddMenuItem, 
                        { marginBottom: 12, padding: 16 },
                        isSelected && { borderColor: theme.colors.primary, borderWidth: 2 }
                      ]}
                      onPress={() => {
                        onSelect(item.id);
                        onClose();
                      }}
                    >
                      {item.icon ? (
                        <View style={[styles.subjectBadge, { backgroundColor: item.color || '#F0F0F0', marginBottom: 0, marginRight: 16, width: 44, height: 44, borderRadius: 12 }]}>
                          <MaterialCommunityIcons name={(item.icon as any)} size={22} color={theme.colors.text.primary} />
                        </View>
                      ) : null}
                      
                      <View style={[styles.quickAddMenuInfo, !item.icon && { marginLeft: 0 }]}>
                        <Text style={styles.quickAddMenuText}>{item.name}</Text>
                        {item.subtitle ? (
                          <Text style={styles.quickAddMenuSubtext}>{item.subtitle}</Text>
                        ) : null}
                      </View>

                      {isSelected && (
                        <Feather name="check" size={20} color={theme.colors.primary} style={{ marginLeft: 'auto' }} />
                      )}
                    </TouchableOpacity>
                  );
                }}
                ListHeaderComponent={
                  allowClear && selectedId ? (
                    <TouchableOpacity 
                      style={[styles.quickAddMenuItem, { marginBottom: 12, padding: 16, justifyContent: 'center' }]}
                      onPress={() => {
                        onSelect(null);
                        onClose();
                      }}
                    >
                      <Text style={[styles.quickAddMenuText, { color: theme.colors.text.error, textAlign: 'center', flex: 1 }]}>
                        {clearLabel}
                      </Text>
                    </TouchableOpacity>
                  ) : null
                }
              />
              
              <TouchableOpacity style={[styles.sheetCancelBtn, { marginTop: 8 }]} onPress={handleCancelPress}>
                <Text style={styles.sheetCancelText}>{cancelLabel}</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};
