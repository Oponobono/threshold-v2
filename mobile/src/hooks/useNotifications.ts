import { useEffect, useRef, useCallback, useState } from 'react';
import {
  cancelAllDeadlineNotifications,
  cancelAllDueDeckNotifications,
  cancelWeeklyDigest,
  scheduleWeeklyDigest,
  scheduleDueDeckNotification,
  cancelDueDeckNotification,
  type WeeklyDigestConfig,
} from '../services/notificationService';

export function useNotifications(
  notifDeadline: boolean,
  notifWeekly: boolean,
  weeklyConfig: WeeklyDigestConfig | null,
) {
  const prevDeadline = useRef(notifDeadline);

  // ── Weekly digest ──────────────────────────────────────────────────────
  useEffect(() => {
    if (notifWeekly && weeklyConfig) {
      scheduleWeeklyDigest(weeklyConfig);
    } else if (!notifWeekly) {
      cancelWeeklyDigest();
    }
  }, [notifWeekly, weeklyConfig]);

  // ── Deadline alerts ────────────────────────────────────────────────────
  useEffect(() => {
    if (notifDeadline) {
      // Re-schedule all upcoming events happens via the screen
      // when events are loaded
    } else if (prevDeadline.current && !notifDeadline) {
      cancelAllDeadlineNotifications();
    }
    prevDeadline.current = notifDeadline;
  }, [notifDeadline]);

  return {
    scheduleDueDeck: useCallback(
      async (deckId: number, deckTitle: string, dueCount: number) => {
        await scheduleDueDeckNotification(deckId, deckTitle, dueCount);
      },
      [],
    ),
    cancelDueDeck: useCallback(async (deckId: number) => {
      await cancelDueDeckNotification(deckId);
    }, []),
    cancelAllDue: useCallback(async () => {
      await cancelAllDueDeckNotifications();
    }, []),
  };
}
