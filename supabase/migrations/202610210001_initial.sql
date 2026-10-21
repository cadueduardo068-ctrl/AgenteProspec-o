-- Single administrator MVP. Only the backend service key can read or mutate state.
begin;
create table if not exists public.cadu_state (
  id integer primary key check (id = 1),
  version bigint not null default 0,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  updated_at timestamptz not null default now()
);
alter table public.cadu_state enable row level security;
revoke all on public.cadu_state from public, anon, authenticated;
grant select, update on public.cadu_state to service_role;
insert into public.cadu_state(id,data) values (1, '{"companies":[],"messages":[],"jobs":[],"tasks":[],"contacts":[],"analyses":[],"contactLedger":[],"events":[],"exclusions":[],"webhookIds":[],"settings":{"dailyLimit":10,"placesDailyLimit":30,"paused":false,"notifications":true,"manualApproval":true},"usage":[],"rateLimits":{}}'::jsonb) on conflict (id) do nothing;
create or replace function public.cadu_compare_and_swap(expected_version bigint, next_data jsonb)
returns boolean language sql security invoker set search_path = '' as $$
  with changed as (
    update public.cadu_state set data=next_data, version=version+1, updated_at=now()
    where id=1 and version=expected_version returning id
  ) select exists(select 1 from changed);
$$;
revoke all on function public.cadu_compare_and_swap(bigint,jsonb) from public, anon, authenticated;
grant execute on function public.cadu_compare_and_swap(bigint,jsonb) to service_role;
commit;
