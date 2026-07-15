create table if not exists public.appointments (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null check (char_length(name) between 1 and 100),
    type text not null check (char_length(type) between 1 and 100),
    date date not null,
    time time not null,
    notes text check (notes is null or char_length(notes) <= 500),
    created_at timestamptz not null default now()
);

alter table public.appointments enable row level security;

drop policy if exists "Users can read their appointments" on public.appointments;
create policy "Users can read their appointments" on public.appointments
for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their appointments" on public.appointments;
create policy "Users can create their appointments" on public.appointments
for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their appointments" on public.appointments;
create policy "Users can update their appointments" on public.appointments
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their appointments" on public.appointments;
create policy "Users can delete their appointments" on public.appointments
for delete to authenticated using ((select auth.uid()) = user_id);

create index if not exists appointments_user_date_time_idx
on public.appointments (user_id, date, time);
