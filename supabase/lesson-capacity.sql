-- Migration applied through Supabase. Keep a stable lesson_id for existing user progress.
-- Drop the old range checks, then allow the additional lesson without changing RLS or grants.
alter table public.lessons drop constraint if exists lessons_id_check;
alter table public.lessons add constraint lessons_id_check check (id between 1 and 24);
alter table public.lessons drop constraint if exists lessons_position_check;
alter table public.lessons add constraint lessons_position_check check (position between 1 and 24);
-- Move positions 23 down to 11 to 24 down to 12, in descending order,
-- preserving all existing ID references and user progress. The new lesson is ID 24, position 11.
