-- Migration: standalone_genre_exercises. No course content or account data in this file.
-- Shared read-only exercises keep the same authenticated-member RLS policy and favorite FK.
alter table public.exercises alter column lesson_id drop not null;
alter table public.exercises add column library_section text not null default 'course';
alter table public.exercises add column genre text;
alter table public.exercises add constraint exercises_library_section_check check (
 (library_section='course' and lesson_id is not null and genre is null)
 or (library_section='genres' and lesson_id is null and genre is not null
     and genre in ('blues','jazz','rock','pop','waltz','country','soul','funk','folk','postrock'))
);
comment on column public.exercises.library_section is 'course: attached to a lesson; genres: standalone genre exercise. Both require active membership.';
