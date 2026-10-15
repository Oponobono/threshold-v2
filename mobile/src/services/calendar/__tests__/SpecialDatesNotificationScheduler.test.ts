import {
  formatDateId,
  computeTriggerDate,
  setupSpecialDatesChannel,
  cancelAllSpecialDatesNotifications,
  syncSpecialDatesNotifications,
  initSpecialDatesNotifications,
  SPECIAL_DATES_CHANNEL_ID,
  SPECIAL_DATES_ID_PREFIX,
} from '../SpecialDatesNotificationScheduler';

const mockScheduleNotificationAsync = jest.fn();
const mockCancelScheduledNotificationAsync = jest.fn();
const mockGetAllScheduledNotificationsAsync = jest.fn();
const mockSetNotificationChannelAsync = jest.fn();

jest.mock('expo-notifications', () => ({
  setNotificationChannelAsync: (...args: any[]) => mockSetNotificationChannelAsync(...args),
  scheduleNotificationAsync: (...args: any[]) => mockScheduleNotificationAsync(...args),
  cancelScheduledNotificationAsync: (...args: any[]) =>
    mockCancelScheduledNotificationAsync(...args),
  getAllScheduledNotificationsAsync: () => mockGetAllScheduledNotificationsAsync(),
  AndroidImportance: { DEFAULT: 3 },
  AndroidNotificationPriority: { DEFAULT: 'default' },
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
}));

describe('SpecialDatesNotificationScheduler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAllScheduledNotificationsAsync.mockResolvedValue([]);
    mockScheduleNotificationAsync.mockResolvedValue('test-notification-id');
  });

  describe('formatDateId y computeTriggerDate', () => {
    it('formatea Date a DateId en formato YYYY-MM-DD sin desajuste horario', () => {
      const d = new Date(2026, 9, 12, 10, 0, 0); // 12 de octubre de 2026
      expect(formatDateId(d)).toBe('2026-10-12');
    });

    it('calcula la fecha de activación con la hora y minuto especificados', () => {
      const trigger = computeTriggerDate('2026-10-12', '07:45');
      expect(trigger.getFullYear()).toBe(2026);
      expect(trigger.getMonth()).toBe(9); // Octubre (0-indexed)
      expect(trigger.getDate()).toBe(12);
      expect(trigger.getHours()).toBe(7);
      expect(trigger.getMinutes()).toBe(45);
      expect(trigger.getSeconds()).toBe(0);
    });
  });

  describe('setupSpecialDatesChannel', () => {
    it('crea el canal Android special_dates con importancia normal y color coral', async () => {
      await setupSpecialDatesChannel();
      expect(mockSetNotificationChannelAsync).toHaveBeenCalledWith(
        SPECIAL_DATES_CHANNEL_ID,
        expect.objectContaining({
          name: 'Fechas especiales y festivos',
          importance: 3,
          lightColor: '#E11D48',
        })
      );
    });
  });

  describe('cancelAllSpecialDatesNotifications', () => {
    it('cancela exclusivamente las notificaciones que empiezan por special_date::', async () => {
      mockGetAllScheduledNotificationsAsync.mockResolvedValue([
        { identifier: `${SPECIAL_DATES_ID_PREFIX}holiday::2026-10-12` },
        { identifier: 'reminder::assessment::123' },
        { identifier: `${SPECIAL_DATES_ID_PREFIX}commemoration::2026-10-12` },
        { identifier: 'backup::progress' },
      ]);

      await cancelAllSpecialDatesNotifications();

      expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledTimes(2);
      expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith(
        `${SPECIAL_DATES_ID_PREFIX}holiday::2026-10-12`
      );
      expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith(
        `${SPECIAL_DATES_ID_PREFIX}commemoration::2026-10-12`
      );
      expect(mockCancelScheduledNotificationAsync).not.toHaveBeenCalledWith('reminder::assessment::123');
    });
  });

  describe('syncSpecialDatesNotifications', () => {
    it('cancela y reprograma notificaciones respetando las preferencias', async () => {
      const result = await syncSpecialDatesNotifications({
        holidaysEnabled: true,
        holidaysTime: '08:00',
        commemorationsEnabled: true,
        commemorationsTime: '08:00',
      });

      expect(result).toHaveProperty('scheduledCount');
      expect(typeof result.scheduledCount).toBe('number');
      // Debe haber cancelado notificaciones anteriores para garantizar idempotencia
      expect(mockGetAllScheduledNotificationsAsync).toHaveBeenCalled();
    });

    it('cancela todo y no agenda si ambas preferencias están desactivadas', async () => {
      const result = await syncSpecialDatesNotifications({
        holidaysEnabled: false,
        holidaysTime: '08:00',
        commemorationsEnabled: false,
        commemorationsTime: '08:00',
      });

      expect(result.scheduledCount).toBe(0);
      expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
    });
  });

  describe('initSpecialDatesNotifications', () => {
    it('configura el canal y sincroniza notificaciones sin lanzar excepciones', async () => {
      await expect(initSpecialDatesNotifications()).resolves.toBeUndefined();
      expect(mockSetNotificationChannelAsync).toHaveBeenCalled();
    });
  });
});
