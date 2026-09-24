alter table public.wedstrijden add column if not exists protocol_config jsonb not null default '{}'::jsonb;

create or replace function public.save_protocol_items(p_wedstrijd_id uuid, p_klasse text, p_items jsonb, p_expected jsonb default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare current_config jsonb; result jsonb;
begin
  if auth.uid() is null or not exists (select 1 from public.admins where user_id = auth.uid()) then
    raise exception 'Geen beheerrechten' using errcode = '42501';
  end if;
  if p_klasse is null or p_klasse not in ('we0','we1','we2','we2p','we3','we4','junior','yr') then
    raise exception 'Onbekende klasse';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then raise exception 'Hindernissen moeten een lijst zijn'; end if;
  if jsonb_array_length(p_items) > 50 or exists (select 1 from jsonb_array_elements(p_items) v where jsonb_typeof(v) <> 'string' or length(v #>> '{}') > 500 or btrim(v #>> '{}') = '') then
    raise exception 'Ongeldige hindernis';
  end if;
  select protocol_config into current_config from public.wedstrijden where id=p_wedstrijd_id for update;
  if not found then raise exception 'Wedstrijd niet gevonden of geen beheerrechten'; end if;
  if (current_config -> p_klasse) is distinct from p_expected then
    raise exception 'Het parcours is inmiddels gewijzigd. Laad de opgeslagen versie opnieuw voordat je opslaat.';
  end if;
  update public.wedstrijden set protocol_config=jsonb_set(protocol_config,array[p_klasse],p_items,true)
  where id=p_wedstrijd_id returning protocol_config -> p_klasse into result;
  if not found then raise exception 'Opslaan geweigerd' using errcode='42501'; end if;
  return result;
end;
$$;
revoke all on function public.save_protocol_items(uuid,text,jsonb,jsonb) from public, anon;
grant execute on function public.save_protocol_items(uuid,text,jsonb,jsonb) to authenticated;
