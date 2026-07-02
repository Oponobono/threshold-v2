import {
  subjectRepository,
  courseRepository,
  assessmentRepository,
  flashcardDeckRepository,
  audioRepository,
  photoRepository,
  documentRepository,
  scheduleRepository,
  calendarEventRepository,
} from '../database';

export async function requireActiveSubject(id: string, userId?: string) {
  return subjectRepository.requireActive(id, userId);
}

export async function requireActiveCourse(id: string, userId?: string) {
  return courseRepository.requireActive(id, userId);
}

export async function requireActiveAssessment(id: string, userId?: string) {
  return assessmentRepository.requireActive(id, userId);
}

export async function requireActiveFlashcardDeck(id: string, userId?: string) {
  return flashcardDeckRepository.requireActive(id, userId);
}

export async function requireActiveAudio(id: string, userId?: string) {
  return audioRepository.requireActive(id, userId);
}

export async function requireActivePhoto(id: string, userId?: string) {
  return photoRepository.requireActive(id, userId);
}

export async function requireActiveDocument(id: string, userId?: string) {
  return documentRepository.requireActive(id, userId);
}

export async function requireActiveSchedule(id: string, userId?: string) {
  return scheduleRepository.requireActive(id, userId);
}

export async function requireActiveCalendarEvent(id: string, userId?: string) {
  return calendarEventRepository.requireActive(id, userId);
}
