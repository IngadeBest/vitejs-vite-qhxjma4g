import { describe, expect, it } from 'vitest';
import { loadStalls, changedStalls } from './stalOpslag';

describe('central stable assignments', () => {
  it('imports local assignments only for existing rows with no central value', () => {
    const rows = [{ id: 'a', stal_toewijzing: null }, { id: 'b', stal_toewijzing: { heeftStal: false, stalnummer: '' } }];
    const local = { a: { heeftStal: true, stalnummer: ' 12 ' }, b: { heeftStal: true, stalnummer: 'old' }, deleted: { heeftStal: true, stalnummer: '9' } };
    const { saved, draft } = loadStalls(rows, local);
    expect(draft.b).toEqual({ heeftStal: false, stalnummer: '' });
    expect(changedStalls(saved, draft)).toEqual({ a: { before: null, after: { heeftStal: true, stalnummer: '12' } } });
    expect(local.a.stalnummer).toBe(' 12 ');
  });
  it('sends only changed participants and keeps the old value for conflict checking', () => {
    const saved = { a: { heeftStal: true, stalnummer: '2' }, b: { heeftStal: true, stalnummer: '3' } };
    const changes = changedStalls(saved, { ...saved, a: { heeftStal: false, stalnummer: '2' } });
    expect(changes).toEqual({ a: { before: saved.a, after: { heeftStal: false, stalnummer: '' } } });
  });
  it('does not create blank records when no assignment has ever been made', () => {
    const { saved, draft } = loadStalls([{ id: 'a', stal_toewijzing: null }], {});
    expect(changedStalls(saved, draft)).toEqual({});
  });
});
