import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  StatusBar,
  TextInput,
  FlatList,
  Modal,
  Pressable,
  ActionSheetIOS,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../src/styles/theme';
import { recordingsStyles as styles } from '../src/styles/RecordingsScreen.styles';
import { flashcardsStyles as flashcardStyles } from '../src/styles/FlashcardsModal.styles';

import { PremiumLoading } from '../src/components/PremiumLoading';
import { FlashcardNewDeckScreen } from '../src/components/FlashcardNewDeckScreen';
import { FlashcardImportModal } from '../src/components/FlashcardImportModal';
import { useFlashcardsManager } from '../src/hooks/useFlashcardsManager';
import { getSubjects, type Subject } from '../src/services/api';

/**
 * Pantalla de Mazos de Flashcards
 *
 * Muestra una lista de mazos agrupados por materia, con buscador,
 * filtro por materia (pills/chips) y opciones adicionales.
 */
export default function FlashcardsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [showSearch, setShowSearch] = useState(false);
  const [showNewDeckModal, setShowNewDeckModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  const searchAnim = useRef(new Animated.Value(0)).current;
  const searchInputRef = useRef<TextInput>(null);

  const handleOpenMenu = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [t('common.cancel'), t('flashcards.createDeck'), t('flashcards.importDeck')],
          cancelButtonIndex: 0,
        },
        (index) => {
          if (index === 1) {
            setShowNewDeckModal(true);
          } else if (index === 2) {
            setShowImportModal(true);
          }
        }
      );
    } else {
      // Android: mostrar modal personalizado con opciones
      setShowMenuModal(true);
    }
  };

  const {
    isLoading,
    searchQuery,
    setSearchQuery,
    activeSubjectId,
    setActiveSubjectId,
    filteredDecks,
    loadDecks,
  } = useFlashcardsManager(subjects);

  /**
   * Alterna la visibilidad de la barra de búsqueda con animación
   */
  const toggleSearch = () => {
    const opening = !showSearch;
    setShowSearch(opening);
    Animated.spring(searchAnim, {
      toValue: opening ? 1 : 0,
      useNativeDriver: false,
      bounciness: 4,
    }).start();
    if (opening) {
      setTimeout(() => searchInputRef.current?.focus(), 150);
    } else {
      setSearchQuery('');
    }
  };

  // Load subjects and decks on mount
  useFocusEffect(
    useCallback(() => {
      const loadAll = async () => {
        try {
          const subs = await getSubjects();
          setSubjects(subs || []);
        } catch (e) {
          console.warn('Error loading subjects:', e);
        }
        await loadDecks();
      };
      loadAll();
    }, [loadDecks])
  );

  if (isLoading && filteredDecks.length === 0) {
    return <PremiumLoading text={t('common.loading') || 'CARGANDO'} />;
  }

  const isEmpty = filteredDecks.length === 0;

  return (
    <View style={[styles.container, { flex: 1 }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar
        barStyle="dark-content"
        backgroundColor={theme.colors.card}
        translucent={false}
      />

      {/* Safe-area top */}
      <View style={{ height: insets.top, backgroundColor: theme.colors.card }} />

      {/* Header */}
      <View style={[styles.headerRow, { paddingLeft: theme.spacing.lg, justifyContent: 'space-between' }]}>
        <Text style={[styles.headerTitle, { flex: 1, textAlign: 'left' }]}>
          Mazos
        </Text>
        {/* Right actions: Search · Add */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <TouchableOpacity
            style={[
              styles.backBtn,
              showSearch && {
                backgroundColor: `${theme.colors.primary}12`,
                borderRadius: 20,
              },
            ]}
            onPress={toggleSearch}
          >
            <Ionicons
              name={showSearch ? 'search' : 'search-outline'}
              size={22}
              color={showSearch ? theme.colors.primary : theme.colors.text.primary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.backBtn}
            onPress={handleOpenMenu}
          >
            <Ionicons name="ellipsis-vertical" size={24} color={theme.colors.text.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Collapsible search bar ─────────────────────────────────────── */}
      <Animated.View
        style={{
          overflow: 'hidden',
          maxHeight: searchAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 56],
          }),
          opacity: searchAnim,
          backgroundColor: theme.colors.card,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
          paddingHorizontal: theme.spacing.lg,
          justifyContent: 'center',
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.colors.background,
            borderRadius: 14,
            paddingHorizontal: 12,
            height: 40,
            gap: 8,
            borderWidth: 1,
            borderColor: theme.colors.border,
          }}
        >
          <Ionicons name="search" size={16} color={theme.colors.text.placeholder} />
          <TextInput
            ref={searchInputRef}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('flashcards.deckNamePlaceholder', 'Buscar mazo...')}
            placeholderTextColor={theme.colors.text.placeholder}
            style={{ flex: 1, fontSize: 14, color: theme.colors.text.primary, paddingVertical: 0 }}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color={theme.colors.text.placeholder} />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      {/* ── Filter pills by subject ─────────────────────────────────── */}
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: theme.colors.card,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: 10,
          gap: 8,
          borderBottomWidth: 1,
          borderBottomColor: theme.colors.border,
          alignItems: 'center',
        }}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingRight: 16 }}
        >
          {/* "Todos" pill */}
          <TouchableOpacity
            onPress={() => setActiveSubjectId(null)}
            activeOpacity={0.72}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              paddingHorizontal: 13,
              paddingVertical: 7,
              borderRadius: 20,
              borderWidth: 1.5,
              borderColor: activeSubjectId === null
                ? theme.colors.text.primary
                : theme.colors.border,
              backgroundColor: activeSubjectId === null
                ? theme.colors.text.primary
                : 'transparent',
            }}
          >
            <Ionicons
              name="layers-outline"
              size={13}
              color={activeSubjectId === null ? theme.colors.white : theme.colors.text.secondary}
            />
            <Text
              style={{
                fontSize: 13,
                fontWeight: activeSubjectId === null ? '700' : '500',
                color: activeSubjectId === null ? theme.colors.white : theme.colors.text.secondary,
                letterSpacing: -0.1,
              }}
            >
              Todos
            </Text>
          </TouchableOpacity>

          {/* Subject pills */}
          {subjects.map((subject) => {
            const isActive = activeSubjectId === subject.id;
            return (
              <TouchableOpacity
                key={subject.id}
                onPress={() => setActiveSubjectId(subject.id)}
                activeOpacity={0.72}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                  paddingHorizontal: 13,
                  paddingVertical: 7,
                  borderRadius: 20,
                  borderWidth: 1.5,
                  borderColor: isActive
                    ? theme.colors.text.primary
                    : theme.colors.border,
                  backgroundColor: isActive
                    ? theme.colors.text.primary
                    : 'transparent',
                }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: subject.color || theme.colors.primary,
                  }}
                />
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: isActive ? '700' : '500',
                    color: isActive ? theme.colors.white : theme.colors.text.secondary,
                    letterSpacing: -0.1,
                  }}
                >
                  {subject.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Main scrollable content */}
      <ScrollView
        contentContainerStyle={[styles.listContent, { paddingBottom: 120 }]}
        showsVerticalScrollIndicator={false}
      >
        {isEmpty ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons
              name="cards-outline"
              size={64}
              color={theme.colors.border}
            />
            <Text style={styles.emptyText}>
              {t('flashcards.emptyDecks')}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredDecks}
            keyExtractor={(deck) => deck.id.toString()}
            scrollEnabled={false}
            contentContainerStyle={{ paddingHorizontal: theme.spacing.lg, gap: 12 }}
            renderItem={({ item: deck }) => (
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: theme.colors.inputBackground,
                  borderRadius: 18,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                  gap: 12,
                }}
                activeOpacity={0.7}
              >
                <View
                  style={{
                    width: 42,
                    height: 42,
                    borderRadius: 21,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: (deck as any).subject_color || '#DDE7FF',
                  }}
                >
                  <MaterialCommunityIcons
                    name={(((deck as any).subject_icon as any) || 'cards-outline')}
                    size={20}
                    color={theme.colors.text.primary}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: '700',
                      color: theme.colors.text.primary,
                    }}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {deck.title}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color: theme.colors.text.secondary,
                      marginTop: 1,
                    }}
                    numberOfLines={1}
                  >
                    {(deck as any).subject_name}
                  </Text>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  <Text
                    style={{
                      fontSize: 13,
                      fontWeight: '600',
                      color: theme.colors.primary,
                    }}
                  >
                    {(deck as any).card_count || 0}
                  </Text>
                  <Text
                    style={{
                      fontSize: 11,
                      color: theme.colors.text.secondary,
                    }}
                  >
                    {t('flashcards.cards')}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          />
        )}
      </ScrollView>

      {/* ── Floating Add Deck Button ─────────────────────────── */}
      <View
        style={{
          position: 'absolute',
          bottom: Math.max(insets.bottom, 16) + 8,
          left: 0,
          right: 0,
          alignItems: 'center',
          paddingHorizontal: theme.spacing.lg,
        }}
      >
        <TouchableOpacity
          onPress={() => setShowNewDeckModal(true)}
          activeOpacity={0.8}
          style={{
            width: '100%',
            backgroundColor: theme.colors.primary,
            borderRadius: 16,
            paddingVertical: 14,
            paddingHorizontal: 16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 8,
            elevation: 5,
          }}
        >
          <Ionicons name="add-circle" size={20} color={theme.colors.white} />
          <Text
            style={{
              fontSize: 15,
              fontWeight: '700',
              color: theme.colors.white,
            }}
          >
            {t('flashcards.newDeck')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── New Deck Modal ────────────────────────────────────── */}
      <Modal
        visible={showNewDeckModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNewDeckModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.28)' }}>
          <Pressable
            style={{ flex: 1 }}
            onPress={() => setShowNewDeckModal(false)}
          />
          <View
            style={{
              backgroundColor: theme.colors.background,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              padding: 24,
              paddingBottom: 28,
              maxHeight: '80%',
            }}
          >
            <FlashcardNewDeckScreen
              subjects={subjects}
              onBack={() => setShowNewDeckModal(false)}
              onDeckCreated={() => {
                setShowNewDeckModal(false);
                loadDecks();
              }}
            />
          </View>
        </View>
      </Modal>

      {/* ── Import Deck Modal ────────────────────────────────────── */}
      <FlashcardImportModal
        isVisible={showImportModal}
        onClose={() => setShowImportModal(false)}
        subjects={subjects}
        onImportSuccess={() => loadDecks()}
      />

      {/* ── Menu Modal (Android fallback) ────────────────────────────────────── */}
      <Modal
        visible={showMenuModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMenuModal(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}
          onPress={() => setShowMenuModal(false)}
        >
          <View
            style={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
              paddingHorizontal: theme.spacing.lg,
            }}
          >
            <Pressable
              style={{
                backgroundColor: theme.colors.card,
                borderRadius: 16,
                overflow: 'hidden',
                width: '100%',
                maxWidth: 280,
              }}
              onPress={(e) => e.stopPropagation()}
            >
              {/* Create Deck Option */}
              <TouchableOpacity
                onPress={() => {
                  setShowMenuModal(false);
                  setShowNewDeckModal(true);
                }}
                activeOpacity={0.7}
                style={{
                  paddingVertical: 16,
                  paddingHorizontal: 16,
                  borderBottomWidth: 1,
                  borderBottomColor: theme.colors.border,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <Ionicons name="add-circle-outline" size={20} color={theme.colors.primary} />
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: '600',
                    color: theme.colors.text.primary,
                  }}
                >
                  {t('flashcards.createDeck')}
                </Text>
              </TouchableOpacity>

              {/* Import Deck Option */}
              <TouchableOpacity
                onPress={() => {
                  setShowMenuModal(false);
                  setShowImportModal(true);
                }}
                activeOpacity={0.7}
                style={{
                  paddingVertical: 16,
                  paddingHorizontal: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <Ionicons name="download-outline" size={20} color={theme.colors.primary} />
                <Text
                  style={{
                    fontSize: 15,
                    fontWeight: '600',
                    color: theme.colors.text.primary,
                  }}
                >
                  {t('flashcards.importDeck')}
                </Text>
              </TouchableOpacity>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
