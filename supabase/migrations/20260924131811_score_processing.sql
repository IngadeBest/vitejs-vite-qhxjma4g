-- Add score details without rewriting historical results.
-- Nullable fields preserve the meaning of existing scores. No data backfill.
alter table public.scores
  add column if not exists result_status text,
  add column if not exists ridden_time numeric,
  add column if not exists penalty_seconds numeric,
  add column if not exists bonus_seconds numeric,
  add column if not exists rule_events jsonb,
  add column if not exists rules_version text;

alter table public.scores add constraint weh_result_status_valid
  check (result_status is null or result_status in ('completed','disqualified','eliminated','not_started','pending','hors_concours'));
alter table public.scores add constraint weh_time_components_valid check (
  (ridden_time is null or (ridden_time >= 0 and ridden_time < 'Infinity'::numeric)) and
  (penalty_seconds is null or (penalty_seconds >= 0 and penalty_seconds < 'Infinity'::numeric)) and
  (bonus_seconds is null or (bonus_seconds >= 0 and bonus_seconds < 'Infinity'::numeric))
);
alter table public.scores add constraint weh_speed_total_valid check (
  ridden_time is null or (
    penalty_seconds is not null and bonus_seconds is not null and
    result_status is not null and
    (result_status not in ('completed','hors_concours') or (score is not null and score = round(ridden_time + penalty_seconds - bonus_seconds, 2)))
  )
);
alter table public.scores add constraint weh_rule_events_valid
  check (rule_events is null or jsonb_typeof(rule_events) = 'array');
alter table public.scores add constraint weh_result_dq_consistent
  check (result_status is null or dq is not distinct from (result_status = 'disqualified'));

comment on column public.scores.ridden_time is 'WEH: gereden seconden, zonder straf of bonus; NULL voor legacy eindtijd';
comment on column public.scores.penalty_seconds is 'Niet-negatieve strafseconden; apart van bonus';
comment on column public.scores.bonus_seconds is 'Niet-negatieve bonustijd, wordt afgetrokken';
comment on column public.scores.result_status is 'NULL = legacy: dq/score bepaalt alleen DQ, completed of pending; geen eliminatie afleiden';
-- Existing table RLS/grants continue to apply; no SECURITY DEFINER or wider access.

alter table public.scores
 add column if not exists score_details jsonb,
 add column if not exists score_revision integer not null default 0;
alter table public.scores add constraint weh_score_details_valid check (score_details is null or jsonb_typeof(score_details) = 'object');
create unique index if not exists scores_one_per_entry_test on public.scores(proef_id,ruiter_id) where proef_id is not null and ruiter_id is not null;
