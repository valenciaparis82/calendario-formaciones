-- Ejecutar una vez en Supabase SQL Editor (o mediante Supabase CLI).
-- Después de crear la cuenta en Authentication > Users, añadir su UUID a
-- private.admin_users con el comando indicado en README.md.
create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
revoke all on private.admin_users from public, anon, authenticated;
alter table private.admin_users enable row level security;

-- La función solo devuelve un booleano; la lista privada nunca queda expuesta
-- por la API. search_path fijado para evitar secuestro de nombres.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.admin_users
    where user_id = (select auth.uid())
  );
$$;
revoke all on function public.is_admin() from public, anon, authenticated;
grant execute on function public.is_admin() to authenticated;

create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  activity_date date not null,
  start_time time without time zone not null,
  end_time time without time zone not null,
  title text not null,
  description text,
  link text not null,
  color text not null default 'aqua',
  created_at timestamptz not null default now(),
  constraint activities_title_check check (length(btrim(title)) between 1 and 160),
  constraint activities_description_check check (description is null or length(description) <= 2000),
  constraint activities_time_check check (end_time > start_time),
  constraint activities_link_check check (link ~* '^https?://[^[:space:]]+$'),
  constraint activities_color_check check (color in ('aqua', 'blue', 'lilac', 'peach', 'mint'))
);

create index if not exists activities_week_order_idx on public.activities (activity_date, start_time, created_at);
alter table public.activities enable row level security;

revoke all on public.activities from public, anon, authenticated;
grant select on public.activities to anon, authenticated;
grant insert, update, delete on public.activities to authenticated;

create policy "Lectura pública de actividades"
on public.activities for select
to anon, authenticated
using (true);

create policy "Solo administrador crea actividades"
on public.activities for insert
to authenticated
with check ((select public.is_admin()));

create policy "Solo administrador edita actividades"
on public.activities for update
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "Solo administrador elimina actividades"
on public.activities for delete
to authenticated
using ((select public.is_admin()));
