import React from 'react';
import { View, Text, Modal, Pressable, FlatList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { dashboardStyles as styles } from '../../styles/Dashboard.styles';
import { theme } from '../../styles/theme';
import { type AssessmentCategory } from '../../services/api/assessmentCategories';

interface CategorySelectorModalProps {
  visible: boolean;
  categories: AssessmentCategory[];
  selectedCategoryId: number | null;
  onSelectCategory: (id: number | null) => void;
  onClose: () => void;
}

export const CategorySelectorModal = ({
  visible,
  categories,
  selectedCategoryId,
  onSelectCategory,
  onClose
}: CategorySelectorModalProps) => {
  const { t } = useTranslation();

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <View style={[styles.sheetContent, { maxHeight: '60%' }]}>
          <Text style={[styles.sheetTitle, { marginBottom: 16 }]}>{t('categories.selectCategory')}</Text>
          <FlatList
            data={[{ id: null, name: t('categories.none') } as any, ...categories]}
            keyExtractor={(item, index) => item.id ? item.id.toString() : `none-${index}`}
            renderItem={({ item }) => (
              <TouchableOpacity 
                style={[
                  styles.quickAddMenuItem, 
                  { marginBottom: 12, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
                  selectedCategoryId === item.id && { borderColor: theme.colors.primary, borderWidth: 2 }
                ]}
                onPress={() => {
                  onSelectCategory(item.id);
                  onClose();
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons 
                    name={item.id ? "pricetag-outline" : "close-circle-outline"} 
                    size={22} 
                    color={item.id ? theme.colors.text.primary : theme.colors.text.secondary} 
                    style={{ marginRight: 12 }} 
                  />
                  <Text style={[styles.quickAddMenuText, !item.id && { color: theme.colors.text.secondary }]}>
                    {item.name}
                  </Text>
                </View>
                {selectedCategoryId === item.id && (
                  <Ionicons name="checkmark" size={20} color={theme.colors.primary} />
                )}
              </TouchableOpacity>
            )}
          />
          <TouchableOpacity style={styles.sheetCancelBtn} onPress={onClose}>
            <Text style={styles.sheetCancelText}>{t('dashboard.newSubject.cancel')}</Text>
          </TouchableOpacity>
        </View>
      </Pressable>
    </Modal>
  );
};
