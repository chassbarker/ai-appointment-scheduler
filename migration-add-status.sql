alter table public.appointments
add column if not exists status text not null default 'scheduled';

alter table public.appointments
drop constraint if exists appointments_status_check;

alter table public.appointments
add constraint appointments_status_check
check (status in ('scheduled', 'completed'));
