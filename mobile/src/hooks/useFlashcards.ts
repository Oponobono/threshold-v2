import React, { useRef, useState, useCallback } from 'react';
import { Animated, TextInput, ActionSheetIOS, Platform } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useFlashcardsManager } from './useFlashcardsManager';
import { useDataStore } from '../store/useDataStore';
import { useCustomAlert } from '../components/CustomAlert';
import {
  getSubjects, type Subject, type FlashcardDeck, deleteFlashcardDeck, getUserId, getFlashcardsPrioritized, updateFlashcardDeck,
} from '../services/api';
import {
  scheduleDueDeckNotification,
  cancelDueDeckNotification,
  cancelAllDueDeckNotifications,
} from '../services/notificationService';

export function useFlashcards() {
  const { t } = useTranslation();
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

  const activeCloseRef = useRef<(() => void) | null>(null);

  const searchAnim = useRef(new Animated.Value(0)).current;
  const searchInputRef = useRef<TextInput>(null) as React.RefObject<TextInput>;

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
        },
      );
    } else {
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
    const pillWidth = 101;
    return { pillWidth, onAddPress: () => { close(); setActiveDeck(deck); setShowNewCardModal(true); }, onDeletePress: () => { close(); handleDeleteDeck(deck); } };
  }, [handleDeleteDeck]);

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

  // ── Due deck notifications ──────────────────────────────────────────
  const dueNotifScheduled = useRef<Set<number>>(new Set());

  const scheduleDueNotifications = useCallback(async () => {
    const dueIds = getDuedeckIds();
    if (!dueIds || dueIds.size === 0) return;

    for (const deck of filteredDecks) {
      if (dueIds.has(deck.id) && !dueNotifScheduled.current.has(deck.id)) {
        await scheduleDueDeckNotification(deck.id, deck.title, 1);
        dueNotifScheduled.current.add(deck.id);
      } else if (!dueIds.has(deck.id) && dueNotifScheduled.current.has(deck.id)) {
        await cancelDueDeckNotification(deck.id);
        dueNotifScheduled.current.delete(deck.id);
      }
    }
  }, [getDuedeckIds, filteredDecks]);

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
        await scheduleDueNotifications();
      };
      loadAll();
      return () => {
        cancelAllDueDeckNotifications();
        dueNotifScheduled.current.clear();
      };
    }, [loadDecks, scheduleDueNotifications]),
  );

  return {
    showSearch, showNewDeckModal, showImportModal, showMenuModal, showNewCardModal,
    showStudyModal, showEditDeckModal, subjects, activeDeck, editingDeck, studyDeckCards,
    currentUserId, isRefreshing, activeCloseRef, searchAnim, searchInputRef,
    isLoading, searchQuery, setSearchQuery, activeSubjectId, setActiveSubjectId,
    filteredDecks, loadDecks, getDuedeckIds,
    setShowNewDeckModal, setShowImportModal, setShowMenuModal, setShowNewCardModal,
    setShowStudyModal, setShowEditDeckModal, setActiveDeck, setEditingDeck,
    setStudyDeckCards,
    handleOpenMenu, handleOpenStudy, handleOpenEditDeck, handleDeleteDeck,
    renderSwipeActions, handleRefresh, toggleSearch,
  };
}
