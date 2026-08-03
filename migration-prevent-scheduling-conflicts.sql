begin;

create extension if not exists btree_gist;

create table if not exists public.providers (
    id uuid primary key default gen_random_uuid(),
    name text not null unique check (char_length(name) between 1 and 100),
    timezone text not null default 'America/Chicago',
    active boolean not null default true,
    created_at timestamptz not null default now()
);

alter table public.providers enable row level security;

drop policy if exists "Authenticated users can view active providers"
on public.providers;

create policy "Authenticated users can view active providers"
on public.providers
for select
to authenticated
using (active = true);

create table if not exists public.provider_availability (
    id uuid primary key default gen_random_uuid(),
    provider_id uuid not null
        references public.providers(id)
        on delete cascade,
    day_of_week smallint not null
        check (day_of_week between 0 and 6),
    start_time time not null,
    end_time time not null,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    check (start_time < end_time),
    unique (provider_id, day_of_week, start_time, end_time)
);

alter table public.provider_availability enable row level security;

drop policy if exists "Authenticated users can view provider availability"
on public.provider_availability;

create policy "Authenticated users can view provider availability"
on public.provider_availability
for select
to authenticated
using (
    active = true
    and exists (
        select 1
        from public.providers
        where providers.id = provider_availability.provider_id
          and providers.active = true
    )
);

create table if not exists public.provider_time_off (
    id uuid primary key default gen_random_uuid(),
    provider_id uuid not null
        references public.providers(id)
        on delete cascade,
    starts_at timestamp not null,
    ends_at timestamp not null,
    created_at timestamptz not null default now(),
    check (starts_at < ends_at)
);

alter table public.provider_time_off enable row level security;

insert into public.providers (name, timezone)
values ('Primary Provider', 'America/Chicago')
on conflict (name) do update
set active = true;

insert into public.provider_availability (
    provider_id,
    day_of_week,
    start_time,
    end_time
)
select
    providers.id,
    schedule.day_of_week,
    schedule.start_time,
    schedule.end_time
from public.providers
cross join (
    values
        (1, '09:00'::time, '12:00'::time),
        (1, '13:00'::time, '17:00'::time),
        (2, '09:00'::time, '12:00'::time),
        (2, '13:00'::time, '17:00'::time),
        (3, '09:00'::time, '12:00'::time),
        (3, '13:00'::time, '17:00'::time),
        (4, '09:00'::time, '12:00'::time),
        (4, '13:00'::time, '17:00'::time),
        (5, '09:00'::time, '12:00'::time),
        (5, '13:00'::time, '17:00'::time)
) as schedule(day_of_week, start_time, end_time)
where providers.name = 'Primary Provider'
on conflict (provider_id, day_of_week, start_time, end_time)
do nothing;

alter table public.appointments
add column if not exists provider_id uuid;

alter table public.appointments
add column if not exists duration_minutes integer not null default 30;

alter table public.appointments
add column if not exists cancelled_at timestamptz;

alter table public.appointments
add column if not exists completed_at timestamptz;

alter table public.appointments
add column if not exists no_show_at timestamptz;

update public.appointments
set provider_id = (
    select id
    from public.providers
    where name = 'Primary Provider'
)
where provider_id is null;

alter table public.appointments
alter column provider_id set not null;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'appointments_provider_id_fkey'
          and conrelid = 'public.appointments'::regclass
    ) then
        alter table public.appointments
        add constraint appointments_provider_id_fkey
        foreign key (provider_id)
        references public.providers(id);
    end if;
end
$$;

alter table public.appointments
drop constraint if exists appointments_duration_minutes_check;

alter table public.appointments
add constraint appointments_duration_minutes_check
check (duration_minutes in (15, 30, 45, 60, 90));

alter table public.appointments
drop constraint if exists appointments_status_check;

alter table public.appointments
add constraint appointments_status_check
check (
    status in (
        'scheduled',
        'completed',
        'cancelled',
        'no_show'
    )
);

alter table public.appointments
add column if not exists scheduled_range tsrange
generated always as (
    tsrange(
        date + time,
        date + time + make_interval(mins => duration_minutes),
        '[)'
    )
) stored;

do $$
begin
    if exists (
        select 1
        from public.appointments first_appointment
        join public.appointments second_appointment
          on first_appointment.id < second_appointment.id
         and first_appointment.provider_id = second_appointment.provider_id
         and first_appointment.status = 'scheduled'
         and second_appointment.status = 'scheduled'
         and first_appointment.scheduled_range
             && second_appointment.scheduled_range
    ) then
        raise exception
            'Overlapping scheduled appointments exist. Resolve them before applying this migration.';
    end if;
end
$$;

drop index if exists public.appointments_user_scheduled_slot_unique;
drop index if exists public.appointments_provider_scheduled_slot_unique;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'appointments_no_provider_overlap'
          and conrelid = 'public.appointments'::regclass
    ) then
        alter table public.appointments
        add constraint appointments_no_provider_overlap
        exclude using gist (
            provider_id with =,
            scheduled_range with &&
        )
        where (status = 'scheduled');
    end if;
end
$$;

create index if not exists appointments_provider_date_time_idx
on public.appointments (provider_id, date, time);

create index if not exists provider_time_off_range_idx
on public.provider_time_off
using gist (
    provider_id,
    tsrange(starts_at, ends_at, '[)')
);

create or replace function public.validate_appointment_schedule()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    provider_timezone text;
    local_start timestamp;
    local_end timestamp;
    current_provider_time timestamp;
begin
    if new.status = 'cancelled' then
        if tg_op = 'INSERT'
           or old.status is distinct from new.status then
            new.cancelled_at = now();
        end if;
    end if;

    if new.status = 'completed' then
        if tg_op = 'INSERT'
           or old.status is distinct from new.status then
            new.completed_at = now();
        end if;
    end if;

    if new.status = 'no_show' then
        if tg_op = 'INSERT'
           or old.status is distinct from new.status then
            new.no_show_at = now();
        end if;
    end if;

    if new.status <> 'scheduled' then
        return new;
    end if;

    select timezone
    into provider_timezone
    from public.providers
    where id = new.provider_id
      and active = true;

    if provider_timezone is null then
        raise exception using
            errcode = 'P0001',
            message = 'The selected provider is not available.';
    end if;

    local_start := new.date + new.time;
    local_end := local_start
        + make_interval(mins => new.duration_minutes);

    current_provider_time := timezone(provider_timezone, now());

    if local_start < current_provider_time + interval '2 hours' then
        raise exception using
            errcode = 'P0001',
            message = 'Appointments require at least two hours of advance notice.';
    end if;

    if local_start > current_provider_time + interval '90 days' then
        raise exception using
            errcode = 'P0001',
            message = 'Appointments cannot be booked more than 90 days in advance.';
    end if;

    if not exists (
        select 1
        from public.provider_availability availability
        where availability.provider_id = new.provider_id
          and availability.active = true
          and availability.day_of_week =
              extract(dow from new.date)::integer
          and local_start::time >= availability.start_time
          and local_end::date = new.date
          and local_end::time <= availability.end_time
    ) then
        raise exception using
            errcode = 'P0001',
            message = 'The selected time is outside the provider''s scheduling hours.';
    end if;

    if exists (
        select 1
        from public.provider_time_off time_off
        where time_off.provider_id = new.provider_id
          and tsrange(
                time_off.starts_at,
                time_off.ends_at,
                '[)'
              ) && tsrange(local_start, local_end, '[)')
    ) then
        raise exception using
            errcode = 'P0001',
            message = 'The provider is unavailable during the selected time.';
    end if;

    return new;
end
$$;

drop trigger if exists validate_appointment_schedule_trigger
on public.appointments;

create trigger validate_appointment_schedule_trigger
before insert or update
on public.appointments
for each row
execute function public.validate_appointment_schedule();

commit;
