-- ============================================================================
-- Dokumenty instruktora: umowa z OSK + skan legitymacji. Wgrywa instruktor
-- sam (Storage bucket prywatny), admin tylko podgląda. Pierwszy bucket w
-- projekcie — ścieżka pliku to "{instructor_id}/{umowa|legitymacja}.{ext}",
-- storage.foldername(name)[1] daje instructor_id do RLS.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('instructor-docs', 'instructor-docs', false)
on conflict (id) do nothing;

alter table instructor add column umowa_sciezka text;
alter table instructor add column legitymacja_sciezka text;

-- Czy caller jest instruktorem, do którego należy dana ścieżka (self-upload).
create or replace function public.wlasny_dokument_instruktora(_path text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from instructor i
    join membership m on m.id = i.membership_id
    where i.id::text = (storage.foldername(_path))[1] and m.user_id = auth.uid()
  );
$$;

-- Czy caller jest adminem OSK, do którego należy instruktor spod tej ścieżki.
create or replace function public.admin_widzi_dokument_instruktora(_path text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from instructor i
    where i.id::text = (storage.foldername(_path))[1] and public.is_admin_of(i.osk_id)
  );
$$;

create policy instructor_docs_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'instructor-docs'
    and (public.wlasny_dokument_instruktora(name) or public.admin_widzi_dokument_instruktora(name))
  );

create policy instructor_docs_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'instructor-docs' and public.wlasny_dokument_instruktora(name));

create policy instructor_docs_update on storage.objects
  for update to authenticated
  using (bucket_id = 'instructor-docs' and public.wlasny_dokument_instruktora(name))
  with check (bucket_id = 'instructor-docs' and public.wlasny_dokument_instruktora(name));

create policy instructor_docs_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'instructor-docs' and public.wlasny_dokument_instruktora(name));
