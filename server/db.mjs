import pg from "pg";

const { Pool } = pg;

export function createPool() {
  return new Pool({
    connectionString:
      process.env.DATABASE_URL ||
      `postgres://${process.env.POSTGRES_USER || "hairbook"}:${process.env.POSTGRES_PASSWORD || "hairbook"}@${process.env.POSTGRES_HOST || "localhost"}:${process.env.POSTGRES_PORT || "5432"}/${process.env.POSTGRES_DB || "hairbook"}`,
    max: Number(process.env.POSTGRES_POOL_SIZE || 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });
}

export async function waitForDatabase(pool, attempts = 40) {
  let lastError;

  for (let index = 0; index < attempts; index += 1) {
    try {
      await pool.query("select 1");
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 750));
    }
  }

  throw lastError;
}

export async function migrateDatabase(pool) {
  await pool.query(`
    create extension if not exists pgcrypto;
    create extension if not exists btree_gist;

    create table if not exists users (
      id text primary key,
      role text not null check (role in ('admin', 'barber', 'client')),
      name text not null,
      email text not null unique,
      password_hash text not null,
      created_at timestamptz not null default now()
    );

    create table if not exists sessions (
      token_hash text primary key,
      user_id text not null references users(id) on delete cascade,
      expires_at timestamptz not null,
      created_at timestamptz not null default now()
    );

    create table if not exists salon (
      id text primary key,
      name text not null,
      city text not null,
      address text not null,
      phone text not null,
      email text not null,
      plan text not null,
      rating numeric(3,2) not null default 0,
      review_count integer not null default 0,
      open_hour integer not null check (open_hour between 0 and 23),
      close_hour integer not null check (close_hour between 1 and 24),
      slot_step integer not null check (slot_step in (15, 30, 45, 60)),
      onboarding jsonb not null default '{}'::jsonb,
      constraint salon_hours_valid check (close_hour > open_hour)
    );

    create table if not exists staff (
      id text primary key,
      user_id text unique references users(id) on delete set null,
      name text not null,
      title text not null,
      specialty text not null,
      active boolean not null default true,
      work_days jsonb not null default '[]'::jsonb,
      color text not null default '#0f766e'
    );

    create table if not exists clients (
      id text primary key,
      user_id text unique references users(id) on delete set null,
      name text not null,
      phone text not null default '',
      email text,
      notes text not null default '',
      tags jsonb not null default '[]'::jsonb,
      last_visit timestamptz
    );

    create table if not exists services (
      id text primary key,
      name text not null,
      category text not null,
      duration integer not null check (duration > 0),
      price integer not null check (price >= 0),
      active boolean not null default true,
      description text not null default ''
    );

    create table if not exists bookings (
      id text primary key,
      client_id text not null references clients(id) on delete restrict,
      barber_id text not null references staff(id) on delete restrict,
      service_id text not null references services(id) on delete restrict,
      starts_at timestamptz not null,
      ends_at timestamptz not null,
      status text not null check (status in ('confirmed', 'completed', 'cancelled')),
      source text not null default 'frontdesk',
      notes text not null default '',
      created_at timestamptz not null default now(),
      updated_at timestamptz,
      constraint bookings_time_valid check (ends_at > starts_at)
    );

    create table if not exists time_off (
      id text primary key,
      staff_id text not null references staff(id) on delete cascade,
      starts_at timestamptz not null,
      ends_at timestamptz not null,
      reason text not null default '',
      created_at timestamptz not null default now(),
      constraint time_off_time_valid check (ends_at > starts_at)
    );

    create index if not exists time_off_staff_starts_idx on time_off (staff_id, starts_at);

    create table if not exists notifications (
      id text primary key,
      type text not null,
      title text not null,
      message text not null,
      user_id text references users(id) on delete cascade,
      created_at timestamptz not null default now(),
      read boolean not null default false
    );

    alter table notifications
      add column if not exists user_id text references users(id) on delete cascade;

    create index if not exists notifications_user_idx on notifications (user_id, created_at desc);
    create index if not exists sessions_expires_at_idx on sessions (expires_at);
    create index if not exists staff_user_id_idx on staff (user_id);
    create index if not exists clients_user_id_idx on clients (user_id);
    create index if not exists bookings_client_id_idx on bookings (client_id);
    create index if not exists bookings_service_id_idx on bookings (service_id);
    create index if not exists bookings_barber_starts_idx on bookings (barber_id, starts_at);
    create index if not exists bookings_active_starts_idx on bookings (starts_at)
      where status <> 'cancelled';
    create index if not exists notifications_unread_idx on notifications (created_at desc)
      where read = false;

    do $$
    begin
      if not exists (
        select 1
        from pg_constraint
        where conname = 'bookings_no_overlap_active'
        and conrelid = 'bookings'::regclass
      ) then
        alter table bookings
          add constraint bookings_no_overlap_active
          exclude using gist (
            barber_id with =,
            tstzrange(starts_at, ends_at, '[)') with &&
          )
          where (status <> 'cancelled');
      end if;
    end $$;

    do $$
    begin
      if not exists (
        select 1
        from pg_constraint
        where conname = 'time_off_no_overlap'
        and conrelid = 'time_off'::regclass
      ) then
        alter table time_off
          add constraint time_off_no_overlap
          exclude using gist (
            staff_id with =,
            tstzrange(starts_at, ends_at, '[)') with &&
          );
      end if;
    end $$;
  `);
}
