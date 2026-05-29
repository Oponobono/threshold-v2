import React from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { theme } from '../../src/styles/theme';
import { globalStyles } from '../../src/styles/globalStyles';
import { categoriesStyles as styles } from '../../src/styles/Categories.styles';
import { CategoryFormModal } from '../../src/components/modals/CategoryFormModal';
import { useCategories } from '../../src/hooks/useCategories';
import { EmptyCategories } from '../../src/components/categories/EmptyCategories';
import { CategoryCard } from '../../src/components/categories/CategoryCard';
import { WeightSummary } from '../../src/components/categories/WeightSummary';

export default function CategoriesScreen() {
  const { t } = useTranslation();
  const {
    subjectId,
    subjectName,
    categories,
    isLoading,
    modalVisible,
    editing,
    router,
    handleAdd,
    handleEdit,
    handleDelete,
    handleSaved,
    handleCloseModal,
  } = useCategories();

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={globalStyles.safeArea}>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={18} color={theme.colors.text.primary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>{subjectName}</Text>
            <Text style={styles.headerSub}>{t('categories.screenSubtitle')}</Text>
          </View>
          <TouchableOpacity style={styles.headerAddBtn} onPress={handleAdd}>
            <Ionicons name="add" size={20} color={theme.colors.text.white} />
          </TouchableOpacity>
        </View>

        {/* Body */}
        {isLoading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator color={theme.colors.primary} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
          >
            {/* Info banner */}
            <View style={styles.infoBanner}>
              <Ionicons name="information-circle-outline" size={15} color={theme.colors.text.secondary} />
              <Text style={styles.infoBannerText}>
                {t('categories.helpText')}
              </Text>
            </View>

            {/* Content */}
            {categories.length === 0 ? (
              <EmptyCategories onAdd={handleAdd} />
            ) : (
              <View style={styles.listWrap}>
                <View style={styles.listHeader}>
                  <Text style={styles.listHeaderLabel}>
                    {t('categories.totalLabel')}
                  </Text>
                  <Text style={styles.listHeaderChip}>
                    {t('categories.groups', { count: categories.length })}
                  </Text>
                </View>

                {categories.map((cat, i) => (
                  <CategoryCard
                    key={cat.id}
                    category={cat}
                    index={i}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))}

                {categories.some(c => c.weight != null) && (
                  <WeightSummary categories={categories} />
                )}

                <TouchableOpacity style={styles.addMoreBtn} onPress={handleAdd}>
                  <Ionicons name="add-circle-outline" size={18} color={theme.colors.text.secondary} />
                  <Text style={styles.addMoreText}>{t('categories.addMore')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>

      <CategoryFormModal
        visible={modalVisible}
        subjectId={subjectId!}
        editing={editing}
        onClose={handleCloseModal}
        onSaved={handleSaved}
      />
    </>
  );
}
