import React, { useEffect, useState } from 'react';
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
import { useCustomAlert } from './CustomAlert';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { theme } from '../styles/theme';
import { flashcardsStyles as s } from '../styles/FlashcardsModal.styles';
import {
  type Subject,
  type FlashcardDeck,
  type Flashcard,
  getFlashcardDecks,
  getFlashcards,
  getUserId,
  shareDeck,
  deleteFlashcardDeck,
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
 * - `hub`: Listado de mazos de tarjetas con pull-to-refresh y opciones para crear, estudiar,
 *          compartir (por PIN) o eliminar un mazo.
 * - `study`: Sesión de estudio por repetición espaciada (`FlashcardStudyScreen`).
 * - `newDeck`: Formulario para crear un mazo nuevo (`FlashcardNewDeckScreen`).
 * - `newCard`: Formulario para añadir una tarjeta a un mazo existente (`FlashcardNewCardScreen`).
 * También integra un sub-modal secundario para compartir un mazo mediante el PIN del destinatario.
 *
 * @param isVisible - Controla la visibilidad del modal.
 * @param onClose - Callback para cerrar el modal y resetear la pantalla activa.
 * @param subjects - Lista de materias del usuario (se pasa a pantallas internas).
 */
export const FlashcardsModal: React.FC<Props> = ({ isVisible, onClose, subjects }) => {
  const { t } = useTranslation();
  const { showAlert } = useCustomAlert();
  const [screen, setScreen] = useState<Screen>('hub');
  const [decks, setDecks] = useState<FlashcardDeck[]>([]);
  const [activeDeck, setActiveDeck] = useState<FlashcardDeck | null>(null);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

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
      showAlert({ title: t('common.error') || 'Error', message: error.message, type: 'error' });
    } finally {
      setIsSharing(false);
    }
  };

  // ── Data loading ────────────────────────────────────────────────────────────

  const loadDecks = async () => {
    try {
      const data = await getFlashcardDecks();
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

  // ── Study session ──────────────────────────────────────────────────────────

  const openStudySession = async (deck: FlashcardDeck) => {
    try {
      const data = await getFlashcards(deck.id);
      if (!data || data.length === 0) {
        showAlert({ title: t('flashcards.noCards'), message: t('flashcards.noCardsMsg'), type: 'info' });
        return;
      }
      // Prioritise 'new' and 'learning' cards first
      const sorted = [...data].sort((a, b) => {
        const order: Record<string, number> = { new: 0, learning: 1, review: 2 };
        return (order[a.status] ?? 3) - (order[b.status] ?? 3);
      });
      setCards(sorted);
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
    showAlert({
      title: t('modals.deleteDeck', 'Eliminar Mazo'),
      message: t('modals.deleteDeckConfirm', { title: deck.title, defaultValue: `¿Estás seguro de que deseas eliminar el mazo "${deck.title}"? Esta acción no se puede deshacer.` }),
      type: 'confirm',
      buttons: [
        { text: t('common.cancel') || 'Cancelar', style: 'cancel' },
        { 
          text: t('common.delete') || 'Eliminar', 
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteFlashcardDeck(deck.id);
              await loadDecks();
            } catch (e: any) {
              showAlert({ title: t('common.error'), message: e.message || (t('flashcards.deckDeleteError') || 'Error al eliminar el mazo'), type: 'error' });
            }
          }
        }
      ]
    });
  };

  // ── Render screens ─────────────────────────────────────────────────────────

  const renderHub = () => (
    <View style={{ flex: 1 }}>
      <View style={s.modalHeader}>
        <Text style={s.modalTitle}>{t('flashcards.title')}</Text>
        <TouchableOpacity onPress={onClose} style={s.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="close" size={22} color={theme.colors.text.secondary} />
        </TouchableOpacity>
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
            const isOwner = item.user_id === currentUserId;
            return (
              <TouchableOpacity style={s.deckCard} activeOpacity={0.75} onPress={() => openStudySession(item)}>
                <View style={[s.deckBadge, { backgroundColor: (item as any).subject_color || '#DDE7FF' }]}>
                  <MaterialCommunityIcons
                    name={((item as any).subject_icon as any) || 'cards-outline'}
                    size={20}
                    color={theme.colors.text.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Text style={s.deckTitle}>{item.title}</Text>
                    {isShared && (
                      <View style={{
                        flexDirection: 'row', alignItems: 'center', gap: 3,
                        backgroundColor: '#E8F5E9', borderRadius: 10,
                        paddingHorizontal: 7, paddingVertical: 2,
                      }}>
                        <Ionicons name="people" size={10} color="#388E3C" />
                        <Text style={{ fontSize: 10, color: '#388E3C', fontWeight: '700' }}>{t('modals.shared', 'Compartido')}</Text>
                      </View>
                    )}
                  </View>
                  {isShared && (
                    <Text style={{ fontSize: 11, color: '#388E3C', marginTop: 1, fontStyle: 'italic' }}>
                      {t('flashcards.sharedBy') || 'por'} @{item.owner_username || item.owner_name || (t('flashcards.peer') || 'compañero')}
                    </Text>
                  )}
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={s.deckMeta} numberOfLines={1}>
                      {item.subject_name}
                    </Text>
                  </View>
                  {/* Visual Breakdown */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 12 }}>
                    <Text style={{ fontSize: 11, color: theme.colors.text.secondary }}>
                      {Number(item.card_count ?? 0)} {t('flashcards.cards')}
                    </Text>
                    {(Number(item.card_count ?? 0) > 0) && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ fontSize: 11, color: '#4CAF50', fontWeight: '600' }}>
                          ✓ {Number(item.review_count ?? 0)}
                        </Text>
                        <Text style={{ fontSize: 11, color: '#FF9800', fontWeight: '600' }}>
                          💪 {Number(item.learning_count ?? 0) + Number(item.new_count ?? 0)}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              {isOwner && (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TouchableOpacity
                    style={[s.addCardBtn, { marginRight: 2, backgroundColor: '#FFF5F5' }]}
                    onPress={() => handleDeleteDeck(item)}
                  >
                    <Ionicons name="trash-outline" size={18} color="#D32F2F" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.addCardBtn, { marginRight: 2 }]}
                    onPress={() => {
                      setShareDeckTarget(item);
                      setSharePin('');
                    }}
                  >
                    <Ionicons name="share-social-outline" size={18} color={theme.colors.primary} />
                  </TouchableOpacity>
                </View>
              )}
              <TouchableOpacity
                style={s.addCardBtn}
                onPress={() => {
                  setActiveDeck(item);
                  setScreen('newCard');
                }}
              >
                <Ionicons name="add" size={18} color={theme.colors.primary} />
              </TouchableOpacity>
              <Ionicons name="chevron-forward" size={18} color={theme.colors.text.placeholder} />
            </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );

  // ── Root render ────────────────────────────────────────────────────────────

  return (
    <>
      <Modal visible={isVisible} animationType="slide" transparent onRequestClose={onClose}>
        <Pressable style={s.backdrop} onPress={screen === 'hub' ? onClose : undefined}>
          <Pressable style={s.sheet} onPress={() => null}>
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
          </Pressable>
        </Pressable>
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
            <Text style={{ fontSize: 17, fontWeight: '700', color: theme.colors.text.primary }}>{t('modals.shareDeck', 'Compartir mazo')}</Text>
            <Text style={{ fontSize: 13, color: theme.colors.text.secondary }}>
              {t('modals.shareDeckDesc', { title: shareDeckTarget?.title || '', defaultValue: `Ingresa el PIN del usuario con quien deseas compartir ${shareDeckTarget?.title ? `"${shareDeckTarget?.title}"` : ''}.` })}
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
                <Text style={{ color: theme.colors.text.secondary, fontWeight: '600' }}>{t('modals.cancel', 'Cancelar')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[{ flex: 1, padding: 12, borderRadius: 10, backgroundColor: theme.colors.primary, alignItems: 'center' }, (!sharePin.trim() || isSharing) && { opacity: 0.5 }]}
                onPress={handleShareDeck}
                disabled={!sharePin.trim() || isSharing}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>{isSharing ? t('modals.sharing', 'Compartiendo...') : t('modals.share', 'Compartir')}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};
