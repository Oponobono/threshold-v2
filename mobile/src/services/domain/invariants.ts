import { RepositoryFactory } from '../database/RepositoryFactory';

export async function requireActiveSubject(id: string, userId?: string) {
  return RepositoryFactory.subjects().getById(id, userId);
}

export async function requireActiveCourse(id: string, userId?: string) {
  return RepositoryFactory.courses().getById(id);
}

export async function requireActiveAssessment(id: string, userId?: string) {
  return RepositoryFactory.assessments().getById(id, userId);
}

export async function requireActiveFlashcardDeck(id: string, userId?: string) {
  return RepositoryFactory.flashcardDecks().getById(id, userId);
}

export async function requireActiveAudio(id: string, userId?: string) {
  return RepositoryFactory.audio().getById(id, userId);
}

export async function requireActivePhoto(id: string, userId?: string) {
  return RepositoryFactory.photos().getById(id, userId);
}

export async function requireActiveDocument(id: string, userId?: string) {
  return RepositoryFactory.documents().getById(id, userId);
}

export async function requireActiveSchedule(id: string, userId?: string) {
  return RepositoryFactory.schedules().getById(id, userId);
}

export async function requireActiveCalendarEvent(id: string, userId?: string) {
  return RepositoryFactory.calendarEvents().getById(id, userId);
}
