-- ============================================================
-- PetHub Ops — Seed data
-- Run this after schema.sql in the Supabase SQL Editor.
-- Default passwords (change these immediately via the admin panel):
--   admin      -> admin123
--   zorge      -> zorge123
--   nizami     -> nizami123
--   gencik     -> gencik123
--   teze_bazar -> teze123
--   malakan    -> malakan123
-- ============================================================

insert into users (id, username, display_name, password_hash, role)
values
  ('3079050f-f9cd-4320-ac80-033c6efd07aa', 'admin',      'Admin',      public.crypt('admin123',  public.gen_salt('bf')), 'admin'),
  ('7684fed0-5481-4a9c-9bde-ebe64c2a026d', 'zorge',      'Zorge',      public.crypt('zorge123',  public.gen_salt('bf')), 'branch'),
  ('fdc5a715-9713-4969-b9a6-e5d1b9e86b14', 'nizami',     'Nizami',     public.crypt('nizami123', public.gen_salt('bf')), 'branch'),
  ('6e3e0d1c-9bc0-4925-b40c-7ce75606093f', 'gencik',     'Gənclik',    public.crypt('gencik123', public.gen_salt('bf')), 'branch'),
  ('0ebd9dbd-9ed9-49a2-98bb-7822cea7b80c', 'teze_bazar', 'Təzə Bazar', public.crypt('teze123',   public.gen_salt('bf')), 'branch'),
  ('9ad54672-568a-4054-b6ab-317c8e92c27e', 'malakan',    'Malakan',    public.crypt('malakan123',public.gen_salt('bf')), 'branch')
on conflict (username) do update set
  display_name = excluded.display_name,
  password_hash = excluded.password_hash,
  role = excluded.role;
