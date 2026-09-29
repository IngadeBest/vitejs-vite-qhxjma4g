import { expect, it } from 'vitest';
import { backupEntries } from './backupEntries';
import { matchesStartlijstClass } from './startlijstPersistence';

it('restores into the selected event and preserves youth and fixed numbers', () => {
  const row = { type: 'entry', ruiter: ' Ruiter ', paard: 'Pony', klasse: 'WE0 - Jeugd', startnummer: '007', wedstrijd_id: 'old' };
  expect(backupEntries([row, { type: 'break' }], 'selected')).toEqual([
    { wedstrijd_id: 'selected', ruiter: 'Ruiter', paard: 'Pony', klasse: 'WE0', rubriek: 'Jeugd', startnummer: '007' },
  ]);
  expect(row.wedstrijd_id).toBe('old');
});
it('refuses an unspecified destination and unknown classes before writing', () => {
  expect(() => backupEntries([], '')).toThrow('Selecteer eerst');
  expect(() => backupEntries([{ type: 'entry', ruiter: 'Ruiter', klasse: 'WE99' }], 'w')).toThrow('bekende klasse');
});
it('does not match different unknown classes while recognizing known aliases', () => {
  expect(matchesStartlijstClass({ klasse: 'WE99' }, 'WE98')).toBe(false);
  expect(matchesStartlijstClass({ klasse: '0' }, 'WE0')).toBe(true);
  expect(matchesStartlijstClass({ klasse: 'WE0 - Jeugd' }, 'WE0')).toBe(true);
});
