import { normalizeClass, classLabel, entryIdentity } from '../../rules/weh/classes.js';
export function participantClassification(participant) {
 const klasse = normalizeClass(participant.klasse);
 const youth = klasse && entryIdentity(participant.klasse, participant.rubriek).section === 'jeugd';
 return {klasse:klasse || participant.klasse || '',rubriek:youth ? 'Jeugd' : String(participant.rubriek || '').toLowerCase() === 'senior' ? 'Senior' : 'Algemeen'};
}
export function participantClassLabel(participant) {
 const {klasse,rubriek}=participantClassification(participant);
 return `${classLabel(klasse)}${rubriek === 'Jeugd' ? ' - Jeugd' : ''}`;
}
export function classificationUpdate(form) {
 const klasse=normalizeClass(form.klasse);
 if(!klasse) throw new Error('Kies een bekende WEH-klasse.');
 if(!['Algemeen','Senior','Jeugd'].includes(form.rubriek)) throw new Error('Kies Algemeen, Senior of Jeugd.');
 // Store section separately so moving out of Jeugd cannot leave a stale class suffix.
 return {klasse,rubriek:form.rubriek};
}
