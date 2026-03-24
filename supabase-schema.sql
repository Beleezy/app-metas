-- ============================================================
-- Supabase Schema para Metas Diarias
-- Ejecutar en el SQL Editor del dashboard de Supabase
-- ============================================================

-- ── Tabla: goals ────────────────────────────────────────────
-- Almacena las metas/objetivos diarios de cada dispositivo.
-- device_id identifica cada navegador/dispositivo de forma anónima.
create table if not exists goals (
  id text not null,
  device_id text not null,
  name text not null,
  time text not null,           -- "HH:MM" formato 24h
  category text not null default 'otro',
  icon text not null default '🎯',
  created_at timestamptz not null default now(),
  primary key (id, device_id)
);

-- ── Tabla: completions ──────────────────────────────────────
-- Registra qué metas se completaron en qué fecha.
create table if not exists completions (
  id bigint generated always as identity primary key,
  device_id text not null,
  goal_id text not null,
  date text not null,           -- "YYYY-MM-DD"
  completed boolean not null default true,
  created_at timestamptz not null default now(),
  unique (device_id, goal_id, date)
);

-- ── Tabla: push_subscriptions ───────────────────────────────
-- Almacena las suscripciones Web Push para notificaciones.
create table if not exists push_subscriptions (
  id bigint generated always as identity primary key,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  goals jsonb not null default '[]',
  timezone text not null default 'UTC',
  device_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Índices ─────────────────────────────────────────────────
create index if not exists idx_goals_device on goals (device_id);
create index if not exists idx_completions_device_date on completions (device_id, date);
create index if not exists idx_push_subs_endpoint on push_subscriptions (endpoint);

-- ── RLS (Row Level Security) ────────────────────────────────
-- Para esta app pública sin auth, deshabilitamos RLS y usamos
-- service_role desde el servidor. Si en el futuro agregas
-- autenticación de usuarios, habilita RLS y agrega policies.
alter table goals enable row level security;
alter table completions enable row level security;
alter table push_subscriptions enable row level security;

-- Policies permisivas para acceso vía service_role (server-side)
-- El client-side NO accede directamente a Supabase; todo pasa por API routes
create policy "Service role full access" on goals
  for all using (true) with check (true);

create policy "Service role full access" on completions
  for all using (true) with check (true);

create policy "Service role full access" on push_subscriptions
  for all using (true) with check (true);
