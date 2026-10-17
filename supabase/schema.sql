-- Interface code is public. This schema contains NO lessons, allowlisted email or credentials.
-- Run only on the dedicated project after confirming organization and cost.
-- Create the owner's Auth user through Auth, then insert its VERIFIED UUID into members
-- with an administrator session. Never put an email allowlist in client code.
begin;
create table if not exists public.members (
 user_id uuid primary key references auth.users(id) on delete cascade
);
create table if not exists public.lessons (
 id integer primary key check(id between 1 and 23),
 owner_id uuid not null references public.members(user_id),
 position integer not null unique check(position between 1 and 23),
 chapter integer not null check(chapter between 1 and 7),
 chapter_title text not null, title text not null, subtitle text not null default '',
 goal text not null, preparation jsonb not null default '[]', topics jsonb not null default '[]',
 unique(id,owner_id),check(jsonb_typeof(preparation)='array'),check(jsonb_typeof(topics)='array')
);
create table if not exists public.exercises (
 id text primary key, owner_id uuid not null references public.members(user_id),
 lesson_id integer not null, position integer not null,
 title text not null, goal text not null, discuss text not null,
 mode text not null check(mode in ('major','minor')),
 progression jsonb not null, loop boolean not null default false,
 unique(id,owner_id),foreign key(lesson_id,owner_id) references public.lessons(id,owner_id) on delete cascade,
 check(jsonb_typeof(progression)='array'),check(jsonb_array_length(progression) between 1 and 64)
);
create table if not exists public.progress (
 user_id uuid not null references public.members(user_id),lesson_id integer not null,
 completed boolean not null default false,notes text not null default '' check(length(notes)<=20000),
 primary key(user_id,lesson_id),foreign key(lesson_id,user_id) references public.lessons(id,owner_id) on delete cascade
);
create table if not exists public.favorites (
 user_id uuid not null references public.members(user_id),exercise_id text not null,
 primary key(user_id,exercise_id),foreign key(exercise_id,user_id) references public.exercises(id,owner_id) on delete cascade
);
create index if not exists exercises_lesson_id_idx on public.exercises(lesson_id);
create index if not exists lessons_owner_id_idx on public.lessons(owner_id);
create index if not exists exercises_owner_id_idx on public.exercises(owner_id);
alter table public.members enable row level security;
alter table public.lessons enable row level security;
alter table public.exercises enable row level security;
alter table public.progress enable row level security;
alter table public.favorites enable row level security;
revoke all on public.members,public.lessons,public.exercises,public.progress,public.favorites from anon,authenticated;
grant select on public.members,public.lessons,public.exercises to authenticated;
grant select,insert,update,delete on public.progress,public.favorites to authenticated;
-- Role membership alone is not authorization. No client-side membership writes.
create policy "owner membership only" on public.members for select to authenticated using(user_id=(select auth.uid()));
create policy "owner lessons only" on public.lessons for select to authenticated using(owner_id=(select auth.uid()) and exists(select 1 from public.members m where m.user_id=(select auth.uid())));
create policy "owner exercises only" on public.exercises for select to authenticated using(owner_id=(select auth.uid()) and exists(select 1 from public.members m where m.user_id=(select auth.uid())));
create policy "owner progress read" on public.progress for select to authenticated using(user_id=(select auth.uid()) and exists(select 1 from public.members m where m.user_id=(select auth.uid())));
create policy "owner progress insert" on public.progress for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.members m where m.user_id=(select auth.uid())));
create policy "owner progress update" on public.progress for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()) and exists(select 1 from public.members m where m.user_id=(select auth.uid())));
create policy "owner progress delete" on public.progress for delete to authenticated using(user_id=(select auth.uid()));
create policy "owner favorites" on public.favorites for all to authenticated using(user_id=(select auth.uid()) and exists(select 1 from public.members m where m.user_id=(select auth.uid()))) with check(user_id=(select auth.uid()) and exists(select 1 from public.members m where m.user_id=(select auth.uid())));
commit;
