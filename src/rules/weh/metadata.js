export const WEH_METADATA = Object.freeze({
  rulebookVersion: '2026-v10', documentVersion: '20260512',
  verifiedAt: '2026-09-19', publicationDate: null,
  effectiveDate: null, effectiveDateCandidates: ['2026-01-01', '2026-03-01'],
  source: 'https://weholland.nl/wp-content/uploads/2026/05/WEH-regelboek-2026-versie-10.pdf',
  scope: 'WEH nationaal',
  reviewRequired: ['RR01: tegenstrijdige ingangsdatum op p.1 en p.2'],
});
export class RulesReviewRequired extends Error {
  constructor(message) { super(`REVIEW REQUIRED: ${message}`); this.name = 'RulesReviewRequired'; }
}
