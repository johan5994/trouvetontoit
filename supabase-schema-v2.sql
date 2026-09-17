-- ============================================================
-- TROUVE TON TOIT — Schéma Supabase v2
-- Basé sur le schéma RestMalta (mêmes noms de tables/colonnes)
-- À coller dans SQL Editor > New query > Run
-- ⚠️  Supprime d'abord l'ancien schéma si déjà exécuté :
--     DROP SCHEMA public CASCADE; CREATE SCHEMA public;
-- ============================================================

create extension if not exists "uuid-ossp";
create extension if not exists "unaccent";

-- ============================================================
-- PROFILES
-- ============================================================
create table profiles (
  id            uuid primary key default uuid_generate_v4(),
  clerk_id      text unique not null,
  email         text,
  full_name     text,
  phone         text,
  avatar_url    text,
  role          text default 'tenant'
                check (role in ('tenant','landlord','agency','admin')),
  agency_id     uuid,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ============================================================
-- AGENCY_PROFILES
-- ============================================================
create table agency_profiles (
  id            uuid primary key default uuid_generate_v4(),
  clerk_id      text unique not null,
  agency_name   text,
  agent_count   int default 1,
  listing_count int default 0,
  plan          text default 'free',
  siret         text,
  numero_cpi    text,
  logo_url      text,
  phone         text,
  email         text,
  city          text,
  created_at    timestamptz default now()
);

-- ============================================================
-- LISTINGS
-- ============================================================
create table listings (
  id                        uuid primary key default uuid_generate_v4(),
  landlord_id               text,                  -- clerk_id du bailleur
  agent_id                  text,                  -- clerk_id de l'agent
  agency_name               text,
  agency_logo_url           text,
  agency_listing            boolean default false,
  title                     text not null,
  description               text,
  type                      text,                  -- appartement, maison, studio, chambre…
  zone                      text,                  -- ville / quartier
  full_address              text,
  price                     int,                   -- loyer mensuel HC (€)
  deposit                   int,                   -- dépôt de garantie
  sale_price                int,                   -- si vente
  sale_subscription_status  text,
  spots                     int default 1,
  baths                     int default 1,
  sqm                       int,
  floor                     int,
  furnished                 boolean default false,
  wifi                      boolean default false,
  bills_included            boolean default false,
  bills_situation           text,
  features                  jsonb default '[]',
  photos                    jsonb default '[]',
  video_url                 text,
  available_from            date,
  available_until           date,
  available_indefinitely    boolean default false,
  payment_due_day           int,
  notice_period             text,
  min_stay                  text,
  max_stay                  text,
  lease_duration            text,
  di_fermo                  text,
  wants_agent               boolean default false,
  agent_service             text,
  accepts_attestation       boolean default false,
  -- Champs vente
  tenure                    text,
  finish_status             text,
  epc_rating                text,
  service_charge            numeric(10,2),
  permit_number             text,
  sda                       boolean default false,
  -- Champs manuels agence
  manual_landlord_name      text,
  manual_landlord_email     text,
  manual_landlord_phone     text,
  manual_landlord_address   text,
  manual_landlord_nationality text,
  manual_landlord_passport  text,
  real_landlord_id          text,
  -- Boost
  boosted_until             timestamptz,
  -- Statut
  active                    boolean default true,
  status                    text default 'available'
                            check (status in ('available','reserved','rented','sold','archived')),
  created_at                timestamptz default now(),
  updated_at                timestamptz default now()
);

-- ============================================================
-- VISITS (demandes de visite)
-- ============================================================
create table visits (
  id                uuid primary key default uuid_generate_v4(),
  listing_id        uuid references listings(id),
  tenant_id         text not null,               -- clerk_id
  tenant_name       text,
  tenant_email      text,
  landlord_id       text,
  agent_id          text,
  zone              text,
  visit_date        date,
  visit_time        time,
  visit_type        text default 'in_person'
                    check (visit_type in ('in_person','video')),
  move_in_date      date,
  status            text default 'pending'
                    check (status in ('pending','confirmed','declined','cancelled','completed')),
  listing_price     int,
  parent_booking_id uuid,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- ============================================================
-- BOOKINGS (candidatures / dossiers acceptés)
-- ============================================================
create table bookings (
  id                          uuid primary key default uuid_generate_v4(),
  listing_id                  uuid references listings(id),
  tenant_id                   text not null,
  tenant_name                 text,
  tenant_email                text,
  landlord_id                 text,
  has_agent                   boolean default false,
  co_tenants_data             jsonb default '[]',
  co_tenant_ids               jsonb default '[]',
  monthly_rent                int,
  move_in_date                date,
  status                      text default 'pending'
                              check (status in ('pending','accepted','declined','cancelled','completed')),
  stripe_customer_id          text,
  commission_amount           int,
  commission_payment_intent_id text,
  total_amount                int,
  negotiation_note            text,
  requested_extras            jsonb,
  no_landlord_tracking        boolean default false,
  created_at                  timestamptz default now(),
  updated_at                  timestamptz default now()
);

-- ============================================================
-- LEASES (baux signés)
-- ============================================================
create table leases (
  id              uuid primary key default uuid_generate_v4(),
  listing_id      uuid references listings(id),
  listing_title   text,
  tenant_id       text not null,
  landlord_id     text not null,
  start_date      date,
  end_date        date,
  rent            int,
  deposit         int,
  status          text default 'active'
                  check (status in ('pending','active','ended','terminated')),
  docuseal_id     text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ============================================================
-- MESSAGES
-- ============================================================
create table messages (
  id              uuid primary key default uuid_generate_v4(),
  listing_id      uuid references listings(id),
  sender_id       text not null,
  receiver_id     text not null,
  thread_id       text,
  content         text not null,
  type            text default 'message',
  visit_id        uuid references visits(id),
  read            boolean default false,
  created_at      timestamptz default now()
);

-- ============================================================
-- PAYMENTS
-- ============================================================
create table payments (
  id              uuid primary key default uuid_generate_v4(),
  lease_id        uuid references leases(id),
  listing_id      uuid references listings(id),
  listing_title   text,
  tenant_id       text not null,
  tenant_name     text,
  tenant_email    text,
  landlord_id     text not null,
  amount          int not null,
  type            text default 'rent'
                  check (type in ('rent','deposit','commission','other')),
  status          text default 'pending'
                  check (status in ('pending','paid','late','partial','cancelled')),
  due_date        date,
  declared_at     timestamptz,
  created_at      timestamptz default now()
);

-- ============================================================
-- ESTIMATION_REQUESTS
-- ============================================================
create table estimation_requests (
  id              uuid primary key default uuid_generate_v4(),
  agency_id       text,
  landlord_id     text,
  landlord_name   text,
  landlord_email  text,
  request_type    text,
  status          text default 'pending',
  created_at      timestamptz default now()
);

-- ============================================================
-- CO_TENANTS
-- ============================================================
create table co_tenants (
  id              uuid primary key default uuid_generate_v4(),
  listing_id      uuid references listings(id),
  tenant_id       text,
  tenant_email    text,
  invited_by      text,
  status          text default 'pending',
  created_at      timestamptz default now()
);

-- ============================================================
-- REVIEWS
-- ============================================================
create table reviews (
  id              uuid primary key default uuid_generate_v4(),
  reviewer_id     text not null,
  target_id       text,
  landlord_id     text,
  tenant_id       text,
  rating          int check (rating between 1 and 5),
  type            text,
  comment         text,
  created_at      timestamptz default now()
);

-- ============================================================
-- TENANT_REFERENCES (attestations)
-- ============================================================
create table tenant_references (
  id              uuid primary key default uuid_generate_v4(),
  tenant_id       text not null,
  landlord_email  text,
  status          text default 'pending',
  created_at      timestamptz default now()
);

-- ============================================================
-- TICKETS (maintenance)
-- ============================================================
create table tickets (
  id              uuid primary key default uuid_generate_v4(),
  listing_id      uuid references listings(id),
  tenant_id       text not null,
  landlord_id     text,
  description     text,
  priority        text default 'normal',
  status          text default 'open',
  created_at      timestamptz default now()
);

-- ============================================================
-- INDEXES
-- ============================================================
create index idx_listings_active     on listings(active);
create index idx_listings_status     on listings(status);
create index idx_listings_zone       on listings(zone);
create index idx_listings_type       on listings(type);
create index idx_listings_landlord   on listings(landlord_id);
create index idx_visits_tenant       on visits(tenant_id);
create index idx_visits_listing      on visits(listing_id);
create index idx_bookings_tenant     on bookings(tenant_id);
create index idx_bookings_listing    on bookings(listing_id);
create index idx_messages_receiver   on messages(receiver_id, read);
create index idx_messages_sender     on messages(sender_id);
create index idx_payments_tenant     on payments(tenant_id);
create index idx_leases_tenant       on leases(tenant_id);

-- ============================================================
-- UPDATED_AT automatique
-- ============================================================
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger trg_profiles_upd   before update on profiles   for each row execute function set_updated_at();
create trigger trg_listings_upd   before update on listings   for each row execute function set_updated_at();
create trigger trg_visits_upd     before update on visits     for each row execute function set_updated_at();
create trigger trg_bookings_upd   before update on bookings   for each row execute function set_updated_at();
create trigger trg_leases_upd     before update on leases     for each row execute function set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY (désactivé pour simplifier — à activer en prod)
-- ============================================================
-- Pour l'instant on laisse ouvert via anon key + vérification clerk_id côté JS
-- Activer RLS plus tard avec : alter table listings enable row level security;

-- ============================================================
-- DONNÉES DE TEST
-- ============================================================
insert into listings (title, type, zone, price, deposit, spots, baths, sqm, furnished, active, status, description)
values
  ('Beau 3 pièces lumineux — Paris 11e', 'appartement', 'Paris 11e', 1250, 1250, 1, 1, 62, false, true, 'available', 'Appartement traversant au 3e étage, double exposition, parquet ancien, cuisine équipée.'),
  ('Studio meublé idéal étudiant — Lyon 1er', 'studio', 'Lyon 1er', 620, 620, 1, 1, 22, true, true, 'available', 'Studio refait à neuf, tout équipé, proche fac de médecine et transports.'),
  ('Maison 4 pièces avec jardin — Bordeaux', 'maison', 'Bordeaux Caudéran', 1450, 1450, 1, 2, 95, false, true, 'available', 'Belle maison de ville avec jardin privatif de 80m², garage, quartier calme.');
