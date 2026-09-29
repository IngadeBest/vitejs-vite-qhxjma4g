import React from 'react';
import { CLASS_OPTIONS } from '@/rules/weh/classes';
export default function ClassificationFields({form,onChange}) {
 return <>
  <label>Klasse<select aria-label="Klasse" value={form.klasse} onChange={e=>onChange({...form,klasse:e.target.value})}>
   <option value="">Kies klasse</option>
   {CLASS_OPTIONS.map(c=><option key={c.code} value={c.code}>{c.label}</option>)}
  </select></label>
  <label>Rubriek<select aria-label="Rubriek" value={form.rubriek} onChange={e=>onChange({...form,rubriek:e.target.value})}>
   {['Algemeen','Senior','Jeugd'].map(r=><option key={r} value={r}>{r}</option>)}
  </select></label>
  <small>Jeugd is een aparte rubriek binnen de gekozen klasse. Junioren is een afzonderlijke klasse.</small>
 </>;
}
