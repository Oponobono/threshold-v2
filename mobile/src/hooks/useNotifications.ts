/**
 * TEMPORARY
 *
 * Legacy notification scheduler que sobrevive mientras
 * AssessmentReminderPolicy y ScheduleReminderPolicy no migran
 * al Reminder Engine.
 *
 * Pendiente:
 * ✅ Flashcards → Reminder Engine.
 * ⏳ Assessments → migrar.
 * ⏳ Schedules → migrar.
 * ⏳ Calendar Events → migrar.
 * ⏳ Eliminar este hook cuando ya no tenga responsabilidades.
 */

import { useEffect, useRef } from 'react';
import {
  cancelAllDeadlineNotifications,
  cancelAllClassNotifications,
  cancelWeeklyDigest,
  scheduleWeeklyDigest,
  scheduleDeadlineNotification,
  scheduleClassNotification,
  type WeeklyDigestConfig,
} from '../services/notificationService';

export function useNotifications(
  notifDeadline: boolean,
  notifWeekly: boolean,
  weeklyConfig: WeeklyDigestConfig | null,
  assessments?: any[],
  schedules?: any[],
  calendarEvents?: any[],
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

  // ── Deadline alerts (calendar events + assessments) ────────────────────
  useEffect(() => {
    if (notifDeadline) {
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      const scheduleAll = async () => {
        await cancelAllDeadlineNotifications();

        for (const a of assessments || []) {
          if (a.is_completed || !a.date) continue;
          try {
            const [d, m, y] = a.date.split('-').map(Number);
            const eventDate = new Date(y, m - 1, d);
            if (eventDate < now) continue;
            const [hh, mm] = (a.time || '09:00').split(':').map(Number);
            eventDate.setHours(hh, mm, 0, 0);
            await scheduleDeadlineNotification(`assessment_${a.id}`, a.name, eventDate, 15);
          } catch (_) {}
        }

        for (const ev of calendarEvents || []) {
          const startDate = ev.startDate || ev.start_date;
          const startTime = ev.startTime || ev.start_time || '09:00';
          if (!startDate) continue;
          try {
            const [d, m, y] = startDate.split('-').map(Number);
            const [hh, mm] = startTime.split(':').map(Number);
            const eventDate = new Date(y, m - 1, d, hh, mm, 0);
            if (eventDate < now) continue;
            await scheduleDeadlineNotification(`event_${ev.id}`, ev.title, eventDate, 15);
          } catch (_) {}
        }
      };

      scheduleAll();
    } else if (prevDeadline.current && !notifDeadline) {
      cancelAllDeadlineNotifications();
    }
    prevDeadline.current = notifDeadline;
  }, [notifDeadline, assessments, calendarEvents]);

  // ── Class schedule notifications ──────────────────────────────────────
  useEffect(() => {
    const scheduleAll = async () => {
      await cancelAllClassNotifications();
      for (const s of schedules || []) {
        if (!s.day_of_week || !s.start_time) continue;
        try {
          await scheduleClassNotification(s.id, s.name || '', s.day_of_week, s.start_time, 5);
        } catch (_) {}
      }
    };
    scheduleAll();
  }, [schedules]);
}
