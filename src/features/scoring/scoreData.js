import { classLabel, resultClassKey, normalizeComponent } from '@/rules/weh/classes';
import { padStartnummer } from '@/lib/startnummer';

export function mapParticipants(entries) {
 return entries.filter(p => (!p.deelnemer_status || p.deelnemer_status === 'actief') && /^\d+$/.test(String(p.startnummer)) && Number(p.startnummer) > 0).map(p => ({
  ...p, uuid:p.id, id:Number(p.startnummer), startnummer:padStartnummer(p.startnummer),
  naam:p.ruiter || `${p.voornaam || ''} ${p.achternaam || ''}`.trim(),
  klasse:classLabel(resultClassKey(p.klasse,p.rubriek)),
 }));
}
export function mapTests(tests) {
 return tests.map(p=>({...p,klasse:classLabel(resultClassKey(p.klasse,p.rubriek)),onderdeel:normalizeComponent(p.onderdeel) || p.onderdeel}));
}
export async function loadScoreData(client, competitionId) {
 if (!competitionId) return {participants:[],tests:[],scores:[]};
 const results = await Promise.all([
  client.from('inschrijvingen').select('*').eq('wedstrijd_id',competitionId).order('startnummer'),
  client.from('proeven').select('*').eq('wedstrijd_id',competitionId).order('id'),
  client.from('scores').select('*').eq('wedstrijd_id',competitionId).order('id'),
 ]);
 for (const result of results) if(result.error) throw result.error;
 return {participants:mapParticipants(results[0].data || []),tests:mapTests(results[1].data || []),scores:results[2].data || []};
}
