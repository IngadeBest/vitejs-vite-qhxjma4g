import React, { useId } from 'react';
import { Input } from '@/ui/input';
import { STALMATEN, riderAge, todayKey } from '@/lib/registrationDetails';

export function DetailField({ name, label, form, onChange, errors = {}, ...props }) {
  const id = useId();
  return <div className="pi-field"><label htmlFor={id}>{label}</label>
    <Input id={id} name={name} value={form[name] ?? ''} onChange={e => onChange(s => ({ ...s, [name]: e.target.value }))}
      aria-invalid={!!errors[name]} aria-describedby={errors[name] ? `${id}-error` : undefined} {...props} />
    {errors[name] && <p id={`${id}-error`} className="pi-field-error" role="alert">{errors[name]}</p>}
  </div>;
}
export function BirthField({ form, onChange, errors, wedstrijdDatum, required = true }) {
  const age = riderAge(form.geboortedatum_ruiter, wedstrijdDatum);
  return <div><DetailField name="geboortedatum_ruiter" label={`Geboortedatum ruiter${required ? ' *' : ''}`} type="date" max={todayKey()} required={required} form={form} onChange={onChange} errors={errors} />
    {age != null && <p className="pi-muted">{age} jaar {wedstrijdDatum ? 'op de wedstrijddatum' : 'vandaag'}</p>}</div>;
}
export function HeightField(props) {
  return <DetailField name="stokmaat_cm" label={`Stokmaat paard/pony (cm)${props.form.stal_nodig ? ' *' : ''}`} type="number" min="0.1" max="300" step="0.1" inputMode="decimal" required={props.form.stal_nodig === true} {...props} />;
}
export function StallFields({ form, onChange, errors = {} }) {
  const id = useId();
  return <div className="pi-stalls">
    <fieldset><legend>Heb je een stal nodig?</legend><div className="pi-choices">
      {[false, true].map(value => <label className={`pi-choice ${form.stal_nodig === value ? 'is-selected' : ''}`} key={String(value)}>
        <input type="radio" name={`${id}-need`} checked={form.stal_nodig === value} onChange={() => onChange(s => ({ ...s, stal_nodig: value, stalmaat: value ? s.stalmaat : '' }))} />{value ? 'Ja' : 'Nee'}
      </label>)}
    </div></fieldset>
    {errors.stal_nodig && <p role="alert" className="pi-field-error">{errors.stal_nodig}</p>}
    {form.stal_nodig === true && <>
      <fieldset aria-describedby={errors.stalmaat ? `${id}-error` : undefined}><legend>Welke stal heb je nodig? *</legend><div className="pi-choices pi-size-choices">
        {Object.entries(STALMATEN).map(([value, label]) => <label className={`pi-choice ${form.stalmaat === value ? 'is-selected' : ''}`} key={value}>
          <input type="radio" name={`${id}-size`} required checked={form.stalmaat === value} onChange={() => onChange(s => ({ ...s, stalmaat: value }))} />
          <span>{label}<small>{value === 'klein' ? 'Geschikt voor pony/kleiner paard' : value === 'groot' ? 'Geschikt voor groot paard' : 'Organisatie mag indelen'}</small></span>
        </label>)}
      </div></fieldset>
      {errors.stalmaat && <p id={`${id}-error`} role="alert" className="pi-field-error">{errors.stalmaat}</p>}
      <p className="pi-muted">We gebruiken de stokmaat van je paard om de stalindeling te controleren. De organisatie kan de gekozen stalmaat indien nodig aanpassen.</p>
    </>}
  </div>;
}
export function RegistrationSummary({ entry, wedstrijdDatum }) {
  const age = riderAge(entry.geboortedatum_ruiter, wedstrijdDatum);
  return <div className="dm-cell-sub">
    <div>Geboortedatum: {entry.geboortedatum_ruiter ? entry.geboortedatum_ruiter.split('-').reverse().join('-') : 'Niet bekend'}{age != null ? ` · ${age} jaar${wedstrijdDatum ? ' op wedstrijddatum' : ''}` : ''}</div>
    <div>Stokmaat: {entry.stokmaat_cm != null ? `${entry.stokmaat_cm} cm` : 'Niet bekend'}</div>
    <span className={`dm-badge ${entry.stal_nodig ? 'dm-badge-blue' : ''}`}>Stal aangevraagd: {entry.stal_nodig == null ? 'Niet bekend' : entry.stal_nodig ? `Ja · ${STALMATEN[entry.stalmaat] || 'Maat niet bekend'}` : 'Nee'}</span>
  </div>;
}
