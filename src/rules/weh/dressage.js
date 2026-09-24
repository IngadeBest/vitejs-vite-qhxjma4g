import data from './dressageData.json';
import { requireClass } from './classes.js';
import { scoreMarks, weightedMaximum } from './scoring.js';
export const DRESSAGE_TESTS = data;
export function dressageTest(klasse) { return DRESSAGE_TESTS[requireClass(klasse).dressageTestId]; }
export function dressageMaximum(klasse) { return weightedMaximum(dressageTest(klasse).items); }
export function scoreDressage(klasse, marks, options) { return scoreMarks(dressageTest(klasse).items, marks, options); }
export function dressageRows(klasse) {
 return dressageTest(klasse).items.map(item => [item.letters, item.text, '', item.criteria, { number: item.number, kind: item.kind, coefficient: item.coefficient }]);
}
