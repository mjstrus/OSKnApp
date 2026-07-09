-- ============================================================================
-- Unit 8: Chat 1:1 (R15) — kursant↔instruktor, kursant↔biuro/admin
--
-- Realtime dostarcza wiadomości; RLS ogranicza widoczność do uczestników.
-- ============================================================================

create table chat_message (
  id uuid primary key default gen_random_uuid(),
  osk_id uuid not null references osk (id) on delete cascade,
  sender_id uuid not null,
  recipient_id uuid not null,
  tresc text not null check (length(trim(tresc)) > 0),
  created_at timestamptz not null default now(),
  foreign key (sender_id, osk_id) references membership (id, osk_id) on delete cascade,
  foreign key (recipient_id, osk_id) references membership (id, osk_id) on delete cascade
);

create index chat_message_para_idx on chat_message (osk_id, sender_id, recipient_id, created_at);
create index chat_message_recipient_idx on chat_message (recipient_id, created_at);

grant select on all tables in schema public to anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;

alter table chat_message enable row level security;

-- Widoczność tylko dla uczestników rozmowy (nadawca lub odbiorca).
create policy chat_message_select_participant on chat_message
  for select to authenticated
  using (public.is_own_membership(sender_id) or public.is_own_membership(recipient_id));

-- Wysłać można tylko we własnym imieniu (sender = moje membership).
create policy chat_message_insert_sender on chat_message
  for insert to authenticated
  with check (public.is_own_membership(sender_id));

-- Realtime: publikacja istnieje na Supabase; lokalnie (shim) tworzymy ją.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end
$$;
alter publication supabase_realtime add table chat_message;
