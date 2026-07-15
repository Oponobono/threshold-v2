import { DocumentAction } from '../DocumentAction';
import { DocumentCapabilities } from '../DocumentCapabilities';

describe('DocumentCapabilities', () => {
  it('supports registered actions', () => {
    const caps = new DocumentCapabilities([DocumentAction.Search, DocumentAction.Copy]);
    expect(caps.supports(DocumentAction.Search)).toBe(true);
    expect(caps.supports(DocumentAction.Copy)).toBe(true);
  });

  it('rejects unregistered actions', () => {
    const caps = new DocumentCapabilities([DocumentAction.Search]);
    expect(caps.supports(DocumentAction.AskAI)).toBe(false);
    expect(caps.supports(DocumentAction.CreateFlashcard)).toBe(false);
  });

  it('returns immutable actions list', () => {
    const caps = new DocumentCapabilities([DocumentAction.Highlight]);
    const actions = caps.actions;
    expect(actions).toEqual([DocumentAction.Highlight]);
    expect(Object.isFrozen(actions)).toBe(false);
  });

  it('handles empty capabilities', () => {
    const caps = new DocumentCapabilities([]);
    expect(caps.supports(DocumentAction.Search)).toBe(false);
    expect(caps.actions).toEqual([]);
  });

  it('handles all actions', () => {
    const allActions = Object.values(DocumentAction);
    const caps = new DocumentCapabilities(allActions);
    for (const action of allActions) {
      expect(caps.supports(action)).toBe(true);
    }
    expect(caps.actions.length).toBe(allActions.length);
  });
});
