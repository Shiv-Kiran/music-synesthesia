-- Qualia MVP schema

create table if not exists public.waitlist_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text,
  status text not null default 'pending',
  source text,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by_email text,
  invite_sent_at timestamptz
);

create table if not exists public.beta_invites (
  id uuid primary key default gen_random_uuid(),
  waitlist_signup_id uuid references public.waitlist_signups(id) on delete cascade,
  email text not null,
  invite_token_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  revoked_at timestamptz
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  client_session_id text not null,
  tester_email text,
  input_mode text,
  app_version text,
  fingerprint jsonb not null,
  mode text,
  timeline_count integer,
  duration_s double precision,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists sessions_client_session_id_idx on public.sessions(client_session_id);
create index if not exists sessions_ended_at_idx on public.sessions(ended_at);
