import { FlashcardDomainService } from '../FlashcardDomainService';
import { flashcardDeckRepository } from '../../database/repositories/FlashcardDeckRepository';
import { flashcardRepository } from '../../database/repositories/FlashcardRepository';

const mockGetUserId = jest.fn().mockResolvedValue('user-1');

jest.mock('../../api/auth', () => ({
  getUserId: () => mockGetUserId(),
}));

jest.mock('../../database/repositories/FlashcardDeckRepository', () => ({
  flashcardDeckRepository: {
    getByIdIncludingDeleted: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
}));

jest.mock('../../database/repositories/FlashcardRepository', () => ({
  flashcardRepository: {
    getByIdIncludingDeleted: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
}));

const deckRepo = flashcardDeckRepository as any;
const cardRepo = flashcardRepository as any;
const service = new FlashcardDomainService();

const validDeck = {
  id: 'deck-server-1',
  title: 'Expo en React',
  description: '',
  subjectId: 'subject-1',
  cards: [
    { id: 'card-server-1', deckId: 'deck-server-1', front: '¿Qué es Expo?', back: 'Un framework de React Native.', item_type: 'flashcard' },
    { id: 'card-server-2', deckId: 'deck-server-1', front: '¿Qué es React?', back: 'Una librería de UI.', item_type: 'flashcard' },
  ],
};

describe('FlashcardDomainService.saveGeneratedDeck', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockGetUserId.mockResolvedValue('user-1');
  });

  describe('contrato', () => {
    it('lanza si deck.id no está presente', async () => {
      await expect(service.saveGeneratedDeck({ ...validDeck, id: '' } as any)).rejects.toThrow(/requiere deck.id/);
      await expect(service.saveGeneratedDeck({ ...validDeck, id: undefined } as any)).rejects.toThrow(/requiere deck.id/);
    });

    it('lanza si una card no trae su id', async () => {
      const deck = { ...validDeck, cards: [{ ...validDeck.cards[0], id: undefined }] } as any;
      await expect(service.saveGeneratedDeck(deck)).rejects.toThrow(/requiere que cada card tenga su id/);
    });

    it('lanza si card.deckId no coincide con deck.id', async () => {
      const deck = { ...validDeck, cards: [{ ...validDeck.cards[0], deckId: 'deck-otro' }] } as any;
      await expect(service.saveGeneratedDeck(deck)).rejects.toThrow(/no coincide con deck.id/);
    });

    it('no escribe nada cuando el contrato falla', async () => {
      await expect(service.saveGeneratedDeck({ ...validDeck, id: '' } as any)).rejects.toThrow();
      expect(deckRepo.create).not.toHaveBeenCalled();
      expect(cardRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('persistencia idempotente', () => {
    it('INSERT si el deck no existe, usando los ids del backend', async () => {
      deckRepo.getByIdIncludingDeleted.mockResolvedValue(null);
      cardRepo.getByIdIncludingDeleted.mockResolvedValue(null);

      const result = await service.saveGeneratedDeck(validDeck);

      expect(deckRepo.create).toHaveBeenCalledTimes(1);
      expect(deckRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'deck-server-1',
          title: 'Expo en React',
          subject_id: 'subject-1',
          card_count: 2,
        })
      );
      expect(cardRepo.create).toHaveBeenCalledTimes(2);
      expect(cardRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'card-server-1',
          deck_id: 'deck-server-1',
          front: '¿Qué es Expo?',
          item_type: 'flashcard',
        })
      );
      expect(result).toMatchObject({ id: 'deck-server-1', card_count: 2 });
    });

    it('UPDATE sin duplicar si el deck ya existe, preservando el id', async () => {
      deckRepo.getByIdIncludingDeleted.mockResolvedValue({ id: 'deck-server-1' });

      await service.saveGeneratedDeck(validDeck);

      expect(deckRepo.create).not.toHaveBeenCalled();
      expect(deckRepo.update).toHaveBeenCalledTimes(1);
      expect(deckRepo.update).toHaveBeenCalledWith(
        'deck-server-1',
        expect.objectContaining({ title: 'Expo en React' })
      );
    });

    it('es idempotente: dos llamadas con el mismo id no crean un segundo deck', async () => {
      deckRepo.getByIdIncludingDeleted
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'deck-server-1' });
      cardRepo.getByIdIncludingDeleted.mockResolvedValue(null);

      await service.saveGeneratedDeck(validDeck);
      await service.saveGeneratedDeck(validDeck);

      expect(deckRepo.create).toHaveBeenCalledTimes(1);
      expect(deckRepo.update).toHaveBeenCalledTimes(1);
      expect(cardRepo.create).toHaveBeenCalledTimes(4);
    });
  });

  describe('topic', () => {
    it('persiste topic en INSERT y en UPDATE', async () => {
      deckRepo.getByIdIncludingDeleted.mockResolvedValue(null);
      cardRepo.getByIdIncludingDeleted.mockResolvedValue(null);

      await service.saveGeneratedDeck({ ...validDeck, topic: 'Expo en React Native' });

      expect(deckRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ topic: 'Expo en React Native' })
      );

      deckRepo.getByIdIncludingDeleted.mockResolvedValue({ id: 'deck-server-1' });
      await service.saveGeneratedDeck({ ...validDeck, topic: 'Expo en React Native' });

      expect(deckRepo.update).toHaveBeenCalledWith(
        'deck-server-1',
        expect.objectContaining({ topic: 'Expo en React Native' })
      );
    });

    it('normaliza topic ausente a null (no undefined)', async () => {
      deckRepo.getByIdIncludingDeleted.mockResolvedValue(null);
      cardRepo.getByIdIncludingDeleted.mockResolvedValue(null);

      await service.saveGeneratedDeck(validDeck);

      expect(deckRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ topic: null })
      );
    });
  });
});
