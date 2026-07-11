-- ============================================================================
-- Bucket na multimedia pytań egzaminacyjnych. PUBLICZNY (nie prywatny jak
-- instructor-docs) — to oficjalna treść egzaminu państwowego, ta sama dla
-- wszystkich kursantów kat. B w kraju, zero danych osobowych. Publiczny odczyt
-- pozwala osadzać <img>/<video> bezpośrednio bez generowania signed URL przy
-- każdym pytaniu symulacji.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('question-media', 'question-media', true)
on conflict (id) do nothing;

create policy question_media_public_read on storage.objects
  for select to public
  using (bucket_id = 'question-media');
