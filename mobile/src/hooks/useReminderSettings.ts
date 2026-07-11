import { useState, useEffect, useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import i18n from '../locales/i18n';

export type ReminderEntityType = 'assessment' | 'schedule' | 'flashcard_deck' | 'calendar_event' | 'grading_period';

export type ReminderProfileName = 'minimal' | 'standard' | 'persistent' | 'custom';

export interface CategorySetting {
  entityType: ReminderEntityType;
  enabled: boolean;
  inheritsFromGlobal: boolean;
  profileName: ReminderProfileName | null;
  customOffsets: number[];
}

const DEFAULT_OFFSETS: number[] = [30, 60];

export type HealthStatus = 'active' | 'no_permission' | 'no_reminders' | 'error';

export interface HealthInfo {
  status: HealthStatus;
  permissionGranted: boolean;
  scheduledCount: number;
  initialized: boolean;
}

const DEFAULT_PROFILE: ReminderProfileName = 'standard';

const CATEGORIES: { entityType: ReminderEntityType; labelKey: string; icon: string }[] = [
  { entityType: 'assessment',      labelKey: 'reminders.category.assessment', icon: 'calendar-check' },
  { entityType: 'schedule',        labelKey: 'reminders.category.schedule', icon: 'clock' },
  { entityType: 'flashcard_deck',  labelKey: 'reminders.category.flashcard_deck', icon: 'layers' },
  { entityType: 'calendar_event',  labelKey: 'reminders.category.calendar_event', icon: 'calendar' },
  { entityType: 'grading_period',  labelKey: 'reminders.category.grading_period', icon: 'bar-chart' },
];

const ENTITY_TYPE_LABELS: Record<ReminderEntityType, string> = {
  assessment: 'Evaluaciones',
  schedule: 'Horarios',
  flashcard_deck: 'Flashcards',
  calendar_event: 'Eventos',
  grading_period: 'Períodos académicos',
};

function createDefaultSettings(): CategorySetting[] {
  return CATEGORIES.map(c => ({
    entityType: c.entityType,
    enabled: true,
    inheritsFromGlobal: true,
    profileName: null,
    customOffsets: [...DEFAULT_OFFSETS],
  }));
}

function getEntityLabel(entityType: ReminderEntityType): string {
  return i18n.t ? i18n.t(`reminders.category.${entityType}`, { defaultValue: ENTITY_TYPE_LABELS[entityType] }) : ENTITY_TYPE_LABELS[entityType];
}

function getProfileLabel(name: ReminderProfileName): string {
  const key = name === 'minimal' ? 'reminders.profileMinimal'
    : name === 'standard' ? 'reminders.profileStandard'
    : name === 'persistent' ? 'reminders.profilePersistent'
    : 'reminders.profileCustom';
  return i18n.t ? i18n.t(key, { defaultValue: name }) : name;
}

export function getEffectiveProfile(cat: CategorySetting, globalProfile: ReminderProfileName): ReminderProfileName {
  return cat.inheritsFromGlobal ? globalProfile : (cat.profileName ?? globalProfile);
}

export function useReminderSettings() {
  const [globalProfile, setGlobalProfile] = useState<ReminderProfileName>(DEFAULT_PROFILE);
  const [categories, setCategories] = useState<CategorySetting[]>(createDefaultSettings);
  const [health, setHealth] = useState<HealthInfo>({ status: 'active', permissionGranted: true, scheduledCount: 0, initialized: false });
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

  const updateGlobalProfile = useCallback((profile: ReminderProfileName) => {
    setGlobalProfile(profile);
  }, []);

  const customizeCategory = useCallback((entityType: ReminderEntityType, profileName: ReminderProfileName, offsets?: number[]) => {
    setCategories(prev => prev.map(c =>
      c.entityType === entityType ? {
        ...c,
        profileName,
        inheritsFromGlobal: false,
        customOffsets: offsets ?? c.customOffsets,
      } : c
    ));
  }, []);

  const resetCategoryToGlobal = useCallback((entityType: ReminderEntityType) => {
    setCategories(prev => prev.map(c =>
      c.entityType === entityType ? { ...c, profileName: null, inheritsFromGlobal: true } : c
    ));
  }, []);

  const setCustomOffsets = useCallback((entityType: ReminderEntityType, offsets: number[]) => {
    setCategories(prev => prev.map(c =>
      c.entityType === entityType ? { ...c, customOffsets: offsets, profileName: 'custom', inheritsFromGlobal: false } : c
    ));
  }, []);

  const setCategoryEnabled = useCallback((entityType: ReminderEntityType, enabled: boolean) => {
    setCategories(prev => prev.map(c =>
      c.entityType === entityType ? { ...c, enabled } : c
    ));
  }, []);

  const getCategoryProfile = useCallback((entityType: ReminderEntityType): ReminderProfileName => {
    const cat = categories.find(c => c.entityType === entityType);
    if (!cat) return DEFAULT_PROFILE;
    return getEffectiveProfile(cat, globalProfile);
  }, [categories, globalProfile]);

  const getCategoryLabel = useCallback((entityType: ReminderEntityType): string => {
    return getEntityLabel(entityType);
  }, []);

  const getProfileLabelName = useCallback((name: ReminderProfileName): string => {
    return getProfileLabel(name);
  }, []);

  const effectiveCategories = categories.map(c => ({
    ...c,
    effectiveProfile: getEffectiveProfile(c, globalProfile),
  }));

  const hasCustomCategories = categories.some(c => !c.inheritsFromGlobal);

  return {
    globalProfile,
    categories,
    effectiveCategories,
    health,
    loading,
    refreshHealth,
    updateGlobalProfile,
    customizeCategory,
    resetCategoryToGlobal,
    setCustomOffsets,
    setCategoryEnabled,
    getCategoryProfile,
    getCategoryLabel,
    getProfileLabelName,
    hasCustomCategories,
    CATEGORIES,
    ENTITY_TYPE_LABELS,
  };
}
