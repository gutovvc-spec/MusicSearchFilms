create table if not exists public.veiculos (
  id text primary key,
  "plate" text not null unique,
  "model" text not null,
  "type" text not null,
  "year" integer not null,
  "km" bigint not null default 0,
  "driverId" text,
  "status" text not null default 'Disponível',
  created_at timestamptz not null default now()
);

create table if not exists public.motoristas (
  id text primary key,
  "name" text not null,
  "category" text not null,
  "licenseExpiry" date not null,
  "phone" text not null,
  "status" text not null default 'Ativo',
  created_at timestamptz not null default now()
);

create table if not exists public.manutencoes (
  id text primary key,
  "vehicleId" text not null references public.veiculos(id) on delete cascade,
  "kind" text not null,
  "date" date not null,
  "description" text not null,
  "parts" text not null default '',
  "cost" numeric(12, 2) not null default 0,
  "nextKm" bigint not null,
  "kmAtService" bigint not null,
  "status" text not null default 'Em andamento',
  created_at timestamptz not null default now()
);

create table if not exists public.abastecimentos (
  id text primary key,
  "vehicleId" text not null references public.veiculos(id) on delete cascade,
  "date" date not null,
  "liters" numeric(10, 2) not null,
  "total" numeric(12, 2) not null,
  "station" text not null,
  "km" bigint not null,
  "average" numeric(8, 2) not null default 0,
  created_at timestamptz not null default now()
);

alter table public.veiculos enable row level security;
alter table public.motoristas enable row level security;
alter table public.manutencoes enable row level security;
alter table public.abastecimentos enable row level security;
