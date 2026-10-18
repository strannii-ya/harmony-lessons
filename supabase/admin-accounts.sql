-- Schema applied with migration pending_verified_library_administrators.
-- Account addresses are provisioned separately in the private database, never in the public frontend.
-- The original library_owner record continues to identify the curriculum owner.
create table private.library_admin_accounts (
 email text primary key check (email=lower(btrim(email)) and length(email) between 3 and 254),
 user_id uuid unique references auth.users(id),
 active boolean not null default true,
 created_by uuid not null references auth.users(id),
 created_at timestamptz not null default now(),
 bound_at timestamptz,
 constraint admin_binding_complete check ((user_id is null) = (bound_at is null))
);
alter table private.library_admin_accounts enable row level security;
revoke all on private.library_admin_accounts from public, anon, authenticated;

create or replace function private.guard_library_signup() returns trigger language plpgsql security definer set search_path='' as $function$
begin
 if auth.uid() is not null and auth.uid()<>new.id then raise exception 'Account mismatch' using errcode='42501';end if;
 if coalesce(new.is_anonymous,false) then raise exception 'Registration is by invitation only' using errcode='42501';end if;
 if TG_OP='UPDATE' and lower(new.email) is distinct from lower(old.email) and exists(select 1 from public.members m where m.user_id=old.id) then raise exception 'An enrolled account cannot change its invited email' using errcode='42501';end if;
 if not exists(select 1 from private.library_owner o where o.user_id=new.id and o.email=lower(new.email))
 and not exists(select 1 from private.library_admin_accounts a where a.email=lower(new.email) and a.active and (a.user_id is null or a.user_id=new.id))
 and not exists(select 1 from public.library_access a where a.email=lower(new.email) and a.active and (a.user_id is null or a.user_id=new.id)) then raise exception 'Registration is by invitation only' using errcode='42501';end if;
 new.encrypted_password:='';return new;
end $function$;

create or replace function private.claim_verified_library() returns trigger language plpgsql security definer set search_path='' as $function$
declare invitation_id uuid; admin_email text;
begin
 if auth.uid() is not null and auth.uid()<>new.id then raise exception 'Account mismatch' using errcode='42501';end if;
 if new.email_confirmed_at is null or coalesce(new.is_anonymous,false) then return new;end if;
 if exists(select 1 from private.library_owner o where o.user_id=new.id and o.email=lower(new.email)) then
  insert into public.members(user_id,is_owner,active) values(new.id,true,true) on conflict(user_id) do update set is_owner=true,active=true;return new;
 end if;
 select a.email into admin_email from private.library_admin_accounts a where a.email=lower(new.email) and a.active and (a.user_id is null or a.user_id=new.id) for update;
 if admin_email is not null then
  update private.library_admin_accounts set user_id=new.id,bound_at=coalesce(bound_at,now()) where email=admin_email;
  insert into public.members(user_id,is_owner,active) values(new.id,true,true) on conflict(user_id) do update set is_owner=true,active=true;return new;
 end if;
 select a.id into invitation_id from public.library_access a where a.email=lower(new.email) and a.active and (a.user_id is null or a.user_id=new.id) for update;
 if invitation_id is not null then
  update public.library_access set user_id=new.id,joined_at=coalesce(joined_at,now()) where id=invitation_id;
  insert into public.members(user_id,is_owner,active) values(new.id,false,true) on conflict(user_id) do update set active=true where not members.is_owner;
 end if;
 return new;
end $function$;

create or replace function private.validate_library_access() returns trigger language plpgsql security definer set search_path='' as $function$
begin
 new.email:=lower(btrim(new.email));
 if exists(select 1 from private.library_owner o where o.email=new.email) or exists(select 1 from private.library_admin_accounts a where a.email=new.email) then raise exception 'Администратор имеет отдельный доступ. Его нельзя добавить или отключить в списке приглашений.' using errcode='22023';end if;
 new.updated_at:=now();return new;
end $function$;

create or replace function private.sync_library_access() returns trigger language plpgsql security definer set search_path='' as $function$
declare matched_user uuid;
begin
 select u.id into matched_user from auth.users u where lower(u.email)=new.email and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false) and (new.user_id is null or new.user_id=u.id);
 if matched_user is not null then
  if exists(select 1 from private.library_owner o where o.user_id=matched_user) or exists(select 1 from private.library_admin_accounts a where a.user_id=matched_user) then raise exception 'Administrator access cannot be changed through invitations' using errcode='42501';end if;
  update public.library_access set user_id=matched_user,joined_at=coalesce(joined_at,now()) where id=new.id;
  insert into public.members(user_id,is_owner,active) values(matched_user,false,new.active) on conflict(user_id) do update set active=excluded.active where not members.is_owner;
 elsif not new.active and new.user_id is not null then update public.members set active=false where user_id=new.user_id and not is_owner;
 end if;return null;
end $function$;

create function private.sync_library_admin_account() returns trigger language plpgsql security definer set search_path='' as $function$
begin
 if TG_OP='DELETE' then
  if old.user_id is not null then update public.members set is_owner=false,active=false where user_id=old.user_id and not exists(select 1 from private.library_owner o where o.user_id=old.user_id);end if;
  return old;
 end if;
 if new.email<>old.email or (old.user_id is not null and new.user_id is distinct from old.user_id) then raise exception 'A bound administrator identity cannot be reassigned' using errcode='42501';end if;
 if new.user_id is not null then
  if not exists(select 1 from auth.users u where u.id=new.user_id and lower(u.email)=new.email and u.email_confirmed_at is not null and not coalesce(u.is_anonymous,false)) then raise exception 'A verified matching identity is required' using errcode='42501';end if;
  update public.members set is_owner=true,active=new.active where user_id=new.user_id;
 end if;
 return new;
end $function$;
create trigger sync_library_admin_account before update or delete on private.library_admin_accounts for each row execute function private.sync_library_admin_account();
revoke all on function private.guard_library_signup(),private.claim_verified_library(),private.validate_library_access(),private.sync_library_access(),private.sync_library_admin_account() from public,anon,authenticated;
