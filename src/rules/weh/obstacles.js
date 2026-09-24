import { CLASSES, requireClass, normalizeComponent } from './classes.js';
import { styleRules } from './styleTrail.js';
const all = CLASSES.map(c=>c.code), from1 = all.filter(c=>c!=='we0'), from2 = from1.filter(c=>c!=='we1');
// Family IDs are stable; course occurrences and direction variants have separate identities.
const rows = [
 ['two_barrels','Acht om twee vaten',['2 tonnen','Acht om twee vaten/2 tonnen'],all,[70]],
 ['bridge','Brug',[],all,[71]],
 ['parallel_slalom','Parallelslalom',['Parallel slalom','Slalom tussen parallelle palen','Parellelslalom'],all,[72]],
 ['jump','Sprong over strobalen of een kruisje',['Sprong'],from1,[73]],
 ['pen','Live stock Roundpen',['Live stock pen','Round pen','Pen'],all,[74,75]],
 ['slalom','Slalom',['Enkele slalom'],all,[76]],
 ['three_barrels','3 Tonnen',['3 vaten','Drie vaten'],all,[77]],
 ['gate','Poort',['Poort voorwaarts'],from1,[78]],
 ['bell_corridor','Rechte gang of L met bel',['Gang met bel','Rechte gang met bel','Belgang'],all,[79]],
 ['jug_table','Tafel met kruik, fles of kan',['Tafel met kan','Tafel met kruik'],all,[80,81]],
 ['cup_corridor','Gang met hoed/beker: omzetten, recht of slalom achterwaarts',['Gang met beker omzetten','Gang met beker omzetten+achterwaarts','Slalom achterwaarts'],all,[81,82]],
 ['sideways_pole','Zijwaarts over een balk',['Zijwaarts over balk','Travers balk'],from1,[82]],
 ['garrocha_pickup','Garrocha uit een ton pakken',['Garrocha uit een vat halen','Garrocha uit ton'],from1,[84]],
 ['garrocha_return','Garrocha in een ton zetten',['Garrocha terugzetten in een vat','Garrocha in ton'],from1,[85]],
 ['ring','Ringsteken',[],from1,[86]],
 ['water','Door water rijden',['Greppel met water'],all,[87]],
 ['bank','Afsprong',[],from2,[88]],
 ['cup_transfer','Omhangen van een beker of kledingstuk',['Omhangen van beker of kledingstuk','Omhangen beker','Hoedje omhangen'],all,[89]],
];
export const OBSTACLES = Object.freeze(rows.map(([id,officialName,aliases,allowedClasses,sourcePages])=>Object.freeze({
 id,officialName,officialEnglishName:null,aliases,allowedClasses,allowedCategories:['open','jeugd','senioren','junioren','young_riders'],
 styleTrail:true,speedTrail:id==='jug_table'?'REVIEW REQUIRED':true,sourcePages,
 variants:id==='two_barrels'?['forward','backward']:id==='pen'?['left','right','both']:id==='gate'?['forward','backward']:id==='bell_corridor'?['straight','l_shape']:id==='cup_corridor'?['transfer_forward','transfer_backward','straight_backward','slalom_backward']:['standard'],
})));
// Bijlage 3 p.86: ophalen, ringsteken en terugzetten mogen samen één cijfer krijgen.
export const COMBINED_OBSTACLES = Object.freeze([Object.freeze({
 id:'garrocha_combined', officialName:'Garrocha uitnemen, ringsteken en terugzetten (ABC)',
 aliases:['Garrocha combinatie','Garrocha ABC','Garrocha: a. uit een ton pakken, b. ringsteken, c. in een ton zetten'], allowedClasses:from1,
 members:['garrocha_pickup','ring','garrocha_return'], variants:['standard'], sourcePages:[86],
 styleTrail:true, speedTrail:true,
})]);
const catalog = [...OBSTACLES, ...COMBINED_OBSTACLES];
const normalized=v=>String(v||'').trim().toLowerCase().replace(/\s+/g,' ');
const aliasMap=new Map();
for(const o of catalog)for(const alias of [o.id,o.officialName,...o.aliases])aliasMap.set(normalized(alias),{obstacleId:o.id,variant:o.variants[0]});
for(const [name,id,variant] of [
 ['2 tonnen voorwaarts+achterwaarts','two_barrels','backward'],['Poort achterwaarts','gate','backward'],
 ['L-gang met bel','bell_corridor','l_shape'],['Round pen links','pen','left'],['Round pen rechts','pen','right'],['Round pen links/rechts','pen','both'],
 ['Gang met beker omzetten+achterwaarts','cup_corridor','straight_backward'],['Slalom achterwaarts','cup_corridor','slalom_backward'],
])aliasMap.set(normalized(name),{obstacleId:id,variant});
export function resolveObstacle(value, klasse) {
 const c=requireClass(klasse);
 const found=typeof value==='string'?aliasMap.get(normalized(value)):value && {variant:'standard',...value};
 if(!found)return null;
 if(found.obstacleId==='cup_corridor' && typeof value==='string' && !normalized(value).includes('slalom')) {
  return {...found,variant:c.code==='we0'?'transfer_forward':c.code==='we1'?'transfer_backward':['we2','we2p'].includes(c.code)?'straight_backward':'slalom_backward'};
 }
 return {...found};
}
export function validateCourse(klasse, onderdeel, occurrences) {
 const c=requireClass(klasse),component=normalizeComponent(onderdeel),errors=[],review=[];
 if(!['Stijltrail','Speedtrail'].includes(component)||!c.requiredComponents.includes(component))errors.push('Trailonderdeel niet toegestaan.');
 if(!Array.isArray(occurrences))return {errors:['Parcours ontbreekt.'],review,valid:false};
 if(component==='Stijltrail') {
  const r=styleRules(klasse);
  if(r.minObstacles==null)review.push('RR03: aantal hindernissen JR/YR niet expliciet vastgesteld.');
  else if(occurrences.length<r.minObstacles||occurrences.length>r.maxObstacles)errors.push(`Stijltrail vereist ${r.minObstacles}–${r.maxObstacles} hindernissen.`);
 }
 const ids=new Set();
 occurrences.forEach((item,index)=>{
  const r=resolveObstacle(item,klasse),o=catalog.find(o=>o.id===r?.obstacleId);
  if(!o){errors.push(`Onbekend obstakel ${index+1}.`);return;}
  if(!o.allowedClasses.includes(c.code))errors.push(`${o.officialName} niet toegestaan in ${c.naam}.`);
  if(!o.variants.includes(r.variant))errors.push(`Onbekende variant van ${o.officialName}.`);
  if(o.id==='two_barrels'&&r.variant==='backward'&&(c.code!=='we4'||component==='Speedtrail'))errors.push('Achterwaartse acht alleen in WE4-stijltrail.');
  if(o.id==='gate'&&r.variant==='backward'&&c.code==='we1')errors.push('WE1 rijdt de poort voorwaarts.');
  if(o.id==='bell_corridor'&&r.variant==='l_shape'&&['we0','we1'].includes(c.code))errors.push('L-gang met bel niet toegestaan op dit niveau.');
  if(o.id==='cup_corridor') {
   const expected=c.code==='we0'?'transfer_forward':c.code==='we1'?'transfer_backward':['we2','we2p'].includes(c.code)?'straight_backward':'slalom_backward';
   if(r.variant!==expected)errors.push(`Gang met beker: verkeerde niveauvariant (${expected} vereist).`);
  }
  if(component==='Speedtrail'&&o.speedTrail==='REVIEW REQUIRED')review.push('RR05: tegenstrijdige toelating tafel met kan in speed.');
  if(r.occurrenceId){if(ids.has(r.occurrenceId))errors.push('Dubbel parcours-ID.');ids.add(r.occurrenceId);}
 });
 return {errors,review,valid:errors.length===0};
}
export function obstacleOptions(klasse) {
 const c=requireClass(klasse);
 const names = catalog.filter(o=>o.allowedClasses.includes(c.code)).map(o=>o.officialName);
 if (c.code === 'we4') names.push('2 tonnen voorwaarts+achterwaarts');
 if (from2.includes(c.code)) names.push('Poort achterwaarts', 'L-gang met bel');
 names.push('Round pen links', 'Round pen rechts', 'Round pen links/rechts');
 return names;
}
