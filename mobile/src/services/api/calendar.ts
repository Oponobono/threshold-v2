import { fetchWithFallback, parseJsonSafely } from './client';
import { getUserId } from './auth';
import { calendarEventRepository, syncService } from '../database';

export interface CalendarEventData {
  title: string;
  eventType: 'exam' | 'task' | 'class' | 'other';
  subjectId?: string;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  allDay: boolean;
  description?: string;
  createStudyPlan: boolean;
}

export interface CalendarEvent extends CalendarEventData {
  id: string;
  createdAt: string;
  updatedAt: string;
}

const normalizeEventForLocal = (e: any, fallbackUserId?: string): any => ({
  id: e.id,
  user_id: e.user_id != null ? String(e.user_id) : e.userId != null ? String(e.userId) : fallbackUserId,
  title: e.title,
  event_type: e.event_type ?? e.eventType,
  subject_id: e.subject_id ?? e.subjectId ?? null,
  start_date: e.start_date ?? e.startDate,
  end_date: e.end_date ?? e.endDate,
  all_day: e.all_day != null ? e.all_day : (e.allDay ? 1 : 0),
  description: e.description ?? null,
  study_plan_flag: e.study_plan_flag != null ? e.study_plan_flag : (e.createStudyPlan ? 1 : 0),
  created_at: e.created_at ?? e.createdAt ?? null,
  updated_at: e.updated_at ?? e.updatedAt ?? null,
});

export const createCalendarEvent = async (event: CalendarEventData): Promise<CalendarEvent> => {
  const { uuidv4 } = await import('../../utils/uuid');
  const id = uuidv4();
  const userId = await getUserId();
  if (!userId) throw new Error('No hay sesión activa.');

  const evt: any = { id, user_id: String(userId), title: event.title, event_type: event.eventType, subject_id: event.subjectId, start_date: event.startDate, end_date: event.endDate, all_day: event.allDay ? 1 : 0, description: event.description, study_plan_flag: event.createStudyPlan ? 1 : 0 };
  await calendarEventRepository.create(evt);

  try {
    const response = await fetchWithFallback('/calendar/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...event, id, user_id: Number(userId) }),
    });
    const data = await parseJsonSafely(response);
    if (response.ok && data) {
      await calendarEventRepository.upsert(normalizeEventForLocal(data, String(userId)));
      return data;
    }
    throw new Error(data?.error || 'Error del servidor');
  } catch {
    await syncService.enqueueCreate('calendar-event', id, { ...event, user_id: userId });
    return { id, ...event, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as CalendarEvent;
  }
};

export const getCalendarEvents = async (startDate?: string, endDate?: string): Promise<CalendarEvent[]> => {
  const userId = await getUserId();
  if (!userId) throw new Error('No hay sesión activa.');

  // 1. Leer localmente primero
  const localData = await calendarEventRepository.getByUser(String(userId));

  // 2. Sincronizar en background
  (async () => {
    try {
      let url = `/calendar/events?user_id=${userId}`;
      if (startDate) url += `&startDate=${startDate}`;
      if (endDate) url += `&endDate=${endDate}`;
      const response = await fetchWithFallback(url);
      if (response.ok) {
        const data = await parseJsonSafely(response);
        const events = Array.isArray(data) ? data : [];
        for (const e of events) {
          const normalized = normalizeEventForLocal(e, String(userId));
          if (normalized.user_id) await calendarEventRepository.upsert(normalized);
        }
      }
    } catch {}
  })();

  return localData as any;
};


export const getCalendarEventById = async (eventId: string): Promise<CalendarEvent | null> => {
  const userId = await getUserId();
  if (!userId) throw new Error('No hay sesión activa.');

  // 1. Leer localmente primero
  const localData = await calendarEventRepository.getById(eventId);

  // 2. Sincronizar en background
  (async () => {
    try {
      const response = await fetchWithFallback(`/calendar/events/${eventId}?user_id=${userId}`);
      if (response.ok) {
        const data = await parseJsonSafely(response);
        if (data) await calendarEventRepository.upsert(normalizeEventForLocal(data, String(userId)));
      }
    } catch {}
  })();

  return localData as CalendarEvent | null;
};

export const updateCalendarEvent = async (eventId: string, updates: Partial<CalendarEventData>): Promise<any> => {
  const data: any = {};
  if (updates.title) data.title = updates.title;
  if (updates.eventType) data.event_type = updates.eventType;
  if (updates.subjectId !== undefined) data.subject_id = updates.subjectId;
  if (updates.startDate) data.start_date = updates.startDate;
  if (updates.endDate) data.end_date = updates.endDate;
  if (updates.description !== undefined) data.description = updates.description;
  if (updates.allDay !== undefined) data.all_day = updates.allDay ? 1 : 0;
  if (updates.createStudyPlan !== undefined) data.study_plan_flag = updates.createStudyPlan ? 1 : 0;

  await calendarEventRepository.update(eventId, data);

  try {
    const response = await fetchWithFallback(`/calendar/events/${eventId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const responseData = await parseJsonSafely(response);
    if (response.ok) return responseData;
    throw new Error('Error del servidor');
  } catch {
    await syncService.enqueueUpdate('calendar-event', eventId, updates);
    return { ...updates, _isPending: true };
  }
};

export const deleteCalendarEvent = async (eventId: string): Promise<void> => {
  await calendarEventRepository.delete(eventId);

  try {
    const userId = await getUserId();
    const response = await fetchWithFallback(`/calendar/events/${eventId}?user_id=${userId}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Error al eliminar el evento');
  } catch {
    await syncService.enqueueDelete('calendar-event', eventId);
  }
};
