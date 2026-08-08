import { requireNativeModule } from 'expo';

declare class ThresholdExactAlarmNativeModule {
  canScheduleExactAlarms(): Promise<boolean | null>;
}

let cachedModule: ThresholdExactAlarmNativeModule | null | undefined;

function getNativeModule(): ThresholdExactAlarmNativeModule | null {
  if (cachedModule !== undefined) return cachedModule;
  try {
    cachedModule = requireNativeModule<ThresholdExactAlarmNativeModule>('ThresholdExactAlarm');
  } catch {
    cachedModule = null;
  }
  return cachedModule;
}

export default {
  canScheduleExactAlarms: async (): Promise<boolean | null> => {
    const mod = getNativeModule();
    if (!mod) return null;
    try {
      return await mod.canScheduleExactAlarms();
    } catch {
      return null;
    }
  },
};
