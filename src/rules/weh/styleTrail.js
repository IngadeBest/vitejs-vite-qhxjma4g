import { requireClass } from './classes.js';
import { RulesReviewRequired } from './metadata.js';
import { scoreMarks } from './scoring.js';
export const STYLE_GENERAL_BASIC = Object.freeze([
 'Zuiverheid van de gangen en regelmatigheid van de bewegingen van het paard',
 'Schwung, dynamiek, elasticiteit van de overgangen, losheid van de rugspieren',
 'Gehoorzaamheid, reactie op de hulpen, oplettendheid richting ruiter en vertrouwen in de ruiter',
 'Zit en rijwijze van de ruiter',
]);
export const STYLE_GENERAL_ADVANCED = Object.freeze([
 'Stap/galop/stap overgangen', ...STYLE_GENERAL_BASIC.slice(0, 3),
 'Zit en rijwijze van de ruiter, effectiviteit van de hulpen',
]);
export function styleRules(klasse) {
 const c = requireClass(klasse);
 return { id: c.styleTrailRuleSetId, minObstacles: c.min, maxObstacles: c.max,
  generalPoints: ['we0', 'we1'].includes(c.code) ? STYLE_GENERAL_BASIC : STYLE_GENERAL_ADVANCED,
  generalPointsDecision: ['junior', 'yr'].includes(c.code) ? 'organisator: zelfde protocol als WE2/WE2+/WE3/WE4, 2026-09-24' : 'WEH 2026 v10',
  betweenObstaclesGait: c.code === 'we0' ? 'draf' : 'galop',
  changes: c.code === 'we1' ? 'eenvoudig_stap_of_draf' : c.code === 'we2' ? 'eenvoudig_stap' : c.code === 'we0' ? null : 'vliegend',
  maximumTimeSeconds: null, timeLimitSetByCompetition: true,
  introSkipAllowed: c.code === 'we0', juniorExceptions: c.code === 'junior',
  handUse: c.code === 'we4' ? 'one' : c.code === 'yr' ? 'one_or_two' : 'two',
  source: '§1.2, §4 p.25–27, protocollen p.66–67', reviewRequired: c.reviewRequired,
 };
}
export function styleMaximum(klasse, obstacleCount) {
 const rule = styleRules(klasse);
 if (!rule.generalPoints) throw new RulesReviewRequired('RR08: algemene stijlpunten Junioren/Young Riders niet expliciet in nationaal formulier.');
 if (!Number.isInteger(obstacleCount) || obstacleCount < 1) throw new Error('Vul een positief geheel aantal hindernissen in.');
 if (rule.minObstacles != null && (obstacleCount < rule.minObstacles || obstacleCount > rule.maxObstacles)) throw new Error(`Stijltrail vereist ${rule.minObstacles}–${rule.maxObstacles} beoordelingen.`);
 return (obstacleCount + rule.generalPoints.length) * 10;
}
export function scoreStyle(klasse, obstacleMarks, generalMarks, { deduction = 0, introSkippedObstacleCount = 0, refusalCount = 0 } = {}) {
 const c = requireClass(klasse), rules = styleRules(klasse);
 styleMaximum(klasse, obstacleMarks.length);
 if (generalMarks.length !== rules.generalPoints.length) throw new Error('Verkeerd aantal algemene cijfers.');
 if (introSkippedObstacleCount && (c.code !== 'we0' || introSkippedObstacleCount > 1)) throw new Error('Overslaan is uitsluitend voor één obstakel in de Introductieklasse toegestaan.');
 const marks = [...obstacleMarks, ...generalMarks];
 const result = scoreMarks(marks.map(() => ({ coefficient: 1 })), marks, { deduction });
 return refusalCount >= 3 ? { ...result, score: null, percentage: null, status: 'disqualified' } : result;
}
