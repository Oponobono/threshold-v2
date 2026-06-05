import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Animated, TextInput, ActionSheetIOS, Platform, InteractionManager } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useFlashcardsManager } from './useFlashcardsManager';
import { useDataStore } from '../store/useDataStore';
import { useCustomAlert } from '../components/ui/CustomAlert';
import {
  getSubjects, type Subject, type FlashcardDeck, deleteFlashcardDeck, getUserId, getFlashcardsPrioritized, updateFlashcardDeck, shareDeck, removeDeckFromGroup,
} from '../services/api';
import {
  scheduleDueDeckNotification,
  cancelDueDeckNotification,
  cancelAllDueDeckNotifications,
} from '../services/notificationService';
import { getUserGroups, getGroupDecks } from '../services/api/learning/groups';
import { exportDeckToJSON, getLocalDecks } from '../services/localFlashcardService';

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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Share deck state
  const [shareDeckTarget, setShareDeckTarget] = useState<FlashcardDeck | null>(null);
  const [sharePin, setSharePin] = useState('');
  const [isSharing, setIsSharing] = useState(false);

  const handleRemoveFromGroup = useCallback(async (deck: FlashcardDeck, groupPin: string) => {
    showAlert({
      title: t('modals.removeFromGroup'),
      message: t('modals.removeFromGroupConfirm', { title: deck.title }),
      type: 'confirm',
      buttons: [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.remove'),
          style: 'destructive',
          onPress: async () => {
            try {
              await removeDeckFromGroup(deck.id, groupPin);
              setGroupDecks((prev: any[]) => prev.filter((d: any) => d.id !== deck.id));
              showAlert({ title: t('common.success'), message: t('modals.removedFromGroup'), type: 'success' });
            } catch (e: any) {
              showAlert({ title: t('common.error'), message: e.message, type: 'error' });
            }
          },
        },
      ],
    });
  }, [t, showAlert]);

  const handleShareDeck = useCallback(async (groupPinId?: string) => {
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
  }, [shareDeckTarget, sharePin, t, showAlert]);

  // Groups tab state
  const [activeTab, setActiveTab] = useState<'mazos' | 'grupos'>('mazos');
  const [groups, setGroups] = useState<any[]>([]);
  const [activeGroupPin, setActiveGroupPin] = useState<string | null>(null);
  const isGroupAdmin = activeGroupPin ? groups.some(
    (g: any) => g.group_pin_id === activeGroupPin && g.role === 'creator'
  ) : false;
  const [groupDecks, setGroupDecks] = useState<any[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);

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
      showAlert({ title: t('common.error'), message: e.message || t('flashcards.loadError'), type: 'error' });
    }
  }, [t, showAlert]);

  const handleOpenEditDeck = useCallback((deck: FlashcardDeck) => {
    setEditingDeck(deck);
    setShowEditDeckModal(true);
  }, []);

  const handleDeleteDeck = useCallback((deck: FlashcardDeck) => {
    showAlert({
      title: t('modals.deleteDeck'),
      message: t('modals.deleteDeckConfirm', { title: deck.title }),
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
              const userId = await getUserId();
              if (userId) {
                await refreshPredictions(userId);
              }
            } catch (e: any) {
              showAlert({ title: t('common.error'), message: e.message || t('flashcards.deckDeleteError'), type: 'error' });
            }
          },
        },
      ],
    });
  }, [t, showAlert, loadDecks, refreshPredictions]);

  const handleExportDeck = useCallback(async (deck: FlashcardDeck) => {
    try {
      // Intenta exportar desde el backend si está online
      try {
        const response = await fetch(`/api/flashcard-decks/${deck.id}/export`);
        if (response.ok) {
          const deckJSON = await response.json();
          // Éxito - usar JSON del backend
          console.log('[useFlashcards] Mazo exportado desde backend');
          return deckJSON;
        }
      } catch (onlineErr) {
        // Si falla online, intenta exportar localmente
        console.warn('[useFlashcards] Export backend falló, intentando localmente:', onlineErr);
      }

      // OFFLINE-FIRST: Exportar desde cache local si está offline
      const localDecks = getLocalDecks();
      const isLocal = localDecks.some(d => String(d.id) === deck.id);
      if (isLocal) {
        const localDeck = localDecks.find(d => String(d.id) === deck.id);
        
        if (localDeck) {
          const deckJSON = await exportDeckToJSON(localDeck.id);
          console.log('[useFlashcards] Mazo exportado localmente (offline)');
          return deckJSON;
        }
      }

      throw new Error('No se pudo exportar el mazo');
    } catch (e: any) {
      console.error('[useFlashcards] Error exportando mazo:', e);
      showAlert({
        title: t('common.error'),
        message: e.message || t('flashcards.exportError'),
        type: 'error',
      });
      return null;
    }
  }, [t, showAlert]);

  const renderSwipeActions = useCallback((deck: FlashcardDeck, close: () => void) => {
    const isOwner = deck.user_id === currentUserId || deck.user_id === String(currentUserId);
    const pillWidth = isOwner ? 152 : 101;
    return {
      pillWidth,
      onAddPress: () => { close(); setActiveDeck(deck); setShowNewCardModal(true); },
      onSharePress: isOwner ? () => { close(); setShareDeckTarget(deck); setSharePin(''); } : undefined,
      onDeletePress: () => { close(); handleDeleteDeck(deck); },
    };
  }, [handleDeleteDeck, currentUserId]);

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
  const dueNotifScheduled = useRef<Set<string>>(new Set());
  const filteredDecksRef = useRef(filteredDecks);
  filteredDecksRef.current = filteredDecks;

  const scheduleDueNotifications = useCallback(async () => {
    const dueIds = getDuedeckIds();
    if (!dueIds || dueIds.size === 0) return;

    for (const deck of filteredDecksRef.current) {
      if (dueIds.has(deck.id) && !dueNotifScheduled.current.has(deck.id)) {
        await scheduleDueDeckNotification(deck.id, deck.title, 1);
        dueNotifScheduled.current.add(deck.id);
      } else if (!dueIds.has(deck.id) && dueNotifScheduled.current.has(deck.id)) {
        await cancelDueDeckNotification(deck.id);
        dueNotifScheduled.current.delete(deck.id);
      }
    }
  }, [getDuedeckIds]);

  useEffect(() => {
    scheduleDueNotifications();
  }, [filteredDecks]);

  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(async () => {
        try {
          const userId = await getUserId();
          setCurrentUserId(userId ? String(userId) : null);
          const subs = await getSubjects();
          setSubjects(subs || []);
          // Load groups
          const userGroups = await getUserGroups();
          const valid = (userGroups || []).filter((g: any) => g.group_pin_id);
          setGroups(valid);
          if (valid.length > 0 && !activeGroupPin) {
            setActiveGroupPin(valid[0].group_pin_id);
          }
        } catch (e) {
          console.warn('Error loading subjects:', e);
        }
        await loadDecks();
      });
      return () => {
        task.cancel();
        cancelAllDueDeckNotifications();
        dueNotifScheduled.current.clear();
      };
    }, [loadDecks]),
  );

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

  return {
    showSearch, showNewDeckModal, showImportModal, showMenuModal, showNewCardModal,
    showStudyModal, showEditDeckModal, subjects, activeDeck, editingDeck, studyDeckCards,
    currentUserId, isRefreshing, activeCloseRef, searchAnim, searchInputRef,
    isLoading, searchQuery, setSearchQuery, activeSubjectId, setActiveSubjectId,
    filteredDecks, loadDecks, getDuedeckIds,
    setShowNewDeckModal, setShowImportModal, setShowMenuModal, setShowNewCardModal,
    setShowStudyModal, setShowEditDeckModal, setActiveDeck, setEditingDeck,
    setStudyDeckCards,
    handleOpenMenu, handleOpenStudy, handleOpenEditDeck, handleDeleteDeck, handleExportDeck,
    renderSwipeActions, handleRefresh, toggleSearch,
    // Share
    shareDeckTarget, setShareDeckTarget,
    sharePin, setSharePin,
    isSharing, handleShareDeck,
    // Groups
    activeTab, setActiveTab,
    groups, activeGroupPin, setActiveGroupPin,
    groupDecks, loadingGroups,
    isGroupAdmin, handleRemoveFromGroup,
  };
}
