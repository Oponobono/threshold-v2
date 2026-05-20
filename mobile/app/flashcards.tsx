import React, { useRef, useState, useCallback } from 'react';
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
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useFocusEffect } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import LottieView from 'lottie-react-native';
import { theme } from '../src/styles/theme';
import { recordingsStyles as styles } from '../src/styles/RecordingsScreen.styles';
import { flashcardsStyles as flashcardStyles } from '../src/styles/FlashcardsModal.styles';

import { PremiumLoading } from '../src/components/PremiumLoading';
import { FlashcardNewDeckScreen } from '../src/components/FlashcardNewDeckScreen';
import { FlashcardImportModal } from '../src/components/FlashcardImportModal';
import { SwipeableCard } from '../src/components/SwipeableCard';
import { useCustomAlert } from '../src/components/CustomAlert';
import { FlashcardNewCardScreen } from '../src/components/FlashcardNewCardScreen';
import { FlashcardStudyScreenStandalone } from '../src/components/FlashcardStudyScreenStandalone';
import { useFlashcardsManager } from '../src/hooks/useFlashcardsManager';
import { useDataStore } from '../src/store/useDataStore';
import { AnimatedMarchingAntsBorder } from '../src/components/AnimatedMarchingAntsBorder';
import { useLoadingState } from '../src/hooks/useLoadingState';
import { FlashcardsLoadingState } from '../src/components/LoadingStates';
import { getSubjects, type Subject, type FlashcardDeck, deleteFlashcardDeck, getUserId, getFlashcardsPrioritized, updateFlashcardDeck } from '../src/services/api';

/**
 * Componente memoizado del arrow animado para optimizar rendimiento
 */
const AnimatedArrow = React.memo(function AnimatedArrow() {
  return (
    <View style={{ width: 40, height: 40, marginRight: -6, transform: [{ rotate: '90deg' }] }}>
      <LottieView
        source={require('../src/lottieFiles/arrow.json')}
        autoPlay
        loop
        style={{ width: '100%', height: '100%' }}
      />
    </View>
  );
});

/**
 * Componente memoizado para cada tarjeta de mazo
 * Solo re-renderiza cuando los datos del mazo realmente cambian
 */
const DeckCard = React.memo(function DeckCard({ 
  deck, 
  isShared, 
  currentUserId,
  isDue,
  onPress, 
  onLongPress,
  t 
}: {
  deck: FlashcardDeck;
  isShared: boolean;
  currentUserId: number | null;
  isDue: boolean;
  onPress: () => void;
  onLongPress: () => void;
  t: any;
}) {
  return (
    <AnimatedMarchingAntsBorder
      borderRadius={18}
      strokeColor={theme.colors.danger}
      strokeWidth={1}
      always={isDue}
    >
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={500}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: pressed ? flashcardStyles.deckCard.backgroundColor + '80' : flashcardStyles.deckCard.backgroundColor,
          borderRadius: 18,
          padding: 14,
          borderWidth: isDue ? 0 : 1,
          borderColor: isDue ? 'transparent' : flashcardStyles.deckCard.borderColor,
          gap: 12,
          opacity: pressed ? 0.7 : 1,
        })}
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
            name={isShared ? 'account-group-outline' : (((deck as any).subject_icon as any) || 'cards-outline')}
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
          {isShared && (
            <Text style={{ fontSize: 11, color: '#388E3C', fontStyle: 'italic', marginBottom: 2, marginTop: 2 }}>
              <Ionicons name="people" size={10} color="#388E3C" />
              {' '}{t('modals.shared', 'Compartido')} {t('flashcards.sharedBy', 'por')} @{(deck as any).owner_username || (deck as any).owner_name || t('flashcards.peer', 'compañero')}
            </Text>
          )}
          <Text
            style={{
              fontSize: 12,
              color: theme.colors.text.secondary,
              marginTop: 1,
            }}
            numberOfLines={1}
          >
            {(deck as any).subject_name || t('flashcards.noSubject', 'Sin materia')}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
            <Text style={{ fontSize: 12, color: theme.colors.text.secondary }}>
              {Number(deck.card_count ?? 0)} {t('flashcards.cards')}
            </Text>
            {Number(deck.card_count ?? 0) > 0 && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 11, color: '#388E3C', fontWeight: '600' }}>
                  ✓ {Number((deck as any).review_count ?? 0)}
                </Text>
                <Text style={{ fontSize: 11, color: theme.colors.primary, fontWeight: '600' }}>
                  💪 {Number((deck as any).learning_count ?? 0) + Number((deck as any).new_count ?? 0)}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <AnimatedArrow />
        </View>
      </Pressable>
    </AnimatedMarchingAntsBorder>
  );
});

/**
 * Pantalla de Mazos de Flashcards
 *
 * Muestra una lista de mazos agrupados por materia, con buscador,
 * filtro por materia (pills/chips) y opciones adicionales.
 */
export default function FlashcardsScreen() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { showAlert } = useCustomAlert();
  const { refreshPredictions, getDuedeckIds } = useDataStore();

  const [showSearch, setShowSearch] = useState(false);
  const [showNewDeckModal, setShowNewDeckModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [showNewCardModal, setShowNewCardModal] = useState(false);
  const [showStudyModal, setShowStudyModal] = useState(false);
  const [showEditDeckModal, setShowEditDeckModal] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [activeDeck, setActiveDeck] = useState<FlashcardDeck | null>(null);
  const [editingDeck, setEditingDeck] = useState<FlashcardDeck | null>(null);
  const [studyDeckCards, setStudyDeckCards] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 💾 Loading State para skeleton loaders
  const { isSkeleton, isReady, setReady } = useLoadingState({ minLoadingTime: 350 });

  const activeCloseRef = useRef<(() => void) | null>(null);

  const searchAnim = useRef(new Animated.Value(0)).current;
  const searchInputRef = useRef<TextInput>(null);

  const {
    isLoading,
    searchQuery,
    setSearchQuery,
    activeSubjectId,
    setActiveSubjectId,
    filteredDecks,
    loadDecks,
  } = useFlashcardsManager(subjects);

  const handleOpenMenu = useCallback(() => {
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
  }, [t]);

  const handleOpenStudy = useCallback(async (deck: FlashcardDeck) => {
    try {
      setActiveDeck(deck);
      const cards = await getFlashcardsPrioritized(deck.id);
      setStudyDeckCards(Array.isArray(cards) ? cards : []);
      setShowStudyModal(true);
    } catch (e: any) {
      showAlert({ title: t('common.error', 'Error'), message: e.message || 'Error al cargar las tarjetas', type: 'error' });
    }
  }, [t, showAlert]);

  const handleOpenEditDeck = useCallback((deck: FlashcardDeck) => {
    setEditingDeck(deck);
    setShowEditDeckModal(true);
  }, []);

  const handleDeleteDeck = useCallback((deck: FlashcardDeck) => {
    showAlert({
      title: t('modals.deleteDeck', 'Eliminar Mazo'),
      message: t('modals.deleteDeckConfirm', { title: deck.title, defaultValue: `¿Estás seguro de que deseas eliminar el mazo "${deck.title}"? Esta acción no se puede deshacer.` }),
      type: 'confirm',
      buttons: [
        { text: t('common.cancel', 'Cancelar'), style: 'cancel' },
        {
          text: t('common.delete', 'Eliminar'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteFlashcardDeck(deck.id);
              await loadDecks();
              // Refrescar predicciones después de eliminar el mazo
              const userId = await getUserId();
              if (userId) {
                await refreshPredictions(userId);
              }
            } catch (e: any) {
              showAlert({ title: t('common.error', 'Error'), message: e.message || 'Error al eliminar el mazo', type: 'error' });
            }
          },
        },
      ],
    });
  }, [t, showAlert, loadDecks, refreshPredictions]);

  const renderSwipeActions = useCallback((deck: FlashcardDeck, close: () => void) => {
    const pillWidth = 101; // 50 (add btn) + 1 (divider) + 50 (delete btn)
    return (
      <View style={[flashcardStyles.swipeActionsPill, { width: pillWidth }]}>
        <TouchableOpacity
          style={flashcardStyles.swipeActionBtn}
          onPress={() => { close(); setActiveDeck(deck); setShowNewCardModal(true); }}
          activeOpacity={0.6}
        >
          <Ionicons name="add" size={18} color={theme.colors.text.secondary} />
        </TouchableOpacity>

        <View style={flashcardStyles.swipeActionDivider} />
        <TouchableOpacity
          style={flashcardStyles.swipeActionBtn}
          onPress={() => { close(); handleDeleteDeck(deck); }}
          activeOpacity={0.6}
        >
          <Ionicons name="trash-outline" size={17} color={theme.colors.danger} />
        </TouchableOpacity>
      </View>
    );
  }, [handleDeleteDeck]);

  // Refresh handler
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await loadDecks();
    } catch (e) {
      console.warn('Error refreshing decks:', e);
    } finally {
      setIsRefreshing(false);
    }
  }, [loadDecks]);



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
          const userId = await getUserId();
          setCurrentUserId(userId ? Number(userId) : null);
          const subs = await getSubjects();
          setSubjects(subs || []);
        } catch (e) {
          console.warn('Error loading subjects:', e);
        }
        await loadDecks();
        setReady();
      };
      loadAll();
    }, [loadDecks, setReady])
  );

  if (isSkeleton && filteredDecks.length === 0) {
    return <FlashcardsLoadingState />;
  }

  const isEmpty = filteredDecks.length === 0;

  return (
    <GestureHandlerRootView style={[styles.container, { flex: 1 }]}>
      {/* ── Main Content ─────────────────────────────────── */}
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
          {t('flashcards.decks', 'Mazos')}
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
                {t('common.all', 'Todos')}
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
      {isEmpty ? (
        <ScrollView
          contentContainerStyle={[styles.listContent, { paddingBottom: 120 }]}
          showsVerticalScrollIndicator={false}
        >
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
        </ScrollView>
      ) : (
        <FlatList
          data={filteredDecks}
          keyExtractor={(deck) => deck.id.toString()}
          scrollEnabled={true}
          contentContainerStyle={[styles.listContent, { gap: 12, paddingBottom: 120 }]}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          updateCellsBatchingPeriod={50}
          initialNumToRender={10}
          refreshControl={
            <RefreshControl 
              refreshing={isRefreshing} 
              onRefresh={handleRefresh}
              colors={[theme.colors.primary]}
              tintColor={theme.colors.primary}
            />
          }
          renderItem={({ item: deck }) => {
            const isShared = deck.user_id != null && Number(deck.user_id) !== Number(currentUserId);
            const duedeckIds = getDuedeckIds();
            const isDue = duedeckIds.has(deck.id);
            return (
                <SwipeableCard
                  onOpen={(closeFn) => {
                    if (activeCloseRef.current && activeCloseRef.current !== closeFn) {
                      activeCloseRef.current();
                    }
                    activeCloseRef.current = closeFn;
                  }}
                  renderActions={(close) => renderSwipeActions(deck, close)}
                >
                  <DeckCard
                    deck={deck}
                    isShared={isShared}
                    currentUserId={currentUserId}
                    isDue={isDue}
                    onPress={() => handleOpenStudy(deck)}
                    onLongPress={() => handleOpenEditDeck(deck)}
                    t={t}
                  />
                </SwipeableCard>
            );
          }}
            />
      )}

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
      </View>

      {/* ── Modals ─────────────────────────────────── */}
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

      {/* ── New Card Modal ────────────────────────────────────── */}
      <Modal
        visible={showNewCardModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNewCardModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.28)' }}>
          <Pressable
            style={{ flex: 1 }}
            onPress={() => setShowNewCardModal(false)}
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
            {activeDeck && (
              <FlashcardNewCardScreen
                activeDeck={activeDeck}
                onBack={() => setShowNewCardModal(false)}
                onCardCreated={() => {
                  setShowNewCardModal(false);
                  loadDecks();
                }}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* ── Edit Deck Modal ────────────────────────────────────── */}
      <Modal
        visible={showEditDeckModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditDeckModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' }}>
          {/* Pressable overlay para cerrar */}
          <Pressable
            style={{ flex: 1 }}
            onPress={() => setShowEditDeckModal(false)}
          />
          
          {/* Modal content sheet */}
          <View
            style={{
              backgroundColor: theme.colors.background,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingHorizontal: 24,
              paddingTop: 20,
              paddingBottom: Math.max(insets.bottom + 24, 60),
              minHeight: 300,
            }}
          >
            {editingDeck && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <Text style={{ fontSize: 18, fontWeight: '700', color: theme.colors.text.primary }}>
                    {t('flashcards.editDeck', 'Editar Mazo')}
                  </Text>
                  <TouchableOpacity onPress={() => setShowEditDeckModal(false)}>
                    <Ionicons name="close" size={24} color={theme.colors.text.primary} />
                  </TouchableOpacity>
                </View>

                {/* Deck Name Input */}
                <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.text.primary, marginBottom: 8 }}>
                  {t('flashcards.deckName', 'Nombre del mazo')}
                </Text>
                <TextInput
                  value={editingDeck.title}
                  onChangeText={(text) => setEditingDeck({ ...editingDeck, title: text })}
                  style={{
                    backgroundColor: theme.colors.inputBackground,
                    borderRadius: 12,
                    padding: 12,
                    fontSize: 14,
                    color: theme.colors.text.primary,
                    marginBottom: 20,
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                  }}
                  placeholder={t('flashcards.deckNamePlaceholder', 'Nombre del mazo')}
                  placeholderTextColor={theme.colors.text.placeholder}
                />

                {/* Subject Selection */}
                <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.text.primary, marginBottom: 12 }}>
                  {t('flashcards.subject')}
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginBottom: 24 }}
                  contentContainerStyle={{ gap: 8 }}
                >
                  {/* Sin materia option */}
                  <TouchableOpacity
                    onPress={() => setEditingDeck({ ...editingDeck, subject_id: null })}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 10,
                      borderRadius: 20,
                      borderWidth: 1.5,
                      backgroundColor: editingDeck.subject_id === null ? theme.colors.primary + '20' : 'transparent',
                      borderColor: editingDeck.subject_id === null ? theme.colors.primary : theme.colors.border,
                    }}
                  >
                    <Text
                      style={{
                        color: editingDeck.subject_id === null ? theme.colors.primary : theme.colors.text.secondary,
                        fontWeight: editingDeck.subject_id === null ? '700' : '500',
                        fontSize: 12,
                      }}
                    >
                      {t('flashcards.noSubject', 'Sin materia')}
                    </Text>
                  </TouchableOpacity>

                  {/* Subject options */}
                  {subjects.map((sub) => (
                    <TouchableOpacity
                      key={sub.id}
                      onPress={() => setEditingDeck({ ...editingDeck, subject_id: sub.id })}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingHorizontal: 14,
                        paddingVertical: 10,
                        borderRadius: 20,
                        borderWidth: 1.5,
                        backgroundColor: editingDeck.subject_id === sub.id ? (sub.color || theme.colors.primary) + '20' : 'transparent',
                        borderColor: editingDeck.subject_id === sub.id ? sub.color || theme.colors.primary : theme.colors.border,
                        gap: 6,
                      }}
                    >
                      <View
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: 8,
                          backgroundColor: sub.color || '#999',
                        }}
                      />
                      <Text
                        style={{
                          color: editingDeck.subject_id === sub.id ? sub.color || theme.colors.primary : theme.colors.text.secondary,
                          fontWeight: editingDeck.subject_id === sub.id ? '700' : '500',
                          fontSize: 12,
                        }}
                      >
                        {sub.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Save Button */}
                <TouchableOpacity
                  onPress={async () => {
                    try {
                      await updateFlashcardDeck(editingDeck.id, {
                        subject_id: editingDeck.subject_id || undefined,
                        title: editingDeck.title,
                      });
                      setShowEditDeckModal(false);
                      setEditingDeck(null);
                      loadDecks();
                      showAlert({ title: t('common.success'), message: t('flashcards.deckUpdated', 'Mazo actualizado'), type: 'success' });
                    } catch (e: any) {
                      showAlert({ title: t('common.error'), message: e.message, type: 'error' });
                    }
                  }}
                  style={{
                    backgroundColor: theme.colors.primary,
                    borderRadius: 24,
                    paddingVertical: 14,
                    paddingHorizontal: 24,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: 'white', fontWeight: '700', fontSize: 15 }}>{t('common.save', 'Guardar')}</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

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

      {/* ── Study Modal ────────────────────────────────────── */}
      <Modal
        visible={showStudyModal}
        animationType="slide"
        onRequestClose={() => setShowStudyModal(false)}
      >
        <View style={{ flex: 1 }}>
          {activeDeck && (
            <FlashcardStudyScreenStandalone
              activeDeck={activeDeck}
              initialCards={studyDeckCards}
              currentUserId={currentUserId}
              onBack={() => {
                setShowStudyModal(false);
                setActiveDeck(null);
                setStudyDeckCards([]);
              }}
            />
          )}
        </View>
      </Modal>
    </GestureHandlerRootView>
  );
}
