import { buildWehProtocolPdf } from './wehProtocolPdf.js';
export { CLASSES as KLASSEN } from '../rules/weh/classes.js';
export { STYLE_GENERAL_BASIC as ALG_PUNTEN_WE0_WE1, STYLE_GENERAL_ADVANCED as ALG_PUNTEN_WE2PLUS } from '../rules/weh/styleTrail.js';
export const ONDERDELEN = [
 {code:'dressuur',label:'Dressuur'}, {code:'stijl',label:'Stijltrail'}, {code:'speed',label:'Speedtrail'},
];
export function buildProtocolPdf(protocol, items) {
 if (items === null) throw new Error('Protocolonderdelen ontbreken.');
 return buildWehProtocolPdf(protocol, items);
}
export async function generatePdfBlob(protocol, items) { return buildProtocolPdf(protocol, items).output('blob'); }
