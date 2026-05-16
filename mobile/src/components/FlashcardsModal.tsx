import React, { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useCustomAlert } from './CustomAlert';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SwipeableCard } from './SwipeableCard';
import { useTranslation } from 'react-i18next';
import { theme } from '../styles/theme';
import { flashcardsStyles as s } from '../styles/FlashcardsModal.styles';
import {
  type Subject,
  type FlashcardDeck,
  type Flashcard,
  getFlashcardDecksWithMetrics,
  getFlashcards,
  getFlashcardsPrioritized,
  getUserId,
  shareDeck,
  deleteFlashcardDeck,
  downloadReport,
} from '../services/api';

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
  const [screen, setScreen] = useState<Screen>('hub');
  const [decks, setDecks] = useState<FlashcardDeck[]>([]);

  const [activeDeck, setActiveDeck] = useState<FlashcardDeck | null>(null);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const activeCloseRef = useRef<(() => void) | null>(null);

  // Share deck modal state
  const [shareDeckTarget, setShareDeckTarget] = useState<FlashcardDeck | null>(null);
  const [sharePin, setSharePin] = useState('');
  const [isSharing, setIsSharing] = useState(false);

  const handleShareDeck = async () => {
    if (!shareDeckTarget || !sharePin.trim()) return;
    setIsSharing(true);
    try {
      const result = await shareDeck(shareDeckTarget.id, sharePin.trim());
      showAlert({ title: t('common.success', '¡Éxito!'), message: result.message, type: 'success' });
      setShareDeckTarget(null);
      setSharePin('');
    } catch (error: any) {
      showAlert({ title: t('common.error', 'Error'), message: error.message, type: 'error' });
    } finally {
      setIsSharing(false);
    }
  };

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadDecks = async () => {
    try {
      const data = await getFlashcardDecksWithMetrics();
      setDecks(data || []);
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
      loadDecks();
      setScreen('hub');
      getUserId().then(id => setCurrentUserId(id ? Number(id) : null));
    }
  }, [isVisible]);

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
    const isOwner = deck.user_id === currentUserId;
    showAlert({
      title: isOwner ? t('modals.deleteDeck', 'Eliminar Mazo') : t('flashcards.removeShared', 'Quitar Mazo'),
      message: isOwner
        ? t('modals.deleteDeckConfirm', { title: deck.title, defaultValue: `¿Estás seguro de que deseas eliminar el mazo "${deck.title}"? Esta acción no se puede deshacer.` })
        : t('flashcards.removeSharedConfirm', { title: deck.title, defaultValue: `¿Deseas quitar el mazo "${deck.title}" de tu lista?` }),
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
            } catch (e: any) {
              showAlert({ title: t('common.error', 'Error'), message: e.message || 'Error al eliminar el mazo', type: 'error' });
            }
          },
        },
      ],
    });
  };

  // ── Swipe actions ─────────────────────────────────────────────────────────

  const renderSwipeActions = (deck: FlashcardDeck, close: () => void) => {
    const isOwner = deck.user_id === currentUserId;
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

      <Text style={s.modalSubtitle}>{t('flashcards.subtitle')}</Text>

      <TouchableOpacity style={s.newDeckBtn} onPress={() => setScreen('newDeck')}>
        <Ionicons name="add-circle-outline" size={18} color={theme.colors.white} />
        <Text style={s.newDeckBtnText}>{t('flashcards.newDeck')}</Text>
      </TouchableOpacity>

      {decks.length === 0 ? (
        <View style={s.emptyState}>
          <MaterialCommunityIcons name="cards-outline" size={48} color={theme.colors.text.placeholder} />
          <Text style={s.emptyText}>{t('flashcards.emptyDecks')}</Text>
        </View>
      ) : (
        <FlatList
          data={decks}
          keyExtractor={(d) => d.id.toString()}
          style={{ maxHeight: 280 }}
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
            const isShared = item.user_id != null && item.user_id !== currentUserId;
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
                  style={[s.deckCard, { marginBottom: 0 }]}
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
                          <Text style={s.sharedBadgeText}>{t('modals.shared', 'Compartido')}</Text>
                        </View>
                      )}
                    </View>
                    {isShared && (
                      <Text style={{ fontSize: 11, color: '#388E3C', fontStyle: 'italic', marginBottom: 2 }}>
                        {t('flashcards.sharedBy', 'por')} @{item.owner_username || item.owner_name || t('flashcards.peer', 'compañero')}
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
                  <Ionicons 
                    name="chevron-back-outline" 
                    size={16} 
                    color={theme.colors.text.placeholder} 
                    style={{ opacity: 0.6, marginLeft: 2 }} 
                  />
                </TouchableOpacity>
              </SwipeableCard>
            );
          }}
        />
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
          onPress={() => setShareDeckTarget(null)}
        >
          <Pressable
            style={{ backgroundColor: '#fff', borderRadius: 20, padding: 24, width: '85%', gap: 12 }}
            onPress={() => null}
          >
            <Text style={{ fontSize: 17, fontWeight: '700', color: theme.colors.text.primary }}>
              {t('modals.shareDeck', 'Compartir mazo')}
            </Text>
            <Text style={{ fontSize: 13, color: theme.colors.text.secondary }}>
              {t('modals.shareDeckDesc', {
                title: shareDeckTarget?.title || '',
                defaultValue: `Ingresa el PIN del usuario con quien deseas compartir${shareDeckTarget?.title ? ` "${shareDeckTarget.title}"` : ''}.`,
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
              placeholder={t('modals.pinPlaceholder', 'Ej: ABC123')}
              placeholderTextColor={theme.colors.text.placeholder}
              value={sharePin}
              onChangeText={setSharePin}
              autoCapitalize="characters"
              maxLength={8}
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <TouchableOpacity
                style={{ flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' }}
                onPress={() => setShareDeckTarget(null)}
              >
                <Text style={{ color: theme.colors.text.secondary, fontWeight: '600' }}>
                  {t('modals.cancel', 'Cancelar')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  { flex: 1, padding: 12, borderRadius: 10, backgroundColor: theme.colors.primary, alignItems: 'center' },
                  (!sharePin.trim() || isSharing) && { opacity: 0.5 },
                ]}
                onPress={handleShareDeck}
                disabled={!sharePin.trim() || isSharing}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>
                  {isSharing ? t('modals.sharing', 'Compartiendo...') : t('modals.share', 'Compartir')}
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};
