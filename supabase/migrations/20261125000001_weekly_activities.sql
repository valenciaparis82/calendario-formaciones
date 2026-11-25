-- Ejecutar después de 20261125000000_initial_calendar.sql.
-- activities permanece intacta: todas las filas existentes siguen siendo citas únicas.
begin;

create table public.weekly_series (
  id uuid primary key default gen_random_uuid(),
  start_date date not null,
  until_date date,
  start_time time without time zone not null,
  end_time time without time zone not null,
  title text not null,
  description text,
  link text not null,
  color text not null default 'aqua',
  created_at timestamptz not null default now(),
  constraint weekly_dates_check check (until_date is null or until_date >= start_date),
  constraint weekly_time_check check (end_time > start_time),
  constraint weekly_title_check check (length(btrim(title)) between 1 and 160),
  constraint weekly_description_check check (description is null or length(description) <= 2000),
  constraint weekly_link_check check (link ~* '^https?://[^[:space:]]+$'),
  constraint weekly_color_check check (color in ('aqua', 'blue', 'lilac', 'peach', 'mint'))
);

create table public.weekly_exceptions (
  series_id uuid not null references public.weekly_series(id) on delete cascade,
  occurrence_date date not null,
  cancelled boolean not null default false,
  activity_date date,
  start_time time without time zone,
  end_time time without time zone,
  title text,
  description text,
  link text,
  color text,
  primary key (series_id, occurrence_date),
  constraint exception_shape_check check (
    (cancelled and activity_date is null and start_time is null and end_time is null
      and title is null and description is null and link is null and color is null)
    or
    (not cancelled and activity_date is not null and start_time is not null
      and end_time is not null and end_time > start_time and title is not null
      and length(btrim(title)) between 1 and 160 and
      (description is null or length(description) <= 2000) and
      link is not null and link ~* '^https?://[^[:space:]]+$' and
      color is not null and color in ('aqua', 'blue', 'lilac', 'peach', 'mint'))
  )
);

create index weekly_series_range_idx on public.weekly_series (start_date, until_date);
create index weekly_exceptions_display_idx on public.weekly_exceptions (activity_date) where not cancelled;

alter table public.weekly_series enable row level security;
alter table public.weekly_exceptions enable row level security;
revoke all on public.weekly_series, public.weekly_exceptions from public, anon, authenticated;
grant select on public.weekly_series, public.weekly_exceptions to anon, authenticated;
grant insert, update, delete on public.weekly_series, public.weekly_exceptions to authenticated;

create policy "Lectura pública de series" on public.weekly_series
  for select to anon, authenticated using (true);
create policy "Administrador crea series" on public.weekly_series
  for insert to authenticated with check ((select public.is_admin()));
create policy "Administrador edita series" on public.weekly_series
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Administrador elimina series" on public.weekly_series
  for delete to authenticated using ((select public.is_admin()));

create policy "Lectura pública de excepciones" on public.weekly_exceptions
  for select to anon, authenticated using (true);
create policy "Administrador crea excepciones" on public.weekly_exceptions
  for insert to authenticated with check ((select public.is_admin()));
create policy "Administrador edita excepciones" on public.weekly_exceptions
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Administrador elimina excepciones" on public.weekly_exceptions
  for delete to authenticated using ((select public.is_admin()));

commit;
