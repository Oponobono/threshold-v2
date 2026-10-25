/**
 * SpecialDatesNotificationScheduler.ts
 *
 * Motor independiente de programación de notificaciones para fechas especiales y festivos.
 *
 * Principios:
 * 1. Independencia total: NO interactúa ni modifica el motor de recordatorios (ReminderEngine).
 * 2. Idempotencia: Prefijo exclusivo 'special_date::' para cancelación y reprogramación limpia.
 * 3. Respeto a preferencias: Lee tanto las preferencias de notificación como las categorías
 *    activas en el calendario (SpecialDatesPreferencesService) y overrides vigentes.
 * 4. Ventana rodante: Agenda los próximos 14 días a la hora configurada por el usuario.
 * 5. Canal Android dedicado: 'special_dates' con importancia normal, tono elegante y badge.
 */

import * as ExpoNotifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getSpecialDayRecord } from '../../domain/calendar/specialDatesEngine';
import { selectPrimaryCommemoration } from '../../domain/calendar/commemorations/engine/presentationPriority';
import type { SpecialDatesPreferences } from '../../domain/calendar/types';
import { getSpecialDatesPreferencesService } from './SpecialDatesPreferencesService';
import { getSpecialDatesNotificationPreferencesService } from './SpecialDatesNotificationPreferencesService';
import type { SpecialDatesNotificationPreferences } from './SpecialDatesNotificationPreferences';

export const SPECIAL_DATES_CHANNEL_ID = 'special_dates';
export const SPECIAL_DATES_ID_PREFIX = 'special_date::';

export function formatDateId(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function computeTriggerDate(dateId: string, timeStr: string): Date {
  const [yearStr, monthStr, dayStr] = dateId.split('-');
  const [hourStr, minStr] = timeStr.split(':');
  return new Date(
    Number(yearStr),
    Number(monthStr) - 1,
    Number(dayStr),
    Number(hourStr || '8'),
    Number(minStr || '0'),
    0,
    0
  );
}

export const SPECIAL_DATES_WINDOW_DAYS = 30;

export async function setupSpecialDatesChannel(): Promise<void> {
  if (Platform.OS === 'android') {
    try {
      await ExpoNotifications.setNotificationChannelAsync(SPECIAL_DATES_CHANNEL_ID, {
        name: 'Fechas especiales y festivos',
        importance: ExpoNotifications.AndroidImportance.HIGH,
        sound: 'default',
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#E11D48',
      });
    } catch (err) {
      console.warn('[SpecialDatesScheduler] No se pudo configurar el canal Android:', err);
    }
  }
}

export async function cancelAllSpecialDatesNotifications(): Promise<void> {
  try {
    const scheduled = await ExpoNotifications.getAllScheduledNotificationsAsync();
    const toCancel = scheduled
      .filter((n: any) => n.identifier && n.identifier.startsWith(SPECIAL_DATES_ID_PREFIX))
      .map((n: any) => n.identifier);

    if (toCancel.length > 0) {
      console.log(`[CANCEL] ${toCancel.length} notificaciones de fechas especiales`);
      await Promise.all(
        toCancel.map((id) => ExpoNotifications.cancelScheduledNotificationAsync(id))
      );
    }
  } catch (err) {
    console.warn('[SpecialDatesScheduler] Error al cancelar notificaciones existentes:', err);
  }
}

export interface SyncResult {
  scheduledCount: number;
}

/**
 * Sincroniza y reprograma las notificaciones de fechas especiales para una ventana de 30 días.
 * Cancela las existentes con prefijo 'special_date::' y agenda las nuevas según preferencias.
 */
export async function syncSpecialDatesNotifications(
  customPrefs?: SpecialDatesNotificationPreferences
): Promise<SyncResult> {
  // Asegurar que el canal Android esté registrado con alta importancia
  await setupSpecialDatesChannel();

  const notifPrefs =
    customPrefs || getSpecialDatesNotificationPreferencesService().getPreferences();

  // Si ambas opciones están apagadas, cancelar todo y terminar
  if (!notifPrefs.holidaysEnabled && !notifPrefs.commemorationsEnabled) {
    await cancelAllSpecialDatesNotifications();
    return { scheduledCount: 0 };
  }

  // Cancelar primero para evitar duplicados residuales
  await cancelAllSpecialDatesNotifications();

  // Obtener preferencias y overrides de fechas especiales del calendario
  const calendarPrefsService = getSpecialDatesPreferencesService();
  const calendarPrefs = calendarPrefsService.getPreferences();
  const calendarOverrides = calendarPrefsService.getOverrides();

  // Para las notificaciones, los festivos y conmemoraciones deben estar habilitados
  // independientemente de si el usuario los tiene visibles o no en la cuadrícula del calendario.
  const notificationCalendarPrefs: SpecialDatesPreferences = {
    ...calendarPrefs,
    showHolidays: true,
    showSpecialDates: true,
  };

  const now = new Date();
  const nowMs = now.getTime();
  let scheduledCount = 0;

  // Ventana rodante de 30 días a partir de hoy
  for (let offset = 0; offset <= SPECIAL_DATES_WINDOW_DAYS; offset++) {
    const targetDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const dateId = formatDateId(targetDay);

    const record = getSpecialDayRecord(dateId, {
      preferences: notificationCalendarPrefs,
      overrides: calendarOverrides,
    });

    if (!record) continue;

    // ── 1. Festivo Oficial en Colombia ──
    if (notifPrefs.holidaysEnabled && record.isHoliday) {
      const triggerDate = computeTriggerDate(dateId, notifPrefs.holidaysTime);
      if (triggerDate.getTime() > nowMs) {
        const holidayItem = record.items.find((i) => i.isHoliday);
        const holidayName = record.holidayName || 'Día Festivo';
        const body = holidayItem?.note ? `${holidayName} — ${holidayItem.note}` : holidayName;
        const identifier = `${SPECIAL_DATES_ID_PREFIX}holiday::${dateId}`;

        try {
          await ExpoNotifications.scheduleNotificationAsync({
            identifier,
            content: {
              title: '🇨🇴 Festivo Nacional',
              body,
              data: {
                type: 'special_date',
                dateId,
                category: 'festivo',
                deeplink: 'threshold://calendar',
              },
              sound: true,
              ...(Platform.OS === 'android'
                ? {
                    channelId: SPECIAL_DATES_CHANNEL_ID,
                    priority: ExpoNotifications.AndroidNotificationPriority.HIGH,
                  }
                : {}),
            },
            trigger: {
              type: ExpoNotifications.SchedulableTriggerInputTypes.DATE,
              date: triggerDate,
              channelId: SPECIAL_DATES_CHANNEL_ID,
            },
          });
          const deltaSec = Math.floor((triggerDate.getTime() - nowMs) / 1000);
          console.log(`[SCHEDULE] ${identifier} | DATE trigger | scheduledAt=${triggerDate.toISOString()} | delta=${deltaSec}s | ${holidayName}`);
          scheduledCount++;
        } catch (err) {
          console.warn(`[SpecialDatesScheduler] Error al agendar festivo ${dateId}:`, err);
        }
      }
    }

    if (notifPrefs.commemorationsEnabled) {
      const commemItems = record.items.filter((i) => {
        if (i.isHoliday) return false;
        // Si es una campaña multirango (semana internacional), notificar solo en su día inaugural
        if (i.dateRange && i.dateRange.start !== dateId) return false;
        return true;
      });
      if (commemItems.length > 0) {
        const triggerDate = computeTriggerDate(dateId, notifPrefs.commemorationsTime);
        const primaryItem = selectPrimaryCommemoration(commemItems);
        if (triggerDate.getTime() > nowMs && primaryItem) {
          let body = primaryItem.name;
          if (commemItems.length === 1) {
            if (primaryItem.note) {
              body = `${primaryItem.name} — ${primaryItem.note}`;
            }
          } else {
            body = `${primaryItem.name} y ${commemItems.length - 1} fechas más`;
          }

          const identifier = `${SPECIAL_DATES_ID_PREFIX}commemoration::${dateId}`;

          try {
            await ExpoNotifications.scheduleNotificationAsync({
              identifier,
              content: {
                title: '📅 Fecha Conmemorativa',
                body,
                data: {
                  type: 'special_date',
                  dateId,
                  category: 'conmemoracion',
                  deeplink: 'threshold://calendar',
                },
                sound: true,
                ...(Platform.OS === 'android'
                  ? {
                      channelId: SPECIAL_DATES_CHANNEL_ID,
                      priority: ExpoNotifications.AndroidNotificationPriority.HIGH,
                    }
                  : {}),
              },
              trigger: {
                type: ExpoNotifications.SchedulableTriggerInputTypes.DATE,
                date: triggerDate,
                channelId: SPECIAL_DATES_CHANNEL_ID,
              },
            });
            const deltaSec = Math.floor((triggerDate.getTime() - nowMs) / 1000);
            console.log(`[SCHEDULE] ${identifier} | DATE trigger | scheduledAt=${triggerDate.toISOString()} | delta=${deltaSec}s | ${body}`);
            scheduledCount++;
          } catch (err) {
            console.warn(`[SpecialDatesScheduler] Error al agendar conmemoración ${dateId}:`, err);
          }
        }
      }
    }
  }

  return { scheduledCount };
}

/**
 * Inicialización al arranque de la aplicación.
 * Registra el canal Android y ejecuta una sincronización de la ventana de 14 días.
 */
export async function initSpecialDatesNotifications(): Promise<void> {
  try {
    await setupSpecialDatesChannel();
    const result = await syncSpecialDatesNotifications();
    console.log(
      `[SpecialDatesScheduler] ✅ Notificaciones de fechas especiales inicializadas (${result.scheduledCount} programadas)`
    );
  } catch (err) {
    console.warn('[SpecialDatesScheduler] Error al inicializar:', err);
  }
}
