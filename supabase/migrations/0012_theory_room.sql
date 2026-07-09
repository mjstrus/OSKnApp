-- ============================================================================
-- Sala na grafiku teorii — theory_session dostaje opcjonalne room_id.
-- ============================================================================

alter table theory_session add column room_id uuid references room (id) on delete set null;
