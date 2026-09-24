import { describe, expect, it, vi } from 'vitest';
import { configForScope, saveStartlijst, sortStartlijst, startlijstScope, formatStartnummer } from './startlijstPersistence';

describe('startlijst persistence', () => {
  it('restores zeroes for numbers returned by the database', async () => {
    expect(formatStartnummer(null)).toBe('');
    expect(formatStartnummer(1)).toBe('001');
    expect(formatStartnummer(20)).toBe('020');
    expect(formatStartnummer(101)).toBe('101');
    const client = { rpc: async () => ({ data: [{ type: 'entry', startnummer: 7 }], error: null }) };
    expect((await saveStartlijst(client, 'w', [{}], {}, ''))[0].startnummer).toBe('007');
  });
  it('restores explicit cross-class order after a fresh load', () => {
    const rows = [{ id: 'a', klasse: 'WE0', volgorde: 1 }, { id: 'b', klasse: 'WE4', volgorde: 0 }];
    expect(sortStartlijst(rows).map(r => r.id)).toEqual(['b', 'a']);
    expect(sortStartlijst(rows, { rowOrder: [{ id: 'a' }, { id: 'b' }] }).map(r => r.id)).toEqual(['a', 'b']);
  });
  it('places unranked newcomers after saved participants', () => {
    expect(sortStartlijst([{ id: 'new', volgorde: null }, { id: 'old', volgorde: 0 }]).map(r => r.id))
      .toEqual(['old', 'new']);
  });
  it('keeps filtered pause configurations separate', () => {
    const scope = startlijstScope('WE1', 'Algemeen');
    const config = { totaalMaximum: 50, pauses: [{ id: 'all' }], startlijstScopes: { [scope]: { pauses: [{ id: 'one' }] } } };
    expect(configForScope(config, scope)).toMatchObject({ totaalMaximum: 50, pauses: [{ id: 'one' }] });
    expect(config.pauses).toEqual([{ id: 'all' }]);
  });
  it('uses returned permanent IDs on the next save instead of reinserting', async () => {
    const saved = [{ id: 'uuid', dbId: 'uuid', fromDB: true, type: 'entry' }];
    const client = { rpc: vi.fn().mockResolvedValue({ data: saved, error: null }) };
    const result = await saveStartlijst(client, 'wedstrijd', [{ id: 'temp', type: 'entry' }], {}, '["",""]');
    await saveStartlijst(client, 'wedstrijd', result, {}, '["",""]');
    expect(client.rpc.mock.calls[1][1].p_rows[0].dbId).toBe('uuid');
  });
  it('never claims success on a permission error or missing acknowledgement', async () => {
    const error = { message: 'permission denied', code: '42501' };
    await expect(saveStartlijst({ rpc: async () => ({ error }) }, 'w', [], {}, '')).rejects.toBe(error);
    await expect(saveStartlijst({ rpc: async () => ({ data: null }) }, 'w', [], {}, '')).rejects.toThrow('bevestigd');
  });
});
