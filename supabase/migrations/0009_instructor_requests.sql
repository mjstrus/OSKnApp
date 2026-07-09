-- ============================================================================
-- Unit 11: zgłoszenia instruktorów do admina (urlop / problem / zmiana grafiku)
-- + wejście dla kafelka "zgłoszenia od instruktorów" na pulpicie admina.
-- ============================================================================

create type instructor_request_status as enum ('pending', 'rozpatrzone');

create table instructor_request (
  id uuid primary key default gen_random_uuid(),
  osk_id uuid not null references osk (id) on delete cascade,
  instructor_id uuid not null,
  typ text not null default 'inne',
  tresc text not null,
  status instructor_request_status not null default 'pending',
  created_at timestamptz not null default now(),
  rozpatrzone_at timestamptz,
  foreign key (instructor_id, osk_id) references instructor (id, osk_id) on delete cascade
);

create index instructor_request_osk_id_idx on instructor_request (osk_id, status);

alter table instructor_request enable row level security;

create policy instructor_request_admin_all on instructor_request
  for all using (public.is_admin_of(osk_id)) with check (public.is_admin_of(osk_id));

create policy instructor_request_own_insert on instructor_request
  for insert with check (public.teaches_as_instructor(instructor_id));

create policy instructor_request_own_select on instructor_request
  for select using (
    public.is_admin_of(osk_id) or public.teaches_as_instructor(instructor_id)
  );
