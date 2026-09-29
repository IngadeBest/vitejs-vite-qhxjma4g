import { getClass } from '../../rules/weh/classes';
import { participantClassification } from '../deelnemers/classification';

export function backupEntries(rows, wedstrijdId) {
  if (!wedstrijdId) throw new Error('Selecteer eerst de wedstrijd waarin de backup thuishoort.');
  if (!Array.isArray(rows)) throw new Error('De backup moet een lijst met deelnemers bevatten.');
  return rows.filter(row => row?.type === 'entry' && String(row.ruiter || '').trim()).map(row => {
    const klasse = getClass(row.klasse);
    if (!klasse) throw new Error('Backup bevat deelnemers zonder bekende klasse. Corrigeer die eerst.');
    const { rubriek } = participantClassification(row);
    return {
      wedstrijd_id: wedstrijdId,
      ruiter: String(row.ruiter).trim(),
      paard: String(row.paard || '').trim(),
      startnummer: row.startnummer || null,
      klasse: klasse.code === 'we0' ? 'WE0' : klasse.naam,
      rubriek,
    };
  });
}
