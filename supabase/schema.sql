-- Fleetwise - execute este arquivo no SQL Editor do Supabase.
-- A chave anon/public nao ignora RLS. As tabelas permanecem privadas ate que
-- politicas apropriadas para a autenticacao da sua organizacao sejam criadas.

begin;

create table if not exists public.motoristas (
  id text primary key,
  "name" text not null,
  "category" text not null check ("category" in ('A', 'B', 'C', 'D', 'E', 'AB', 'AC', 'AD', 'AE')),
  "licenseExpiry" date not null,
  "phone" text not null,
  "status" text not null default 'Ativo' check ("status" in ('Ativo', 'Inativo')),
  created_at timestamptz not null default now()
);

create table if not exists public.veiculos (
  id text primary key,
  "plate" text not null unique,
  "model" text not null,
  "type" text not null check ("type" in ('Van', 'Caminhão', 'Pickup', 'Carro', 'Ônibus')),
  "year" integer not null check ("year" between 1980 and 2100),
  "km" bigint not null default 0 check ("km" >= 0),
  "driverId" text,
  "status" text not null default 'Disponível' check ("status" in ('Disponível', 'Em rota', 'Manutenção')),
  created_at timestamptz not null default now()
);

create table if not exists public.manutencoes (
  id text primary key,
  "vehicleId" text not null references public.veiculos(id) on delete cascade,
  "kind" text not null check ("kind" in ('Preventiva', 'Corretiva')),
  "date" date not null,
  "description" text not null,
  "parts" text not null default '',
  "cost" numeric(12, 2) not null default 0 check ("cost" >= 0),
  "nextKm" bigint not null check ("nextKm" >= 0),
  "kmAtService" bigint not null check ("kmAtService" >= 0),
  "status" text not null default 'Em andamento' check ("status" in ('Em andamento', 'Concluída')),
  created_at timestamptz not null default now()
);

create table if not exists public.abastecimentos (
  id text primary key,
  "vehicleId" text not null references public.veiculos(id) on delete cascade,
  "date" date not null,
  "liters" numeric(10, 2) not null check ("liters" > 0),
  "total" numeric(12, 2) not null check ("total" >= 0),
  "station" text not null,
  "km" bigint not null check ("km" >= 0),
  "average" numeric(8, 2) not null default 0 check ("average" >= 0),
  created_at timestamptz not null default now()
);

create index if not exists manutencoes_vehicle_date_idx
  on public.manutencoes ("vehicleId", "date" desc);

create index if not exists abastecimentos_vehicle_date_idx
  on public.abastecimentos ("vehicleId", "date" desc);

create index if not exists abastecimentos_date_idx
  on public.abastecimentos ("date" desc);

alter table public.motoristas enable row level security;
alter table public.veiculos enable row level security;
alter table public.manutencoes enable row level security;
alter table public.abastecimentos enable row level security;

comment on table public.motoristas is 'Motoristas cadastrados na frota Fleetwise.';
comment on table public.veiculos is 'Veiculos cadastrados na frota Fleetwise.';
comment on table public.manutencoes is 'Ordens preventivas e corretivas da frota.';
comment on table public.abastecimentos is 'Registros de abastecimento e consumo.';

commit;
