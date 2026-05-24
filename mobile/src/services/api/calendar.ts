/**
 * calendar.ts
 *
 * Servicio para gestionar eventos de calendario
 */
import { fetchWithFallback, parseJsonSafely } from './client';
import { getUserId } from './auth';

export interface CalendarEventData {
  title: string;
  eventType: 'exam' | 'task' | 'class' | 'other';
  subjectId?: number;
  startDate: string; // DD-MM-YYYY
  endDate: string;   // DD-MM-YYYY
  startTime?: string; // HH:MM
  endTime?: string;   // HH:MM
  allDay: boolean;
  description?: string;
  createStudyPlan: boolean;
}

export interface CalendarEvent extends CalendarEventData {
  id: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Crear un nuevo evento de calendario
 */
export const createCalendarEvent = async (event: CalendarEventData): Promise<CalendarEvent> => {
  const userId = await getUserId();
  if (!userId) {
    throw new Error('No hay sesión activa.');
  }

  const payload = {
    user_id: Number(userId),
    ...event,
  };

  const response = await fetchWithFallback('/calendar/events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await parseJsonSafely(response);

  if (!response.ok) {
    throw new Error(data?.error || 'No se pudo crear el evento.');
  }

  return data as CalendarEvent;
};

/**
 * Obtener eventos de calendario del usuario
 */
export const getCalendarEvents = async (
  startDate?: string,
  endDate?: string
): Promise<CalendarEvent[]> => {
  const userId = await getUserId();
  if (!userId) {
    throw new Error('No hay sesión activa.');
  }

  let url = `/calendar/events?user_id=${userId}`;
  if (startDate) {
    url += `&startDate=${startDate}`;
  }
  if (endDate) {
    url += `&endDate=${endDate}`;
  }

  const response = await fetchWithFallback(url);

  if (!response.ok) {
    const errorData = await parseJsonSafely(response);
    throw new Error(errorData?.error || 'Error al obtener eventos.');
  }

  const data = await parseJsonSafely(response);
  return Array.isArray(data) ? data : [];
};

/**
 * Obtener un evento específico
 */
export const getCalendarEventById = async (eventId: number): Promise<CalendarEvent | null> => {
  const userId = await getUserId();
  if (!userId) {
    throw new Error('No hay sesión activa.');
  }

  const response = await fetchWithFallback(`/calendar/events/${eventId}?user_id=${userId}`);

  if (!response.ok) {
    return null;
  }

  return await parseJsonSafely(response);
};

/**
 * Actualizar un evento
 */
export const updateCalendarEvent = async (
  eventId: number,
  updates: Partial<CalendarEventData>
): Promise<CalendarEvent> => {
  const userId = await getUserId();
  if (!userId) {
    throw new Error('No hay sesión activa.');
  }

  const payload = {
    user_id: Number(userId),
    ...updates,
  };

  const response = await fetchWithFallback(`/calendar/events/${eventId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await parseJsonSafely(response);

  if (!response.ok) {
    throw new Error(data?.error || 'No se pudo actualizar el evento.');
  }

  return data as CalendarEvent;
};

/**
 * Eliminar un evento
 */
export const deleteCalendarEvent = async (eventId: number): Promise<void> => {
  const userId = await getUserId();
  if (!userId) {
    throw new Error('No hay sesión activa.');
  }

  const response = await fetchWithFallback(`/calendar/events/${eventId}?user_id=${userId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const data = await parseJsonSafely(response);
    throw new Error(data?.error || 'No se pudo eliminar el evento.');
  }
};
