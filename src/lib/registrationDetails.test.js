import { describe, it, expect } from 'vitest';
import { registrationErrors, registrationPayload, riderAge } from './registrationDetails';
const valid = { geboortedatum_ruiter: '2010-10-08', stokmaat_cm: '', stal_nodig: false, stalmaat: '' };
describe('registration details', () => {
  it('requires birth date for new registrations, but accepts legacy records', () => {
    expect(registrationErrors({})).toHaveProperty('geboortedatum_ruiter');
    expect(registrationErrors({}, { requireBirth: false })).toEqual({});
  });
  it('calculates age at the competition date, including birthdays and leap days', () => {
    expect(riderAge(valid.geboortedatum_ruiter, '2026-10-07')).toBe(15);
    expect(riderAge(valid.geboortedatum_ruiter, '2026-10-08')).toBe(16);
    expect(riderAge('2000-02-29', '2025-02-28')).toBe(24);
    expect(riderAge('2000-02-29', '2025-03-01')).toBe(25);
    expect(riderAge(null, '2026-01-01')).toBeNull();
  });
  it.each(['2035-01-01', '2010-02-30', 'bad', '2010-13-01'])('rejects invalid birth date %s', birth => {
    expect(registrationErrors({ ...valid, geboortedatum_ruiter: birth })).toHaveProperty('geboortedatum_ruiter');
  });
  it('does not require height or size without a stall and clears obsolete size', () => {
    expect(registrationErrors(valid)).toEqual({});
    expect(registrationPayload({...valid, stalmaat: 'groot'}, '2026-10-07')).toEqual({ geboortedatum_ruiter: valid.geboortedatum_ruiter, leeftijd_ruiter: 15, stokmaat_cm: null, stal_nodig: false, stalmaat: null });
  });
  it('requires height and size with a stall, including no preference as an explicit choice', () => {
    expect(registrationErrors({...valid, stal_nodig: true})).toHaveProperty('stokmaat_cm');
    expect(registrationErrors({...valid, stal_nodig: true})).toHaveProperty('stalmaat');
    const data = {...valid, stal_nodig: true, stokmaat_cm: '168.5', stalmaat: 'geen_voorkeur'};
    expect(registrationErrors(data)).toEqual({});
    expect(registrationPayload(data).stokmaat_cm).toBe(168.5);
  });
  it.each(['-1', '0', '301', 'NaN', true, {}, '1e2', '  '])('rejects invalid height %s', height => {
    expect(registrationErrors({...valid, stokmaat_cm:height})).toHaveProperty('stokmaat_cm');
  });
});
