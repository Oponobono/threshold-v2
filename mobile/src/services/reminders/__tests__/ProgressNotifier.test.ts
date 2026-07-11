import { ExpoProgressNotifier } from '../ProgressNotifier';

const mockSchedule = jest.fn();
const mockCancel = jest.fn();

jest.mock('expo-notifications', () => ({
  scheduleNotificationAsync: (opts: any) => mockSchedule(opts),
  cancelScheduledNotificationAsync: (id: string) => mockCancel(id),
  AndroidNotificationPriority: { DEFAULT: 'default' },
  SchedulableTriggerInputTypes: { TIME_INTERVAL: 'time_interval' },
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ExpoProgressNotifier', () => {
  describe('show', () => {
    test('schedules a notification with the given id and progress', async () => {
      const notifier = new ExpoProgressNotifier();
      await notifier.show('download_model', 'Descargando', 'Modelo de IA', 30);
      expect(mockSchedule).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: 'download_model',
          content: expect.objectContaining({
            title: 'Descargando',
            body: 'Modelo de IA: 30%',
          }),
        }),
      );
    });
  });

  describe('update', () => {
    test('reschedules with same id and updated progress', async () => {
      const notifier = new ExpoProgressNotifier();
      await notifier.update('download_model', 75, 'Modelo de IA');
      expect(mockSchedule).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: 'download_model',
          content: expect.objectContaining({
            body: 'Modelo de IA: 75%',
          }),
        }),
      );
    });

    test('does not override previous title', async () => {
      const notifier = new ExpoProgressNotifier();
      await notifier.update('download_model', 100, 'Listo');
      expect(mockSchedule).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            title: '',
          }),
        }),
      );
    });
  });

  describe('complete', () => {
    test('shows completion with checkmark prefix', async () => {
      const notifier = new ExpoProgressNotifier();
      await notifier.complete('download_model', 'Modelo de IA', 'Descarga completada');
      expect(mockSchedule).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: 'download_model',
          content: expect.objectContaining({
            title: '✅ Modelo de IA',
            body: 'Descarga completada',
          }),
        }),
      );
    });
  });

  describe('cancel', () => {
    test('cancels the notification by id', async () => {
      const notifier = new ExpoProgressNotifier();
      await notifier.cancel('download_model');
      expect(mockCancel).toHaveBeenCalledWith('download_model');
    });
  });
});
