import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../../styles/theme';
import { categoriesStyles as styles } from '../../styles/Categories.styles';

interface EmptyCategoriesProps {
  onAdd: () => void;
}

export const EmptyCategories: React.FC<EmptyCategoriesProps> = ({ onAdd }) => {
  const { t } = useTranslation();
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIconCircle}>
        <Ionicons name="layers-outline" size={28} color={theme.colors.text.secondary} />
      </View>
      <Text style={styles.emptyTitle}>{t('categories.emptyTitle')}</Text>
      <Text style={styles.emptySubtitle}>
        {t('categories.emptyHelp')}
      </Text>
      <TouchableOpacity style={styles.emptyAction} onPress={onAdd}>
        <Ionicons name="add" size={16} color={theme.colors.text.white} />
        <Text style={styles.emptyActionText}>{t('categories.addFirst')}</Text>
      </TouchableOpacity>
    </View>
  );
};
