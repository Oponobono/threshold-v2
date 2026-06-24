import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  RefreshControl,
} from 'react-native';
import LottieView from 'lottie-react-native';
import { useRouter } from 'expo-router';
import { useCustomAlert } from '../ui/CustomAlert';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SwipeableCard } from '../ui/SwipeableCard';
import { useTranslation } from 'react-i18next';
import { theme } from '../../styles/theme';
import { flashcardsStyles as s } from '../../styles/FlashcardsModal.styles';
import {
  type Subject,
  type FlashcardDeck,
  type Flashcard,
  getFlashcardDecksWithMetrics,
  getFlashcardsPrioritized,
  getUserId,
  shareDeck,
  removeDeckFromGroup,
  deleteFlashcardDeck,
} from '../../services/api';
import { useDataStore } from '../../store/useDataStore';
import { getUserGroups, getGroupDecks } from '../../services/api/learning/groups';

import { GroupPills } from './GroupPills';

import { FlashcardStudyScreen } from './FlashcardStudyScreen';
import { FlashcardNewDeckScreen } from './FlashcardNewDeckScreen';
import { FlashcardNewCardScreen } from './FlashcardNewCardScreen';

// ─── Types ───────────────────────────────────────────────────────────────────

type Screen = 'hub' | 'study' | 'newDeck' | 'newCard';

interface Props {
  isVisible: boolean;
  onClose: () => void;
  subjects: Subject[];
}

// ─── Main Component ───────────────────────────────────────────────────────────

/**
 * FlashcardsModal.tsx
 *
 * Modal principal del módulo de Flashcards. Actúa como router interno entre 4 sub-pantallas:
 * - `hub`: Listado de mazos con swipe-to-reveal para crear tarjeta, compartir y eliminar.
 * - `study`: Sesión de estudio por repetición espaciada (FlashcardStudyScreen).
 * - `newDeck`: Formulario para crear un mazo nuevo (FlashcardNewDeckScreen).
 * - `newCard`: Formulario para añadir una tarjeta a un mazo existente (FlashcardNewCardScreen).
 */
export const FlashcardsModal: React.FC<Props> = ({ isVisible, onClose, subjects }) => {
  const { t } = useTranslation();
  const { showAlert } = useCustomAlert();
  const router = useRouter();
  const { getDuedeckIds } = useDataStore();
  const [screen, setScreen] = useState<Screen>('hub');
  const [decks, setDecks] = useState<FlashcardDeck[]>([]);

  const [activeDeck, setActiveDeck] = useState<FlashcardDeck | null>(null);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const activeCloseRef = useRef<(() => void) | null>(null);

  // Groups tab state
  const [activeTab, setActiveTab] = useState<'mazos' | 'grupos'>('mazos');
  const [groups, setGroups] = useState<any[]>([]);
  const [activeGroupPin, setActiveGroupPin] = useState<string | null>(null);
  const [groupDecks, setGroupDecks] = useState<FlashcardDeck[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);

  // Share deck modal state
  const [shareDeckTarget, setShareDeckTarget] = useState<FlashcardDeck | null>(null);
  const [sharePin, setSharePin] = useState('');
  const [isSharing, setIsSharing] = useState(false);

  // Check if user is admin of the active group
  const isGroupAdmin = activeGroupPin ? groups.some(
    (g: any) => g.group_pin_id === activeGroupPin && g.role === 'creator'
  ) : false;

  const [removingFromGroup, setRemovingFromGroup] = useState(false);

  const handleRemoveFromGroup = async (deck: FlashcardDeck, groupPin: string) => {
    showAlert({
      title: t('modals.removeFromGroup'),
      message: t('modals.removeFromGroupConfirm'),
      type: 'confirm',
      buttons: [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            if (removingFromGroup) return;
            setRemovingFromGroup(true);
            try {
              await removeDeckFromGroup(deck.id, groupPin);
              showAlert({ title: t('common.success'), message: t('modals.removedFromGroup'), type: 'success' });
              // Refresh group decks
              if (activeGroupPin) {
                getGroupDecks(activeGroupPin).then(d => setGroupDecks(d || []));
              }
            } catch (e: any) {
              showAlert({ title: t('common.error'), message: e.message, type: 'error' });
            } finally {
              setRemovingFromGroup(false);
            }
          },
        },
      ],
    });
  };

  const handleShareDeck = async (groupPinId?: string) => {
    if (!shareDeckTarget) return;
    if (!groupPinId && !sharePin.trim()) return;
    setIsSharing(true);
    try {
      const result = await shareDeck(shareDeckTarget.id, groupPinId ? { groupPinId } : { recipientPin: sharePin });
      showAlert({ title: t('common.success'), message: result.message, type: 'success' });
      setShareDeckTarget(null);
      setSharePin('');
    } catch (error: any) {
      showAlert({ title: t('common.error'), message: error.message, type: 'error' });
    } finally {
      setIsSharing(false);
    }
  };

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadDecks = async () => {
    try {
      const data = await getFlashcardDecksWithMetrics();
      setDecks(data || []);

      // Merge local MMKV decks (reemplazan a los de SQLite si existe el mismo ID)
      const { getLocalDecksForCurrentUser } = await import('../../services/localFlashcardService');
      const localDecks = getLocalDecksForCurrentUser(await getUserId());
      if (localDecks.length > 0) {
        setDecks(prev => {
          const localIds = new Set(localDecks.map(ld => String(ld.id)));
          const merged = prev.filter(d => {
            if (localIds.has(String(d.id))) return false;
            const isNegativeId = !isNaN(Number(d.id)) && Number(d.id) < 0;
            if (isNegativeId) return false;
            return true;
          });
          merged.push(...localDecks as any);
          return merged;
        });
      }
    } catch (e) {
      console.warn('Error loading decks:', e);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDecks();
    setRefreshing(false);
  };

  useEffect(() => {
    if (isVisible) {
      setActiveTab('mazos');
      setScreen('hub');
      loadDecks();
      getUserId().then(id => setCurrentUserId(id || null));
      // Load groups
      getUserGroups().then(g => {
        const valid = (g || []).filter((gr: any) => gr.group_pin_id);
        setGroups(valid);
        if (valid.length > 0) {
          setActiveGroupPin(valid[0].group_pin_id);
        }
      });
    }
  }, [isVisible]);

  // Load group decks when selected group changes
  useEffect(() => {
    if (activeTab !== 'grupos') { setGroupDecks([]); return; }
    setLoadingGroups(true);
    if (activeGroupPin) {
      getGroupDecks(activeGroupPin).then(decks => { setGroupDecks(decks || []); setLoadingGroups(false); });
    } else if (groups.length > 0) {
      Promise.all(groups.map((g: any) =>
        getGroupDecks(g.group_pin_id).then(decks =>
          (decks || []).map((d: any) => ({ ...d, _groupPinId: g.group_pin_id }))
        )
      )).then(results => {
        const seen = new Set();
        setGroupDecks(results.flat().filter((d: any) => { if (!d || seen.has(d.id)) return false; seen.add(d.id); return true; }));
        setLoadingGroups(false);
      });
    } else {
      setGroupDecks([]); setLoadingGroups(false);
    }
  }, [activeGroupPin, activeTab, groups]);

  // ── Study session ─────────────────────────────────────────────────────────

  const openStudySession = async (deck: FlashcardDeck) => {
    try {
      const data = await getFlashcardsPrioritized(deck.id);
      if (!data || data.length === 0) {
        showAlert({ title: t('flashcards.noCards'), message: t('flashcards.noCardsMsg'), type: 'info' });
        return;
      }
      setCards(data);
      setActiveDeck(deck);
      setScreen('study');
    } catch (e) {
      console.warn('Error loading cards:', e);
    }
  };

  const goBackToHub = () => {
    loadDecks();
    setScreen('hub');
  };

  const handleDeleteDeck = (deck: FlashcardDeck) => {
    const isOwner = String(deck.user_id) === String(currentUserId) || !!(deck as any)._local;
    showAlert({
      title: isOwner ? t('modals.deleteDeck') : t('flashcards.removeShared'),
      message: isOwner
        ? t('modals.deleteDeckConfirm', { title: deck.title, defaultValue: `¿Estás seguro de que deseas eliminar el mazo "${deck.title}"? Esta acción no se puede deshacer.` })
        : t('flashcards.removeSharedConfirm', { title: deck.title, defaultValue: `¿Deseas quitar el mazo "${deck.title}" de tu lista?` }),
      type: 'confirm',
      buttons: [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteFlashcardDeck(deck.id);
              await loadDecks();
            } catch (e: any) {
              showAlert({ title: t('common.error'), message: e.message || t('common.error'), type: 'error' });
            }
          },
        },
      ],
    });
  };

  // ── Swipe actions ─────────────────────────────────────────────────────────

  const renderSwipeActions = (deck: FlashcardDeck, close: () => void) => {
    const isOwner = String(deck.user_id) === String(currentUserId) || !!(deck as any)._local;
    // Explicit width is CRITICAL for react-native-gesture-handler to know how far to swipe
    const pillWidth = isOwner ? 152 : 101;
    
    return (
      <View style={[s.swipeActionsPill, { width: pillWidth }]}>
        <TouchableOpacity
          style={s.swipeActionBtn}
          onPress={() => { close(); setActiveDeck(deck); setScreen('newCard'); }}
          activeOpacity={0.6}
        >
          <Ionicons name="add" size={18} color={theme.colors.text.secondary} />
        </TouchableOpacity>

        {isOwner && (
          <>
            <View style={s.swipeActionDivider} />
            <TouchableOpacity
              style={s.swipeActionBtn}
              onPress={() => { close(); setShareDeckTarget(deck); setSharePin(''); }}
              activeOpacity={0.6}
            >
              <Ionicons name="share-social-outline" size={17} color={theme.colors.text.secondary} />
            </TouchableOpacity>
          </>
        )}

        <View style={s.swipeActionDivider} />
        <TouchableOpacity
          style={s.swipeActionBtn}
          onPress={() => { close(); handleDeleteDeck(deck); }}
          activeOpacity={0.6}
        >
          <Ionicons name="trash-outline" size={17} color={theme.colors.danger} />
        </TouchableOpacity>
      </View>
    );
  };

  // ── Render screens ────────────────────────────────────────────────────────

  const renderHub = () => (
    <View style={{ flex: 1 }}>
      <View style={s.modalHeader}>
        <Text style={s.modalTitle}>{t('flashcards.title')}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity 
            onPress={() => {
              onClose();
              router.push('/flashcards' as any);
            }}
            style={s.closeBtn} 
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="list" size={22} color={theme.colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={s.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={22} color={theme.colors.text.secondary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab Switcher */}
      <View style={{ flexDirection: 'row', marginBottom: 12, gap: 0 }}>
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
          {decks.length === 0 ? (
            <View style={s.emptyState}>
              <MaterialCommunityIcons name="cards-outline" size={48} color={theme.colors.text.placeholder} />
              <Text style={s.emptyText}>{t('flashcards.emptyDecks')}</Text>
            </View>
          ) : (
            <FlatList
              data={decks}
              keyExtractor={(d) => d.id.toString()}
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: 8 }}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={[theme.colors.primary]}
                  tintColor={theme.colors.primary}
                />
              }
              renderItem={({ item }) => {
                const isShared = item.user_id != null && String(item.user_id) !== String(currentUserId) && !(item as any)._local;
                const duedeckIds = getDuedeckIds();
                const isDue = duedeckIds.has(item.id);
                return (
                  <SwipeableCard
                    onOpen={(closeFn) => {
                      if (activeCloseRef.current && activeCloseRef.current !== closeFn) {
                        activeCloseRef.current();
                      }
                      activeCloseRef.current = closeFn;
                    }}
                    renderActions={(close) => renderSwipeActions(item, close)}
                  >
                      <TouchableOpacity
                        style={[s.deckCard, { marginBottom: 0, borderWidth: 1, borderColor: isDue ? theme.colors.danger : '#E0E0E0' }]}
                        activeOpacity={0.85}
                        onPress={() => openStudySession(item)}
                      >
                      <View style={[s.deckBadge, { backgroundColor: (item as any).subject_color || '#DDE7FF' }]}>
                        <MaterialCommunityIcons
                          name={isShared ? 'account-group-outline' : (((item as any).subject_icon as any) || 'cards-outline')}
                          size={20}
                          color={theme.colors.text.primary}
                        />
                      </View>

                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <Text style={s.deckTitle} numberOfLines={1} ellipsizeMode="tail">{item.title}</Text>
                          {isShared && (
                            <View style={s.sharedBadge}>
                              <Ionicons name="people" size={10} color="#388E3C" />
                              <Text style={s.sharedBadgeText}>{t('modals.shared')}</Text>
                            </View>
                          )}
                        </View>
                        {isShared && (
                          <Text style={{ fontSize: 11, color: '#388E3C', fontStyle: 'italic', marginBottom: 2 }}>
                            {t('flashcards.sharedBy')} @{item.owner_username || item.owner_name || t('flashcards.peer')}
                          </Text>
                        )}
                        <Text style={s.deckMeta} numberOfLines={1}>{item.subject_name}</Text>
                        <View style={s.deckStatsRow}>
                          <Text style={s.statLabel}>{Number(item.card_count ?? 0)} {t('flashcards.cards')}</Text>
                          {Number(item.card_count ?? 0) > 0 && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                              <Text style={s.statValueSuccess}>✓ {Number(item.review_count ?? 0)}</Text>
                              <Text style={s.statValuePending}>💪 {Number(item.learning_count ?? 0) + Number(item.new_count ?? 0)}</Text>
                            </View>
                          )}
                        </View>
                      </View>

                      {/* Swipe hint indicator */}
                      <View style={{ width: 40, height: 40, marginRight: -6, transform: [{ rotate: '90deg' }] }}>
                        <LottieView
                          source={require('../../lottieFiles/arrow.json')}
                          autoPlay
                          loop
                          style={{ width: '100%', height: '100%' }}
                        />
                      </View>
                      </TouchableOpacity>
                  </SwipeableCard>
                );
              }}
            />
          )}

          <TouchableOpacity style={s.newDeckBtn} onPress={() => setScreen('newDeck')}>
            <Ionicons name="add-circle-outline" size={18} color={theme.colors.white} />
            <Text style={s.newDeckBtnText}>{t('flashcards.newDeck')}</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          {groups.length === 0 ? (
            <View style={s.emptyState}>
              <Ionicons name="people-outline" size={48} color={theme.colors.text.placeholder} />
              <Text style={s.emptyText}>{t('flashcards.noGroups')}</Text>
            </View>
          ) : (
            <>
              <GroupPills
                groups={groups}
                activeGroupPin={activeGroupPin}
                onSelect={(pin) => setActiveGroupPin(pin)}
              />
              {loadingGroups ? (
                <View style={s.emptyState}>
                  <Text style={s.emptyText}>{t('common.loading')}</Text>
                </View>
              ) : (
                <FlatList
                  data={groupDecks}
                  keyExtractor={(d) => d.id.toString()}
                  style={{ flex: 1 }}
                  contentContainerStyle={{ paddingBottom: 8 }}
                    renderItem={({ item }) => {
                    const isOwn = (item as any).is_own;
                    const duedeckIds = getDuedeckIds();
                    const isDue = duedeckIds.has(item.id);
                    const canRemove = (isOwn || isGroupAdmin) && (!!activeGroupPin || !!(item as any)._groupPinId);
                    const card = (
                        <TouchableOpacity
                          style={[s.deckCard, { marginBottom: 8, borderWidth: 1, borderColor: isDue ? theme.colors.danger : '#E0E0E0' }]}
                          activeOpacity={0.85}
                          onPress={() => openStudySession(item)}
                        >
                          <View style={[s.deckBadge, { backgroundColor: (item as any).subject_color || '#DDE7FF' }]}>
                            <MaterialCommunityIcons
                              name={(item as any).subject_icon || 'cards-outline'}
                              size={20}
                              color={theme.colors.text.primary}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={s.deckTitle} numberOfLines={1} ellipsizeMode="tail">{item.title}</Text>
                            {!isOwn && (
                              <Text style={{ fontSize: 11, color: '#388E3C', fontStyle: 'italic', marginBottom: 2 }}>
                                {t('flashcards.sharedBy')} @{item.owner_username || t('flashcards.peer')}
                              </Text>
                            )}
                            <Text style={s.deckMeta} numberOfLines={1}>{item.subject_name}</Text>
                            <View style={s.deckStatsRow}>
                              <Text style={s.statLabel}>{Number(item.card_count ?? 0)} {t('flashcards.cards')}</Text>
                              {Number(item.card_count ?? 0) > 0 && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                  <Text style={s.statValueSuccess}>✓ {Number(item.review_count ?? 0)}</Text>
                                  <Text style={s.statValuePending}>💪 {Number(item.learning_count ?? 0) + Number(item.new_count ?? 0)}</Text>
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
                          <View style={[s.swipeActionsPill, { width: 70 }]}>
                            <TouchableOpacity
                              style={s.swipeActionBtn}
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
    </View>
  );

  // ── Root render ───────────────────────────────────────────────────────────

  return (
    <>
      <Modal visible={isVisible} animationType="slide" transparent onRequestClose={onClose}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <Pressable style={s.backdrop} onPress={screen === 'hub' ? onClose : undefined}>
            <View style={s.sheet} onStartShouldSetResponder={() => true}>
              <View style={s.handle} />
              {screen === 'hub' && renderHub()}
            {screen === 'study' && (
              <FlashcardStudyScreen
                activeDeck={activeDeck}
                initialCards={cards}
                currentUserId={currentUserId}
                onBack={goBackToHub}
              />
            )}
            {screen === 'newDeck' && (
              <FlashcardNewDeckScreen
                subjects={subjects}
                onBack={() => setScreen('hub')}
                onDeckCreated={goBackToHub}
              />
            )}
            {screen === 'newCard' && (
              <FlashcardNewCardScreen
                activeDeck={activeDeck}
                onBack={() => setScreen('hub')}
                onCardCreated={goBackToHub}
              />
            )}
            </View>
          </Pressable>
        </GestureHandlerRootView>
      </Modal>

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
              {t('modals.shareDeck')}
            </Text>
            <Text style={{ fontSize: 13, color: theme.colors.text.secondary }}>
              {t('modals.shareDeckDesc', {
                title: shareDeckTarget?.title || '',
                defaultValue: `Comparte${shareDeckTarget?.title ? ` "${shareDeckTarget.title}"` : ''} con un usuario o un grupo.`,
              })}
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
              placeholder={t('modals.pinPlaceholder')}
              placeholderTextColor={theme.colors.text.placeholder}
              value={sharePin}
              onChangeText={setSharePin}
              autoCapitalize="characters"
              maxLength={8}
            />
            {groups.length > 0 && (
              <>
                <Text style={{ fontSize: 13, color: theme.colors.text.secondary, textAlign: 'center', marginTop: 4 }}>
                  — {t('common.or')} comparte con un grupo —
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 36 }}>
                  {groups.map((g: any) => (
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
                <Text style={{ color: theme.colors.text.secondary, fontWeight: '600' }}>
                  {t('modals.cancel')}
                </Text>
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
                  {isSharing ? t('modals.sharing') : t('modals.share')}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};
