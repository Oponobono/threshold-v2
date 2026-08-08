// ── useReminderPreferences ────────────────────────────────────────────────
// Proyección React del contrato ReminderPreferences (device-local, MMKV).
// Sin capa de traducción de perfiles: la UI lee/escribe el contrato tal cual.
//
// Persistencia INMEDIATA: cada cambio llama a service.set() (síncrono, MMKV)
// y dispara coordinator.resync() (fire-and-forget) para que el engine
// re-reconcilie el plan contra el SO. No hay "guardar después".

import { useCallback, useEffect, useMemo, useState } from 'react';
import * as Notifications from 'expo-notifications';
import i18n from '../locales/i18n';
import { getReminderPreferencesService } from '../services/reminders/ReminderPreferencesService';
import {
  CHECK_TIME_DEFAULT,
  getCategoryCheckTime,
  getCategoryOffsets,
  isCategoryEnabled,
  isCheckTimeCategory,
} from '../services/reminders/ReminderPreferences';
import type { ReminderPreferences, ReminderPreferencesPatch, ReminderCategoryName } from '../services/reminders/ReminderPreferences';
import {
  CATEGORY_PRESENTATION,
  categoryCount,
  enabledCategoryCount,
  formatOffsetLabel,
  formatOffsetsLabel,
} from '../services/reminders/ReminderPreferencesPresentation';
import type { TranslateFn } from '../services/reminders/ReminderPreferencesPresentation';
import { getReminderCoordinator } from '../services/reminders/reminderCoordinatorInstance';

export type HealthStatus = 'active' | 'no_permission' | 'no_reminders' | 'error';

export interface HealthInfo {
  status: HealthStatus;
  permissionGranted: boolean;
  scheduledCount: number;
  initialized: boolean;
}

const translate: TranslateFn = (key, options) => i18n.t(key, options ?? {});

export function useReminderPreferences() {
  const service = getReminderPreferencesService();
  const [prefs, setPrefs] = useState<ReminderPreferences>(() => service.get());
  const [health, setHealth] = useState<HealthInfo>({
    status: 'active',
    permissionGranted: true,
    scheduledCount: 0,
    initialized: false,
  });
  const [loading, setLoading] = useState(true);

  const refreshHealth = useCallback(async () => {
    try {
      const perm = await Notifications.getPermissionsAsync();
      const granted = perm.granted;
      let count = 0;
      if (granted) {
        const scheduled = await Notifications.getAllScheduledNotificationsAsync();
        count = scheduled.length;
      }
      let status: HealthStatus;
      if (!granted) {
        status = 'no_permission';
      } else if (count === 0) {
        status = 'no_reminders';
      } else {
        status = 'active';
      }
      setHealth({ status, permissionGranted: granted, scheduledCount: count, initialized: true });
    } catch {
      setHealth({ status: 'error', permissionGranted: false, scheduledCount: 0, initialized: true });
    }
  }, []);

  useEffect(() => {
    refreshHealth().finally(() => setLoading(false));
  }, [refreshHealth]);

  const triggerResync = useCallback(() => {
    getReminderCoordinator()
      .then((coordinator) => coordinator.resync())
      .catch(() => {
        // El engine aún no está disponible: el siguiente initialize del
        // Bootstrap leerá las preferencias ya persistidas en MMKV.
      });
  }, []);

  const update = useCallback(
    (patch: ReminderPreferencesPatch) => {
      setPrefs(service.set(patch));
      triggerResync();
    },
    [service, triggerResync],
  );

  const reset = useCallback(() => {
    setPrefs(service.reset());
    triggerResync();
  }, [service, triggerResync]);

  const getCategoryLabel = useCallback((category: ReminderCategoryName): string => {
    const presentation = CATEGORY_PRESENTATION.find((c) => c.name === category);
    if (!presentation) return category;
    return translate(presentation.labelKey, { defaultValue: category });
  }, []);

  const getCategoryIcon = useCallback((category: ReminderCategoryName): string => {
    const presentation = CATEGORY_PRESENTATION.find((c) => c.name === category);
    return presentation?.icon ?? 'ellipse-outline';
  }, []);

  const getCategoryOffsetLabel = useCallback(
    (category: ReminderCategoryName): string => {
      if (isCheckTimeCategory(category)) {
        return getCategoryCheckTime(prefs);
      }
      return formatOffsetsLabel(getCategoryOffsets(prefs, category), translate);
    },
    [prefs],
  );

  const getCategoryEnabled = useCallback(
    (category: ReminderCategoryName): boolean => {
      return isCategoryEnabled(prefs, category);
    },
    [prefs],
  );

  const summaryText = useMemo(() => {
    return translate('reminders.configureSummary', {
      count: enabledCategoryCount(prefs),
      total: categoryCount(),
      defaultValue: '{{count}} de {{total}} categorías activas',
    });
  }, [prefs]);

  const categories = useMemo(() => {
    return CATEGORY_PRESENTATION.map((presentation) => {
      const category = presentation.name;
      const label = getCategoryLabel(category);
      if (isCheckTimeCategory(category)) {
        const settings = prefs.categories[category];
        const checkTime = settings.checkTime ?? CHECK_TIME_DEFAULT;
        return {
          name: category,
          label,
          icon: presentation.icon,
          enabled: settings.enabled,
          offsets: [],
          hasCustomOffsets: false,
          offsetLabel: checkTime,
          checkTime,
        };
      }
      const settings = prefs.categories[category];
      const offsets = getCategoryOffsets(prefs, category);
      return {
        name: category,
        label,
        icon: presentation.icon,
        enabled: settings.enabled,
        offsets,
        hasCustomOffsets: settings.offsets != null,
        offsetLabel: formatOffsetsLabel(offsets, translate),
      };
    });
  }, [prefs, getCategoryLabel]);

  return {
    prefs,
    health,
    loading,
    refreshHealth,
    update,
    reset,
    getCategoryLabel,
    getCategoryIcon,
    getCategoryOffsetLabel,
    getCategoryEnabled,
    summaryText,
    categories,
  };
}
