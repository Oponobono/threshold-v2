import { ExpoNotificationProvider } from '../NotificationProvider';
import type { ScheduledReminder } from '../types';

const mockSchedule = jest.fn();
const mockCancel = jest.fn();
const mockCancelAll = jest.fn();
const mockGetAll = jest.fn();
const mockRequestPermissions = jest.fn();
const mockSetChannel = jest.fn();

jest.mock('expo-notifications', () => ({
  requestPermissionsAsync: () => mockRequestPermissions(),
  setNotificationChannelAsync: () => mockSetChannel(),
  scheduleNotificationAsync: (opts: any) => mockSchedule(opts),
  cancelScheduledNotificationAsync: (id: string) => mockCancel(id),
  cancelAllScheduledNotificationsAsync: () => mockCancelAll(),
  getAllScheduledNotificationsAsync: () => mockGetAll(),
  AndroidImportance: { HIGH: 'high', LOW: 'low' },
  AndroidNotificationPriority: { MAX: 'max', HIGH: 'high', DEFAULT: 'default' },
  SchedulableTriggerInputTypes: { TIME_INTERVAL: 'time_interval' },
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockRequestPermissions.mockResolvedValue({ status: 'granted' });
});

function makeReminder(overrides?: Partial<ScheduledReminder>): ScheduledReminder {
  return {
    id: 'rem-1',
    title: 'Test title',
    body: 'Test body',
    scheduledAt: new Date(Date.now() + 3600000),
    priority: 'normal',
    ...overrides,
  };
}

describe('ExpoNotificationProvider', () => {
  describe('requestPermissions', () => {
    test('returns true when granted', async () => {
      const provider = new ExpoNotificationProvider();
      const result = await provider.requestPermissions();
      expect(result).toBe(true);
    });

    test('returns false when denied', async () => {
      mockRequestPermissions.mockResolvedValue({ status: 'denied' });
      const provider = new ExpoNotificationProvider();
      const result = await provider.requestPermissions();
      expect(result).toBe(false);
    });
  });

  describe('setupChannels', () => {
    test('creates reminders and progress channels on Android', async () => {
      const provider = new ExpoNotificationProvider();
      await provider.setupChannels();
      expect(mockSetChannel).toHaveBeenCalledTimes(2);
    });
  });

  describe('schedule', () => {
    test('schedules with correct identifier', async () => {
      mockSchedule.mockResolvedValue('returned-id');
      const reminder = makeReminder({ id: 'my-reminder' });
      const result = await new ExpoNotificationProvider().schedule(reminder);
      expect(result).toBe('returned-id');
      expect(mockSchedule).toHaveBeenCalledWith(
        expect.objectContaining({ identifier: 'my-reminder' }),
      );
    });

    test('passes title and body to expo', async () => {
      mockSchedule.mockResolvedValue('id');
      const reminder = makeReminder({ title: 'Examen mañana', body: 'No olvides repasar' });
      await new ExpoNotificationProvider().schedule(reminder);
      expect(mockSchedule).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            title: 'Examen mañana',
            body: 'No olvides repasar',
          }),
        }),
      );
    });

    test('sets channelId to reminders on Android', async () => {
      mockSchedule.mockResolvedValue('id');
      const reminder = makeReminder();
      await new ExpoNotificationProvider().schedule(reminder);
      expect(mockSchedule).toHaveBeenCalledWith(
        expect.objectContaining({
          trigger: expect.objectContaining({ channelId: 'reminders' }),
        }),
      );
    });

    test('uses critical priority mapping on Android', async () => {
      mockSchedule.mockResolvedValue('id');
      const reminder = makeReminder({ priority: 'critical' });
      await new ExpoNotificationProvider().schedule(reminder);
      expect(mockSchedule).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            priority: 'max',
          }),
        }),
      );
    });

    test('uses normal priority by default on Android', async () => {
      mockSchedule.mockResolvedValue('id');
      const reminder = makeReminder({ priority: 'normal' });
      await new ExpoNotificationProvider().schedule(reminder);
      expect(mockSchedule).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            priority: 'default',
          }),
        }),
      );
    });

    test('includes deeplink in data payload', async () => {
      mockSchedule.mockResolvedValue('id');
      const reminder = makeReminder({ deeplink: '/subject/abc' });
      await new ExpoNotificationProvider().schedule(reminder);
      expect(mockSchedule).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            data: expect.objectContaining({ deeplink: '/subject/abc' }),
          }),
        }),
      );
    });

    test('includes badge when set', async () => {
      mockSchedule.mockResolvedValue('id');
      const reminder = makeReminder({ badge: 5 });
      await new ExpoNotificationProvider().schedule(reminder);
      expect(mockSchedule).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({ badge: 5 }),
        }),
      );
    });
  });

  describe('cancel', () => {
    test('cancels by identifier', async () => {
      await new ExpoNotificationProvider().cancel('rem-42');
      expect(mockCancel).toHaveBeenCalledWith('rem-42');
    });
  });

  describe('cancelAll', () => {
    test('cancels all when no prefix', async () => {
      await new ExpoNotificationProvider().cancelAll();
      expect(mockCancelAll).toHaveBeenCalled();
    });

    test('cancels only matching prefix', async () => {
      mockGetAll.mockResolvedValue([
        { identifier: 'assessment_notif_1', content: { title: '', body: '' }, trigger: null },
        { identifier: 'assessment_notif_2', content: { title: '', body: '' }, trigger: null },
        { identifier: 'class_notif_1', content: { title: '', body: '' }, trigger: null },
      ]);
      await new ExpoNotificationProvider().cancelAll('assessment');
      expect(mockCancel).toHaveBeenCalledTimes(2);
      expect(mockCancel).toHaveBeenCalledWith('assessment_notif_1');
      expect(mockCancel).toHaveBeenCalledWith('assessment_notif_2');
      expect(mockCancel).not.toHaveBeenCalledWith('class_notif_1');
    });
  });

  describe('getAll', () => {
    test('returns mapped scheduled notifications', async () => {
      const future = new Date(Date.now() + 5000);
      mockGetAll.mockResolvedValue([
        {
          identifier: 'n1',
          content: { title: 'Title 1', body: 'Body 1' },
          trigger: { type: 'time_interval', seconds: 30 },
        },
        {
          identifier: 'n2',
          content: { title: 'Title 2', body: 'Body 2' },
          trigger: null,
        },
      ]);
      const result = await new ExpoNotificationProvider().getAll();
      expect(result).toHaveLength(2);
      expect(result[0].identifier).toBe('n1');
      expect(result[0].title).toBe('Title 1');
      expect(result[1].identifier).toBe('n2');
      expect(result[1].title).toBe('Title 2');
    });
  });
});
