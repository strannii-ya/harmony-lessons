-- Apply after schema.sql on the dedicated project, BEFORE loading private material.
-- The owner email is inserted privately by an administrator, not committed to Git.
begin;
alter table public.lessons alter column owner_id drop not null;
alter table public.exercises alter column owner_id drop not null;
create schema if not exists private;
revoke all on schema private from public,anon,authenticated;
create table private.library_owner(singleton boolean primary key default true check(singleton),email text not null unique);
alter table private.library_owner enable row level security;
revoke all on private.library_owner from public,anon,authenticated;
-- Trigger functions are intentionally private and not callable through the Data API.
create function private.guard_library_signup() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is not null and auth.uid() <> new.id then raise exception 'Account mismatch' using errcode='42501'; end if;
 if not exists(select 1 from private.library_owner o where lower(new.email)=o.email) or coalesce(new.is_anonymous,false) then raise exception 'Registration is not available' using errcode='42501'; end if;
 -- GoTrue generates a temporary password on first OTP signup. Allow the signup,
 -- but never retain a usable password: this app uses verified email only.
 new.encrypted_password := '';
 return new;
end $$;
revoke all on function private.guard_library_signup() from public,anon,authenticated;
create trigger guard_library_signup before insert or update of email,encrypted_password,is_anonymous on auth.users for each row execute function private.guard_library_signup();
create function private.claim_verified_library() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is not null and auth.uid() <> new.id then raise exception 'Account mismatch' using errcode='42501'; end if;
 if new.email_confirmed_at is not null and not coalesce(new.is_anonymous,false) and exists(select 1 from private.library_owner o where lower(new.email)=o.email) then
  insert into public.members(user_id) values(new.id) on conflict do nothing;
  update public.lessons set owner_id=new.id where owner_id is null;
  update public.exercises set owner_id=new.id where owner_id is null;
 end if;
 return new;
end $$;
revoke all on function private.claim_verified_library() from public,anon,authenticated;
create trigger claim_verified_library after insert or update of email_confirmed_at on auth.users for each row execute function private.claim_verified_library();
commit;
