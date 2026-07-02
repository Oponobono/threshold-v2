import React from 'react';
import { View, FlatList, RefreshControl, StatusBar, Text, TouchableOpacity, Modal, Pressable, TextInput, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { Ionicons , MaterialCommunityIcons } from '@expo/vector-icons';

import { theme } from '../src/styles/theme';
import { recordingsStyles } from '../src/styles/RecordingsScreen.styles';
import { flashcardsStyles as flashcardStyles } from '../src/styles/FlashcardsModal.styles';

import { PremiumLoading } from '../src/components/ui/PremiumLoading';
import { FlashcardImportModal } from '../src/components/flashcards/FlashcardImportModal';
import { SwipeableCard } from '../src/components/ui/SwipeableCard';
import { FlashcardStudyScreenStandalone } from '../src/components/flashcards/FlashcardStudyScreenStandalone';
import { FlashcardHeader } from '../src/components/flashcards/FlashcardHeader';
import { FlashcardSearchBar } from '../src/components/flashcards/FlashcardSearchBar';
import { FlashcardSubjectPills } from '../src/components/flashcards/FlashcardSubjectPills';
import { GroupPills } from '../src/components/flashcards/GroupPills';
import { FlashcardDeckCard } from '../src/components/flashcards/FlashcardDeckCard';
import { EmptyFlashcards } from '../src/components/flashcards/EmptyFlashcards';
import { FlashcardFloatingButton } from '../src/components/flashcards/FlashcardFloatingButton';
import { NewDeckModal } from '../src/components/flashcards/NewDeckModal';
import { NewCardModal } from '../src/components/flashcards/NewCardModal';
import { EditDeckModal } from '../src/components/flashcards/EditDeckModal';
import { LinkExamModal } from '../src/components/flashcards/LinkExamModal';
import { MenuModal } from '../src/components/flashcards/MenuModal';
import { useFlashcards } from '../src/hooks/useFlashcards';
import { useTranslation } from 'react-i18next';
import { useCustomAlert } from '../src/components/ui/CustomAlert';

export default function FlashcardsScreen() {
  const { t } = useTranslation();
  const { showAlert } = useCustomAlert();
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
    // Share
    shareDeckTarget, setShareDeckTarget,
    sharePin, setSharePin,
    isSharing, handleShareDeck,
    // Exam
    linkExamTarget, setLinkExamTarget,
    // Groups
    activeTab, setActiveTab,
    groups, activeGroupPin, setActiveGroupPin,
    groupDecks, loadingGroups,
    isGroupAdmin, handleRemoveFromGroup,
  } = useFlashcards();

  if (isLoading && filteredDecks.length === 0 && activeTab === 'mazos') {
    return <PremiumLoading text="CARGANDO" />;
  }

  const isEmpty = filteredDecks.length === 0;

  return (
    <GestureHandlerRootView style={[recordingsStyles.container, { flex: 1 }]}>
      <SafeAreaView edges={['top', 'left', 'right']} style={[recordingsStyles.container, { flex: 1 }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <StatusBar barStyle="dark-content" backgroundColor={theme.colors.card} translucent={false} />

        <FlashcardHeader
          showSearch={showSearch}
          onToggleSearch={toggleSearch}
          onOpenMenu={handleOpenMenu}
        />

        {activeTab === 'mazos' && (
          <>
            <FlashcardSearchBar
              searchAnim={searchAnim}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              inputRef={searchInputRef}
            />

            <FlashcardSubjectPills
              subjects={subjects}
              activeSubjectId={activeSubjectId as string | null}
              onSelect={setActiveSubjectId as (id: string | null) => void}
            />
          </>
        )}

        {/* Tab Switcher */}
        <View style={{ flexDirection: 'row', marginHorizontal: 16, marginBottom: 8, gap: 0 }}>
          <TouchableOpacity
            onPress={() => setActiveTab('mazos')}
            style={{
              flex: 1, paddingVertical: 8, alignItems: 'center',
              borderBottomWidth: 2,
              borderBottomColor: activeTab === 'mazos' ? theme.colors.primary : 'transparent',
            }}
          >
            <Text style={{
              fontWeight: activeTab === 'mazos' ? '700' : '400',
              color: activeTab === 'mazos' ? theme.colors.primary : theme.colors.text.secondary,
              fontSize: 14,
            }}>{t('flashcards.myDecks')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab('grupos')}
            style={{
              flex: 1, paddingVertical: 8, alignItems: 'center',
              borderBottomWidth: 2,
              borderBottomColor: activeTab === 'grupos' ? theme.colors.primary : 'transparent',
            }}
          >
            <Text style={{
              fontWeight: activeTab === 'grupos' ? '700' : '400',
              color: activeTab === 'grupos' ? theme.colors.primary : theme.colors.text.secondary,
              fontSize: 14,
            }}>{t('flashcards.groups')}</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'mazos' ? (
          <>
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
                  // OFFLINE-FIRST: Un mazo local recién importado se considera del usuario
                  const isShared = deck.user_id != null && String(deck.user_id) !== String(currentUserId) && !(deck as any)._local;
                  const duedeckIds = getDuedeckIds();
                  const isDue = duedeckIds.has(deck.id);
                  const { pillWidth, onAddPress, onSharePress, onExamLinkPress, onDeletePress, onUnlinkPress } = renderSwipeActions(deck, () => {});
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
                          {onSharePress && (
                            <>
                              <View style={flashcardStyles.swipeActionDivider} />
                              <TouchableOpacity
                                style={flashcardStyles.swipeActionBtn}
                                onPress={() => { close(); onSharePress(); }}
                                activeOpacity={0.6}
                              >
                                <Ionicons name="share-social-outline" size={17} color={theme.colors.text.secondary} />
                              </TouchableOpacity>
                            </>
                          )}
                          {onExamLinkPress && (
                            <>
                              <View style={flashcardStyles.swipeActionDivider} />
                              <TouchableOpacity
                                style={flashcardStyles.swipeActionBtn}
                                onPress={() => { close(); onExamLinkPress(); }}
                                activeOpacity={0.6}
                              >
                                <Ionicons name="calendar-outline" size={17} color={theme.colors.text.secondary} />
                              </TouchableOpacity>
                            </>
                          )}
                          {onUnlinkPress && (
                            <>
                              <View style={flashcardStyles.swipeActionDivider} />
                              <TouchableOpacity
                                style={flashcardStyles.swipeActionBtn}
                                onPress={() => { close(); onUnlinkPress(); }}
                                activeOpacity={0.6}
                              >
                                <Ionicons name="link-outline" size={17} color={theme.colors.danger} />
                              </TouchableOpacity>
                            </>
                          )}
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
          </>
        ) : (
          <>
            {groups.length === 0 ? (
              <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 }}>
                <Ionicons name="people-outline" size={48} color={theme.colors.text.placeholder} />
                <Text style={{ color: theme.colors.text.secondary, fontSize: 14, marginTop: 12, textAlign: 'center' }}>
                  {t('flashcards.notInAnyGroup')}
                </Text>
              </View>
            ) : (
              <>
                <GroupPills
                  groups={groups}
                  activeGroupPin={activeGroupPin}
                  onSelect={setActiveGroupPin}
                />
                {loadingGroups ? (
                  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ color: theme.colors.text.secondary, fontSize: 14 }}>
                      {t('flashcards.loading')}
                    </Text>
                  </View>
                ) : (
                  <FlatList
                    data={groupDecks}
                    keyExtractor={(d) => d.id.toString()}
                    contentContainerStyle={[recordingsStyles.listContent, { gap: 12, paddingBottom: 120 }]}
                    showsVerticalScrollIndicator={false}
                    renderItem={({ item }) => {
                      const isOwn = (item as any).is_own;
                      const duedeckIds = getDuedeckIds();
                      const isDue = duedeckIds.has(item.id);
                      const canRemove = (isOwn || isGroupAdmin) && (!!activeGroupPin || !!(item as any)._groupPinId);
                      const card = (
                        <TouchableOpacity
                          style={[flashcardStyles.deckCard, { marginBottom: 0, borderWidth: 1, borderColor: isDue ? theme.colors.danger : '#E0E0E0' }]}
                          activeOpacity={0.85}
                          onPress={() => handleOpenStudy(item)}
                        >
                            <View style={[flashcardStyles.deckBadge, { backgroundColor: (item as any).subject_color || '#DDE7FF' }]}>
                              <MaterialCommunityIcons
                                name={(item as any).subject_icon || 'cards-outline'}
                                size={20}
                                color={theme.colors.text.primary}
                              />
                            </View>
                            <View style={{ flex: 1, paddingRight: 8 }}>
                              <Text style={flashcardStyles.deckTitle} numberOfLines={1}>{item.title}</Text>
                              {!isOwn && (
                                <Text style={{ fontSize: 11, color: '#388E3C', fontStyle: 'italic', marginBottom: 2 }}>
                                  por @{item.owner_username || t('flashcards.classmate')}
                                </Text>
                              )}
                              <Text style={flashcardStyles.deckMeta} numberOfLines={1}>{(item as any).subject_name || t('flashcards.noSubject')}</Text>
                              <View style={flashcardStyles.deckStatsRow}>
                                <Text style={flashcardStyles.statLabel}>{Number(item.card_count ?? 0)} tarjetas</Text>
                                {Number(item.card_count ?? 0) > 0 && (
                                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Text style={flashcardStyles.statValueSuccess}>✓ {Number(item.review_count ?? 0)}</Text>
                                    <Text style={flashcardStyles.statValuePending}>💪 {Number(item.learning_count ?? 0) + Number(item.new_count ?? 0)}</Text>
                                  </View>
                                )}
                              </View>
                            </View>
                          </TouchableOpacity>
                        );
                      return canRemove ? (
                        <SwipeableCard
                          onOpen={(closeFn) => {
                            if (activeCloseRef.current && activeCloseRef.current !== closeFn) activeCloseRef.current();
                            activeCloseRef.current = closeFn;
                          }}
                          renderActions={(close) => (
                            <View style={[flashcardStyles.swipeActionsPill, { width: 70 }]}>
                              <TouchableOpacity
                                style={flashcardStyles.swipeActionBtn}
                                onPress={() => { close(); handleRemoveFromGroup(item, (item as any)._groupPinId || activeGroupPin!); }}
                                activeOpacity={0.6}
                              >
                                <Ionicons name="trash-outline" size={17} color={theme.colors.danger} />
                              </TouchableOpacity>
                            </View>
                          )}
                        >
                          {card}
                        </SwipeableCard>
                      ) : card;
                    }}
                  />
                )}
              </>
            )}
          </>
        )}
      </SafeAreaView>

      <NewDeckModal
        visible={showNewDeckModal}
        subjects={subjects}
        onClose={() => setShowNewDeckModal(false)}
        onDeckCreated={() => { setShowNewDeckModal(false); loadDecks({ skipCache: true }); }}
      />

      <FlashcardImportModal
        isVisible={showImportModal}
        onClose={() => setShowImportModal(false)}
        subjects={subjects}
        onImportSuccess={() => loadDecks({ skipCache: true })}
      />

      <NewCardModal
        visible={showNewCardModal}
        deck={activeDeck}
        onClose={() => setShowNewCardModal(false)}
        onCardCreated={() => { setShowNewCardModal(false); loadDecks({ skipCache: true }); }}
      />

      <EditDeckModal
        visible={showEditDeckModal}
        deck={editingDeck}
        subjects={subjects}
        onClose={() => setShowEditDeckModal(false)}
        onSaved={() => loadDecks({ skipCache: true })}
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
                loadDecks({ skipCache: true });
              }}
            />
          )}
        </View>
      </Modal>

      {/* ─── LINK EXAM MODAL ─── */}
      <LinkExamModal
        visible={!!linkExamTarget}
        deck={linkExamTarget}
        onClose={() => setLinkExamTarget(null)}
        onLinked={async (examTitle) => {
          showAlert({
            title: '¡Modo Examen activo!',
            message: `El mazo "${linkExamTarget?.title}" ya está vinculado a "${examTitle}". Los intervalos se comprimirán automáticamente.`,
            type: 'success',
          });
          setLinkExamTarget(null);
          await loadDecks({ skipCache: true });
        }}
        onUnlinked={async () => {
          showAlert({
            title: 'Vínculo eliminado',
            message: `El mazo "${linkExamTarget?.title}" ya no está vinculado a ningún examen.`,
            type: 'info',
          });
          setLinkExamTarget(null);
          await loadDecks({ skipCache: true });
        }}
      />

      {/* ─── SHARE DECK MODAL ─── */}
      <Modal visible={!!shareDeckTarget} transparent animationType="fade">
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }}
          onPress={() => { setShareDeckTarget(null); setSharePin(''); }}
        >
          <Pressable
            style={{ backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '85%', gap: 12 }}
            onPress={() => null}
          >
            <Text style={{ fontSize: 17, fontWeight: '700', color: theme.colors.text.primary }}>
              {t('flashcards.shareDeck')}
            </Text>
            <Text style={{ fontSize: 13, color: theme.colors.text.secondary }}>
              {t('flashcards.shareDeckDesc', { title: shareDeckTarget?.title ?? '' })}
            </Text>
            <TextInput
              style={{
                borderWidth: 1.5,
                borderColor: theme.colors.border,
                borderRadius: 10,
                padding: 12,
                fontSize: 20,
                fontWeight: '700',
                letterSpacing: 4,
                textAlign: 'center',
                color: theme.colors.text.primary,
              }}
              placeholder={t('flashcards.sharePinPlaceholder')}
              placeholderTextColor={theme.colors.text.placeholder}
              value={sharePin}
              onChangeText={setSharePin}
              autoCapitalize="characters"
              maxLength={8}
            />
            {groups.length > 0 && (
              <>
                <Text style={{ fontSize: 13, color: theme.colors.text.secondary, textAlign: 'center', marginTop: 4 }}>
                  {t('flashcards.shareWithGroup')}
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 36 }}>
                  {groups.map((g) => (
                    <TouchableOpacity
                      key={g.group_pin_id}
                      onPress={() => handleShareDeck(g.group_pin_id)}
                      style={{
                        paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16, marginRight: 8,
                        backgroundColor: theme.colors.primary + '20',
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.primary }}>
                        {g.name || g.group_pin_id}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <TouchableOpacity
                style={{ flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' }}
                onPress={() => { setShareDeckTarget(null); setSharePin(''); }}
              >
                <Text style={{ color: theme.colors.text.secondary, fontWeight: '600' }}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  { flex: 1, padding: 12, borderRadius: 10, backgroundColor: theme.colors.primary, alignItems: 'center' },
                  (!sharePin.trim() || isSharing) && { opacity: 0.5 },
                ]}
                onPress={() => handleShareDeck()}
                disabled={!sharePin.trim() || isSharing}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>
                  {isSharing ? t('flashcards.sharing') : t('flashcards.shareDeck')}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </GestureHandlerRootView>
  );
}
