-- ============================================================================
-- Unit 8: Test RLS chatu (R15) — widoczność tylko dla uczestników 1:1
-- ============================================================================

\set ON_ERROR_STOP on

begin;

truncate table osk cascade;
delete from auth.users where email like '%@chat-test.local';

insert into auth.users (id, email) values
  ('0d000000-0000-0000-0000-000000000001', 'kursant@chat-test.local'),
  ('0d000000-0000-0000-0000-000000000002', 'instruktor@chat-test.local'),
  ('0d000000-0000-0000-0000-000000000003', 'obcy@chat-test.local');

insert into osk (id, nazwa) values ('0d100000-0000-0000-0000-000000000001', 'OSK Chat');

insert into membership (id, osk_id, user_id, rola) values
  ('0d200000-0000-0000-0000-000000000001', '0d100000-0000-0000-0000-000000000001', '0d000000-0000-0000-0000-000000000001', 'kursant'),
  ('0d200000-0000-0000-0000-000000000002', '0d100000-0000-0000-0000-000000000001', '0d000000-0000-0000-0000-000000000002', 'instruktor'),
  ('0d200000-0000-0000-0000-000000000003', '0d100000-0000-0000-0000-000000000001', '0d000000-0000-0000-0000-000000000003', 'kursant');

-- Wiadomość kursant -> instruktor.
insert into chat_message (id, osk_id, sender_id, recipient_id, tresc) values
  ('0d300000-0000-0000-0000-000000000001', '0d100000-0000-0000-0000-000000000001',
   '0d200000-0000-0000-0000-000000000001', '0d200000-0000-0000-0000-000000000002', 'Dzień dobry, kiedy jazda?');

commit;

-- Test 1: nadawca (kursant) widzi
do $$
declare cnt bigint;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', '0d000000-0000-0000-0000-000000000001', 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into cnt from chat_message;
  if cnt <> 1 then raise exception 'FAIL: nadawca nie widzi swojej wiadomości (%).', cnt; end if;
  raise notice 'PASS: nadawca widzi wiadomość';
end $$;

-- Test 2: odbiorca (instruktor) widzi
do $$
declare cnt bigint;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', '0d000000-0000-0000-0000-000000000002', 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into cnt from chat_message;
  if cnt <> 1 then raise exception 'FAIL: odbiorca nie widzi wiadomości (%).', cnt; end if;
  raise notice 'PASS: odbiorca widzi wiadomość';
end $$;

-- Test 3: osoba trzecia nie widzi
do $$
declare cnt bigint;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', '0d000000-0000-0000-0000-000000000003', 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into cnt from chat_message;
  if cnt <> 0 then raise exception 'FAIL: osoba trzecia widzi cudzą rozmowę (%).', cnt; end if;
  raise notice 'PASS: osoba trzecia nie widzi rozmowy';
end $$;

-- Test 4: nie można wysłać w cudzym imieniu (sender != moje membership)
do $$
declare denied boolean := false;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', '0d000000-0000-0000-0000-000000000003', 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    insert into chat_message (osk_id, sender_id, recipient_id, tresc) values
      ('0d100000-0000-0000-0000-000000000001', '0d200000-0000-0000-0000-000000000001',
       '0d200000-0000-0000-0000-000000000002', 'Podszywam się');
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'FAIL: wysłano w cudzym imieniu'; end if;
  raise notice 'PASS: nie można podszyć się pod innego nadawcę';
end $$;

select 'ALL CHAT TESTS PASSED' as result;

truncate table osk cascade;
delete from auth.users where email like '%@chat-test.local';
