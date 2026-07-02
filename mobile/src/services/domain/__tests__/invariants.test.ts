import { requireActiveSubject, requireActiveFlashcardDeck, requireActiveAudio, requireActivePhoto, requireActiveDocument } from '../invariants';

jest.mock('../../database', () => {
  const mockRequireActive = jest.fn();

  class MockRepo {
    requireActive = mockRequireActive;
  }

  return {
    subjectRepository: new MockRepo(),
    courseRepository: new MockRepo(),
    assessmentRepository: new MockRepo(),
    flashcardDeckRepository: new MockRepo(),
    audioRepository: new MockRepo(),
    photoRepository: new MockRepo(),
    documentRepository: new MockRepo(),
    scheduleRepository: new MockRepo(),
    calendarEventRepository: new MockRepo(),
    syncService: { enqueueCreate: jest.fn(), enqueueUpdate: jest.fn(), enqueueDelete: jest.fn() },
  };
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('requireActiveSubject', () => {
  it('throws when subject is deleted', async () => {
    const { subjectRepository } = require('../../database');
    (subjectRepository.requireActive as jest.Mock).mockRejectedValue(new Error("subjects 's1' has been deleted"));

    await expect(requireActiveSubject('s1')).rejects.toThrow('has been deleted');
  });

  it('throws when subject does not exist', async () => {
    const { subjectRepository } = require('../../database');
    (subjectRepository.requireActive as jest.Mock).mockRejectedValue(new Error("subjects 'nonexistent' does not exist"));

    await expect(requireActiveSubject('nonexistent')).rejects.toThrow('does not exist');
  });

  it('passes userId to repository', async () => {
    const { subjectRepository } = require('../../database');
    (subjectRepository.requireActive as jest.Mock).mockResolvedValue({ id: 's1', name: 'Math' });

    await requireActiveSubject('s1', 'u1');
    expect(subjectRepository.requireActive).toHaveBeenCalledWith('s1', 'u1');
  });
});

describe('requireActiveFlashcardDeck', () => {
  it('throws when deck is deleted', async () => {
    const { flashcardDeckRepository } = require('../../database');
    (flashcardDeckRepository.requireActive as jest.Mock).mockRejectedValue(new Error("flashcard_decks 'd1' has been deleted"));

    await expect(requireActiveFlashcardDeck('d1')).rejects.toThrow('has been deleted');
  });

  it('passes through when deck is active', async () => {
    const { flashcardDeckRepository } = require('../../database');
    (flashcardDeckRepository.requireActive as jest.Mock).mockResolvedValue({ id: 'd1', title: 'Math' });

    await expect(requireActiveFlashcardDeck('d1')).resolves.toEqual({ id: 'd1', title: 'Math' });
  });
});

describe('requireActiveAudio', () => {
  it('throws when audio recording is deleted', async () => {
    const { audioRepository } = require('../../database');
    (audioRepository.requireActive as jest.Mock).mockRejectedValue(new Error("audio_recordings 'a1' has been deleted"));

    await expect(requireActiveAudio('a1')).rejects.toThrow('has been deleted');
  });
});

describe('requireActivePhoto', () => {
  it('throws when photo is deleted', async () => {
    const { photoRepository } = require('../../database');
    (photoRepository.requireActive as jest.Mock).mockRejectedValue(new Error("photos 'p1' has been deleted"));

    await expect(requireActivePhoto('p1')).rejects.toThrow('has been deleted');
  });
});

describe('requireActiveDocument', () => {
  it('throws when document is deleted', async () => {
    const { documentRepository } = require('../../database');
    (documentRepository.requireActive as jest.Mock).mockRejectedValue(new Error("scanned_documents 'doc1' has been deleted"));

    await expect(requireActiveDocument('doc1')).rejects.toThrow('has been deleted');
  });
});
