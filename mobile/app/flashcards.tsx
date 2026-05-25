import React from 'react';
import { View, FlatList, RefreshControl, StatusBar, Text, TouchableOpacity, Modal } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../src/styles/theme';
import { recordingsStyles } from '../src/styles/RecordingsScreen.styles';
import { flashcardsStyles as flashcardStyles } from '../src/styles/FlashcardsModal.styles';

import { PremiumLoading } from '../src/components/PremiumLoading';
import { FlashcardImportModal } from '../src/components/FlashcardImportModal';
import { SwipeableCard } from '../src/components/SwipeableCard';
import { FlashcardStudyScreenStandalone } from '../src/components/FlashcardStudyScreenStandalone';
import { FlashcardHeader } from '../src/components/flashcards/FlashcardHeader';
import { FlashcardSearchBar } from '../src/components/flashcards/FlashcardSearchBar';
import { FlashcardSubjectPills } from '../src/components/flashcards/FlashcardSubjectPills';
import { FlashcardDeckCard } from '../src/components/flashcards/FlashcardDeckCard';
import { EmptyFlashcards } from '../src/components/flashcards/EmptyFlashcards';
import { FlashcardFloatingButton } from '../src/components/flashcards/FlashcardFloatingButton';
import { NewDeckModal } from '../src/components/flashcards/NewDeckModal';
import { NewCardModal } from '../src/components/flashcards/NewCardModal';
import { EditDeckModal } from '../src/components/flashcards/EditDeckModal';
import { MenuModal } from '../src/components/flashcards/MenuModal';
import { useFlashcards } from '../src/hooks/useFlashcards';

export default function FlashcardsScreen() {
  const {
    showSearch, showNewDeckModal, showImportModal, showMenuModal, showNewCardModal,
    showStudyModal, showEditDeckModal, subjects, activeDeck, editingDeck, studyDeckCards,
    currentUserId, isRefreshing, activeCloseRef, searchAnim, searchInputRef,
    isLoading, searchQuery, setSearchQuery, activeSubjectId, setActiveSubjectId,
    filteredDecks, loadDecks, getDuedeckIds,
    setShowNewDeckModal, setShowImportModal, setShowMenuModal, setShowNewCardModal,
    setShowStudyModal, setShowEditDeckModal, setActiveDeck, setStudyDeckCards,
    handleOpenMenu, handleOpenStudy, handleOpenEditDeck, renderSwipeActions,
    handleRefresh, toggleSearch,
  } = useFlashcards();

  if (isLoading && filteredDecks.length === 0) {
    return <PremiumLoading text="CARGANDO" />;
  }

  const isEmpty = filteredDecks.length === 0;

  return (
    <GestureHandlerRootView style={[recordingsStyles.container, { flex: 1 }]}>
      <View style={[recordingsStyles.container, { flex: 1 }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar barStyle="dark-content" backgroundColor={theme.colors.card} translucent={false} />

        <FlashcardHeader
          showSearch={showSearch}
          onToggleSearch={toggleSearch}
          onOpenMenu={handleOpenMenu}
        />

        <FlashcardSearchBar
          searchAnim={searchAnim}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          inputRef={searchInputRef}
        />

        <FlashcardSubjectPills
          subjects={subjects}
          activeSubjectId={activeSubjectId}
          onSelect={setActiveSubjectId}
        />

        {isEmpty ? (
          <EmptyFlashcards />
        ) : (
          <FlatList
            data={filteredDecks}
            keyExtractor={(deck) => deck.id.toString()}
            scrollEnabled={true}
            contentContainerStyle={[recordingsStyles.listContent, { gap: 12, paddingBottom: 120 }]}
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
              const { pillWidth, onAddPress, onDeletePress } = renderSwipeActions(deck, () => {});
              return (
                <SwipeableCard
                  onOpen={(closeFn) => {
                    if (activeCloseRef.current && activeCloseRef.current !== closeFn) {
                      activeCloseRef.current();
                    }
                    activeCloseRef.current = closeFn;
                  }}
                  renderActions={(close) => (
                    <View style={[flashcardStyles.swipeActionsPill, { width: pillWidth }]}>
                      <TouchableOpacity
                        style={flashcardStyles.swipeActionBtn}
                        onPress={() => { close(); onAddPress(); }}
                        activeOpacity={0.6}
                      >
                        <Ionicons name="add" size={18} color={theme.colors.text.secondary} />
                      </TouchableOpacity>
                      <View style={flashcardStyles.swipeActionDivider} />
                      <TouchableOpacity
                        style={flashcardStyles.swipeActionBtn}
                        onPress={() => { close(); onDeletePress(); }}
                        activeOpacity={0.6}
                      >
                        <Ionicons name="trash-outline" size={17} color={theme.colors.danger} />
                      </TouchableOpacity>
                    </View>
                  )}
                >
                  <FlashcardDeckCard
                    deck={deck}
                    isShared={isShared}
                    currentUserId={currentUserId}
                    isDue={isDue}
                    onPress={() => handleOpenStudy(deck)}
                    onLongPress={() => handleOpenEditDeck(deck)}
                  />
                </SwipeableCard>
              );
            }}
          />
        )}

        <FlashcardFloatingButton onPress={() => setShowNewDeckModal(true)} />
      </View>

      <NewDeckModal
        visible={showNewDeckModal}
        subjects={subjects}
        onClose={() => setShowNewDeckModal(false)}
        onDeckCreated={() => { setShowNewDeckModal(false); loadDecks(); }}
      />

      <FlashcardImportModal
        isVisible={showImportModal}
        onClose={() => setShowImportModal(false)}
        subjects={subjects}
        onImportSuccess={() => loadDecks()}
      />

      <NewCardModal
        visible={showNewCardModal}
        deck={activeDeck}
        onClose={() => setShowNewCardModal(false)}
        onCardCreated={() => { setShowNewCardModal(false); loadDecks(); }}
      />

      <EditDeckModal
        visible={showEditDeckModal}
        deck={editingDeck}
        subjects={subjects}
        onClose={() => setShowEditDeckModal(false)}
        onSaved={() => loadDecks()}
      />

      <MenuModal
        visible={showMenuModal}
        onClose={() => setShowMenuModal(false)}
        onCreateDeck={() => setShowNewDeckModal(true)}
        onImportDeck={() => setShowImportModal(true)}
      />

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
