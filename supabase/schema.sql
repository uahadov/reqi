-- ============================================================
-- PetHub Ops — Supabase schema, views, functions & RLS
-- Run this in the Supabase SQL Editor.
-- ============================================================

-- Enable required extension for gen_random_uuid()
create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- Users: branch accounts + single admin account
-- ------------------------------------------------------------
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  display_name text not null,
  password_hash text not null,
  role text not null check (role in ('branch','admin')),
  created_at timestamptz default now()
);

-- ------------------------------------------------------------
-- Sessions: service-only table used by the custom auth flow
-- ------------------------------------------------------------
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  token uuid unique default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz default now(),
  expires_at timestamptz default (now() + interval '24 hours')
);

create index if not exists idx_sessions_token on sessions(token);
create index if not exists idx_sessions_user_id on sessions(user_id);

-- ------------------------------------------------------------
-- Inventory: full snapshot, replaced on every admin upload
-- ------------------------------------------------------------
create table if not exists inventory (
  id uuid primary key default gen_random_uuid(),
  brand text not null,
  product_name text not null,
  qty integer not null default 0,
  uploaded_at timestamptz default now()
);

create index if not exists idx_inventory_brand on inventory(brand);

-- ------------------------------------------------------------
-- Orders: one row per submitted order
-- ------------------------------------------------------------
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid references users(id) not null,
  branch_name text not null,
  brand text not null,
  order_text text not null,
  created_at timestamptz default now(),
  deleted_at timestamptz default null
);

create index if not exists idx_orders_branch_id on orders(branch_id);
create index if not exists idx_orders_created_at on orders(created_at desc);
create index if not exists idx_orders_deleted_at on orders(deleted_at);

-- ------------------------------------------------------------
-- Password change audit log (nice-to-have)
-- ------------------------------------------------------------
create table if not exists password_change_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  changed_by uuid references users(id),
  changed_at timestamptz default now()
);

-- ------------------------------------------------------------
-- Auth helpers
-- ------------------------------------------------------------
create or replace function auth_user_id()
returns uuid
language plpgsql
stable
security definer
as $$
declare
  headers jsonb;
  auth_header text;
  tok text;
  uid uuid;
begin
  headers := nullif(current_setting('request.headers', true), '')::jsonb;
  if headers is null then return null; end if;

  -- The client sends the session token as: Authorization: Pethub <token>
  -- We use a custom scheme so we don't clash with Supabase Auth's Bearer JWTs.
  auth_header := trim(both from coalesce(headers ->> 'authorization', ''));
  if auth_header is null or auth_header = '' or auth_header not like 'Pethub %' then
    return null;
  end if;

  tok := trim(both from split_part(auth_header, ' ', 2));
  if tok = '' then return null; end if;

  select user_id into uid
  from sessions
  where token = tok::uuid
    and (expires_at is null or expires_at > now());

  return uid;
end;
$$;

grant execute on function auth_user_id() to anon, authenticated;

create or replace function is_admin()
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1 from users where id = auth_user_id() and role = 'admin'
  );
$$;

grant execute on function is_admin() to anon, authenticated;

create or replace function is_branch()
returns boolean
language sql
stable
security definer
as $$
  select exists (
    select 1 from users where id = auth_user_id() and role = 'branch'
  );
$$;

grant execute on function is_branch() to anon, authenticated;

create or replace function is_authenticated()
returns boolean
language sql
stable
security definer
as $$
  select auth_user_id() is not null;
$$;

grant execute on function is_authenticated() to anon, authenticated;

-- ------------------------------------------------------------
-- Client-facing user view: never exposes password_hash
-- ------------------------------------------------------------
create or replace view user_profiles as
select
  id,
  username,
  display_name,
  role,
  created_at
from users
where
  id = auth_user_id()
  or is_admin();

grant select on user_profiles to anon, authenticated;

-- ------------------------------------------------------------
-- Server-side actions (called via supabase.rpc)
-- ------------------------------------------------------------
create or replace function replace_inventory(items jsonb)
returns void
language plpgsql
security definer
as $$
begin
  if not is_admin() then
    raise exception 'Bunu yalnız adminlər edə bilər';
  end if;

  delete from inventory;

  insert into inventory (brand, product_name, qty)
  select
    trim(coalesce(x ->> 'brand', '')),
    trim(coalesce(x ->> 'product_name', '')),
    coalesce((x ->> 'qty')::int, 0)
  from jsonb_array_elements(items) as x;
end;
$$;

grant execute on function replace_inventory(jsonb) to anon, authenticated;

create or replace function soft_delete_order(order_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  if not is_admin() then
    raise exception 'Sifarişi yalnız adminlər silə bilər';
  end if;

  update orders
  set deleted_at = now()
  where id = order_id
    and deleted_at is null;
end;
$$;

grant execute on function soft_delete_order(uuid) to anon, authenticated;

-- ------------------------------------------------------------
-- Auth RPCs (used instead of Edge Functions for simpler deployment)
-- ------------------------------------------------------------

create or replace function login(p_username text, p_password text, p_role text)
returns json
language plpgsql
security definer
as $$
declare
  u users%rowtype;
  sess_token uuid;
  result json;
begin
  select * into u from users where username = p_username;

  if not found then
    raise exception 'Yanlış məlumat';
  end if;

  if p_role is not null and u.role != p_role then
    raise exception 'Yanlış rol seçildi';
  end if;

  if u.password_hash != crypt(p_password, u.password_hash) then
    raise exception 'Yanlış məlumat';
  end if;

  insert into sessions (user_id) values (u.id) returning token into sess_token;

  result := json_build_object(
    'token', sess_token,
    'user', json_build_object(
      'id', u.id,
      'username', u.username,
      'display_name', u.display_name,
      'role', u.role,
      'created_at', u.created_at
    )
  );

  return result;
end;
$$;

grant execute on function login(text, text, text) to anon, authenticated;

create or replace function me(p_token uuid)
returns json
language plpgsql
security definer
as $$
declare
  u users%rowtype;
begin
  select users.* into u
  from users
  join sessions on sessions.user_id = users.id
  where sessions.token = p_token
    and (sessions.expires_at is null or sessions.expires_at > now());

  if not found then
    raise exception 'Sessiya etibarsızdır və ya vaxtı keçib';
  end if;

  return json_build_object(
    'id', u.id,
    'username', u.username,
    'display_name', u.display_name,
    'role', u.role,
    'created_at', u.created_at
  );
end;
$$;

grant execute on function me(uuid) to anon, authenticated;

create or replace function change_password(p_user_id uuid, p_new_password text)
returns void
language plpgsql
security definer
as $$
begin
  if auth_user_id() is null or not is_admin() then
    raise exception 'Şifrələri yalnız adminlər dəyişə bilər';
  end if;

  if length(p_new_password) < 4 then
    raise exception 'Şifrə ən azı 4 simvol olmalıdır';
  end if;

  update users
  set password_hash = crypt(p_new_password, gen_salt('bf'))
  where id = p_user_id;

  insert into password_change_log (user_id, changed_by)
  values (p_user_id, auth_user_id());
end;
$$;

grant execute on function change_password(uuid, text) to anon, authenticated;

-- ------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------
alter table users enable row level security;
alter table inventory enable row level security;
alter table orders enable row level security;
alter table sessions enable row level security;
alter table password_change_log enable row level security;
-- No policies on sessions/password_change_log => client cannot access them directly.
-- Service-side functions (security definer) can still write to them.

-- Users: password changes happen via the change_password RPC. No client
-- select/update/delete on the users table itself.

-- Inventory
-- Client-side reads for all authenticated users; modifications only for admins.
drop policy if exists "inventory_select_authenticated" on inventory;
create policy "inventory_select_authenticated"
  on inventory for select
  using (is_authenticated());

drop policy if exists "inventory_modify_admin" on inventory;
create policy "inventory_modify_admin"
  on inventory for all
  using (is_admin())
  with check (is_admin());

-- Orders
-- Branches see only their own rows. Admins see non-deleted rows.
-- Inserts are restricted to a branch writing for itself.
drop policy if exists "orders_select" on orders;
create policy "orders_select"
  on orders for select
  using (
    (branch_id = auth_user_id() and deleted_at is null)
    or (is_admin() and deleted_at is null)
  );

drop policy if exists "orders_insert_branch_own" on orders;
create policy "orders_insert_branch_own"
  on orders for insert
  with check (
    branch_id = auth_user_id()
    and is_branch()
  );

-- Soft deletes happen through the soft_delete_order RPC; no direct update/delete needed.

-- Ensure the PostgREST roles can use our tables and functions
grant usage on schema public to anon, authenticated;
grant select, insert on orders to anon, authenticated;
grant select on inventory to anon, authenticated;

-- Refresh the PostgREST schema cache so new RPC functions are immediately available
notify pgrst, 'reload schema';
