-- ============================================================
-- TROUVE TON TOIT — Supabase Schema
-- Copiez-collez dans l'éditeur SQL de votre projet Supabase
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "unaccent";

-- ============================================================
-- PROFILES (utilisateurs — locataires, bailleurs, agents)
-- ============================================================
create table profiles (
  id            uuid primary key default uuid_generate_v4(),
  clerk_id      text unique not null,
  email         text unique not null,
  prenom        text,
  nom           text,
  telephone     text,
  avatar_url    text,
  role          text not null default 'locataire'
                check (role in ('locataire','bailleur','agent','admin')),
  agence_id     uuid,                         -- rempli si role = agent
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- ============================================================
-- AGENCIES
-- ============================================================
create table agencies (
  id                    uuid primary key default uuid_generate_v4(),
  nom                   text not null,
  siret                 text unique,
  numero_cpi            text,                 -- carte professionnelle immobilier
  garantie_financiere   text,                 -- organisme garant
  rcp_assureur          text,                 -- assurance RCP
  adresse               text,
  ville                 text,
  code_postal           text,
  telephone             text,
  email                 text,
  site_web              text,
  logo_url              text,
  proprietaire_id       uuid references profiles(id),
  created_at            timestamptz default now()
);

-- FK agence sur profiles
alter table profiles
  add constraint fk_profiles_agence
  foreign key (agence_id) references agencies(id);

-- ============================================================
-- LISTINGS (annonces)
-- ============================================================
create table listings (
  id                      uuid primary key default uuid_generate_v4(),

  -- Propriétaire / agence
  proprietaire_id         uuid references profiles(id),
  agence_id               uuid references agencies(id),

  -- Localisation
  titre                   text not null,
  description             text,
  adresse                 text,
  ville                   text not null,
  code_postal             text not null,
  departement             text,
  latitude                numeric(9,6),
  longitude               numeric(9,6),

  -- Caractéristiques
  type_bien               text not null
                          check (type_bien in ('appartement','maison','studio','chambre','loft','duplex','villa')),
  type_bail               text not null default 'vide'
                          check (type_bail in ('vide','meuble','mobilite','etudiant','commercial')),
  surface_m2              numeric(7,2) not null,
  nb_pieces               int,
  nb_chambres             int,
  nb_sdb                  int,
  etage                   int,
  nb_etages_immeuble      int,
  ascenseur               boolean default false,
  meuble                  boolean default false,
  parking                 boolean default false,
  cave                    boolean default false,
  balcon                  boolean default false,
  terrasse                boolean default false,

  -- Financier
  loyer_hc                numeric(10,2) not null,   -- hors charges
  charges                 numeric(10,2) default 0,
  depot_garantie          numeric(10,2),
  honoraires_locataire    numeric(10,2),             -- calculé loi Alur

  -- Encadrement des loyers (Paris, Lille, Lyon…)
  zone_encadrement        boolean default false,
  loyer_reference         numeric(10,2),             -- loyer de référence
  loyer_reference_majore  numeric(10,2),             -- × 1.2
  complement_loyer        numeric(10,2) default 0,
  complement_loyer_motif  text,

  -- DPE / GES (loi Climat 2021)
  dpe_classe              char(1) check (dpe_classe in ('A','B','C','D','E','F','G')),
  dpe_valeur_kwh          numeric(7,2),              -- kWh/m²/an
  ges_classe              char(1) check (ges_classe in ('A','B','C','D','E','F','G')),
  ges_valeur_co2          numeric(7,2),              -- kgCO2/m²/an

  -- IRL référence pour révision
  irl_reference_valeur    numeric(8,2),
  irl_reference_trimestre text,                      -- ex: "T1 2024"

  -- Disponibilité
  disponible_le           date,
  duree_bail_mois         int,                       -- pour bail mobilité

  -- Médias
  photos                  jsonb default '[]',        -- [{url, ordre, caption}]

  -- Statut
  statut                  text not null default 'brouillon'
                          check (statut in ('brouillon','publie','loue','archive')),

  created_at              timestamptz default now(),
  updated_at              timestamptz default now()
);

-- ============================================================
-- DOSSIERS (candidatures locataires)
-- ============================================================
create table dossiers (
  id                  uuid primary key default uuid_generate_v4(),
  candidat_id         uuid references profiles(id) not null,
  listing_id          uuid references listings(id),

  -- Situation professionnelle
  type_situation      text check (type_situation in (
                        'cdi','cdd','fonctionnaire','independant',
                        'etudiant','retraite','sans_emploi','intermittent'
                      )),
  employeur           text,
  poste               text,
  anciennete_mois     int,

  -- Revenus
  revenus_mensuels_net  numeric(10,2),
  revenus_annuels_net   numeric(10,2),
  ratio_loyer           numeric(5,2),             -- revenus / loyer (doit être ≥ 3)

  -- Logement actuel
  situation_actuelle  text check (situation_actuelle in (
                        'locataire','proprietaire','heberge','autre'
                      )),
  loyer_actuel        numeric(10,2),
  duree_residence_mois int,

  -- Garant
  has_garant          boolean default false,
  garant_type         text check (garant_type in ('physique','visale','garantme','autre')),
  garant_revenus      numeric(10,2),

  -- Visale
  visale_eligible     boolean default false,
  visale_numero       text,

  -- Score automatique (0-100)
  score               int check (score between 0 and 100),
  score_detail        jsonb default '{}',        -- détail des critères

  -- Statut
  statut              text not null default 'en_cours'
                      check (statut in ('en_cours','soumis','accepte','refuse','en_attente')),
  notes_agence        text,
  raison_refus        text,

  -- Lien partageable (style DossierFacile)
  token_partage       uuid default uuid_generate_v4() unique,
  partage_actif       boolean default false,

  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- ============================================================
-- DOSSIER_DOCUMENTS
-- ============================================================
create table dossier_documents (
  id          uuid primary key default uuid_generate_v4(),
  dossier_id  uuid references dossiers(id) on delete cascade not null,
  type        text not null check (type in (
                'cni','passeport','titre_sejour',
                'bulletin_salaire_1','bulletin_salaire_2','bulletin_salaire_3',
                'avis_imposition','contrat_travail','attestation_employeur',
                'justif_domicile','quittances_loyer',
                'extrait_kbis','bilan_comptable',
                'carte_etudiant','certificat_scolarite',
                'justif_retraite','attestation_caf',
                'garant_cni','garant_bulletins','garant_avis_imposition',
                'autre'
              )),
  nom_fichier text,
  url         text not null,                     -- Supabase Storage URL
  taille_kb   int,
  verifie     boolean default false,
  created_at  timestamptz default now()
);

-- ============================================================
-- PLAGES DE VISITE (créées par l'agence)
-- ============================================================
create table plages_visite (
  id                  uuid primary key default uuid_generate_v4(),
  listing_id          uuid references listings(id) not null,
  agence_id           uuid references agencies(id),
  agent_id            uuid references profiles(id),

  date_visite         date not null,
  heure_debut         time not null,
  heure_fin           time not null,
  duree_slot_minutes  int not null default 30
                      check (duree_slot_minutes in (15,30,45,60)),
  places_par_slot     int not null default 1,
  pause_debut         time,
  pause_fin           time,

  notes               text,
  statut              text not null default 'actif'
                      check (statut in ('actif','annule','termine')),

  created_at          timestamptz default now()
);

-- ============================================================
-- VISITES (demandes de candidats sur une plage)
-- ============================================================
create table visites (
  id                  uuid primary key default uuid_generate_v4(),
  plage_id            uuid references plages_visite(id) not null,
  listing_id          uuid references listings(id) not null,
  candidat_id         uuid references profiles(id) not null,

  heure_slot          time not null,
  statut              text not null default 'en_attente'
                      check (statut in ('en_attente','confirme','refuse','annule','effectue')),

  message_candidat    text,
  situation_pro       text,
  dossier_id          uuid references dossiers(id),   -- dossier soumis avec la demande

  -- Rappels email
  rappel_24h_envoye   boolean default false,
  rappel_1h_envoye    boolean default false,

  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

-- ============================================================
-- BAUX (contrats de location signés)
-- ============================================================
create table baux (
  id                      uuid primary key default uuid_generate_v4(),
  listing_id              uuid references listings(id) not null,
  locataire_id            uuid references profiles(id) not null,
  bailleur_id             uuid references profiles(id),
  agence_id               uuid references agencies(id),

  type_bail               text not null
                          check (type_bail in ('vide','meuble','mobilite','etudiant','commercial')),
  date_debut              date not null,
  date_fin                date,                        -- null = durée indéterminée

  -- Financier
  loyer_hc                numeric(10,2) not null,
  charges                 numeric(10,2) default 0,
  depot_garantie          numeric(10,2),
  depot_garantie_verse    boolean default false,
  depot_garantie_date     date,

  -- Encadrement
  loyer_reference         numeric(10,2),
  complement_loyer        numeric(10,2) default 0,

  -- IRL révision
  irl_reference_valeur    numeric(8,2),
  irl_reference_trimestre text,
  derniere_revision_date  date,

  -- Préavis
  preavis_mois            int,                         -- 1 ou 3 mois selon bail

  -- DocuSeal e-signature
  docuseal_submission_id  text,
  docuseal_statut         text check (docuseal_statut in ('brouillon','envoye','signe','refuse')),
  contrat_pdf_url         text,

  statut                  text not null default 'actif'
                          check (statut in ('en_attente','actif','preavis','termine','resilie')),

  notes                   text,
  created_at              timestamptz default now(),
  updated_at              timestamptz default now()
);

-- ============================================================
-- QUITTANCES DE LOYER (art. 21 loi 6 juillet 1989)
-- ============================================================
create table quittances (
  id              uuid primary key default uuid_generate_v4(),
  bail_id         uuid references baux(id) not null,
  locataire_id    uuid references profiles(id) not null,

  mois            text not null,                       -- "2024-10"
  loyer_hc        numeric(10,2) not null,
  charges         numeric(10,2) default 0,
  total           numeric(10,2) not null,

  date_paiement   date,
  statut          text not null default 'en_attente'
                  check (statut in ('en_attente','payee','en_retard','partielle')),

  pdf_url         text,                                -- Supabase Storage
  envoye_le       timestamptz,
  created_at      timestamptz default now()
);

-- ============================================================
-- PAIEMENTS (Stripe)
-- ============================================================
create table paiements (
  id                        uuid primary key default uuid_generate_v4(),
  bail_id                   uuid references baux(id),
  quittance_id              uuid references quittances(id),
  payer_id                  uuid references profiles(id) not null,

  montant                   numeric(10,2) not null,
  type                      text not null
                            check (type in ('loyer','depot_garantie','honoraires','caution')),

  stripe_payment_intent_id  text unique,
  stripe_charge_id          text,
  statut                    text not null default 'en_attente'
                            check (statut in ('en_attente','capture','echoue','rembourse','annule')),

  created_at                timestamptz default now()
);

-- ============================================================
-- MESSAGES
-- ============================================================
create table messages (
  id              uuid primary key default uuid_generate_v4(),
  expediteur_id   uuid references profiles(id) not null,
  destinataire_id uuid references profiles(id) not null,
  listing_id      uuid references listings(id),
  bail_id         uuid references baux(id),

  contenu         text not null,
  lu              boolean default false,
  lu_le           timestamptz,

  created_at      timestamptz default now()
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
create table notifications (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references profiles(id) not null,
  type        text not null,                           -- 'visite_confirmee', 'dossier_accepte', etc.
  titre       text not null,
  message     text,
  lien        text,
  lu          boolean default false,
  created_at  timestamptz default now()
);

-- ============================================================
-- INDEXES
-- ============================================================
create index idx_listings_ville          on listings(ville);
create index idx_listings_statut         on listings(statut);
create index idx_listings_type_bail      on listings(type_bail);
create index idx_listings_dpe            on listings(dpe_classe);
create index idx_listings_agence         on listings(agence_id);
create index idx_dossiers_candidat       on dossiers(candidat_id);
create index idx_dossiers_listing        on dossiers(listing_id);
create index idx_dossiers_token          on dossiers(token_partage);
create index idx_visites_plage           on visites(plage_id);
create index idx_visites_candidat        on visites(candidat_id);
create index idx_visites_statut          on visites(statut);
create index idx_baux_locataire          on baux(locataire_id);
create index idx_baux_statut             on baux(statut);
create index idx_quittances_bail         on quittances(bail_id);
create index idx_quittances_mois         on quittances(mois);
create index idx_paiements_stripe        on paiements(stripe_payment_intent_id);
create index idx_messages_destinataire   on messages(destinataire_id, lu);
create index idx_notifications_user      on notifications(user_id, lu);

-- ============================================================
-- UPDATED_AT automatique
-- ============================================================
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at
  before update on profiles
  for each row execute function set_updated_at();

create trigger trg_listings_updated_at
  before update on listings
  for each row execute function set_updated_at();

create trigger trg_dossiers_updated_at
  before update on dossiers
  for each row execute function set_updated_at();

create trigger trg_visites_updated_at
  before update on visites
  for each row execute function set_updated_at();

create trigger trg_baux_updated_at
  before update on baux
  for each row execute function set_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table profiles          enable row level security;
alter table agencies          enable row level security;
alter table listings          enable row level security;
alter table dossiers          enable row level security;
alter table dossier_documents enable row level security;
alter table plages_visite     enable row level security;
alter table visites           enable row level security;
alter table baux              enable row level security;
alter table quittances        enable row level security;
alter table paiements         enable row level security;
alter table messages          enable row level security;
alter table notifications     enable row level security;

-- Profiles : chacun voit et modifie le sien
create policy "profile_own" on profiles
  for all using (clerk_id = current_setting('app.clerk_id', true));

-- Listings : publics en lecture, agence/proprio en écriture
create policy "listings_read_public" on listings
  for select using (statut = 'publie');

create policy "listings_write_own" on listings
  for all using (
    proprietaire_id = (select id from profiles where clerk_id = current_setting('app.clerk_id', true))
    or agence_id in (
      select agence_id from profiles where clerk_id = current_setting('app.clerk_id', true)
    )
  );

-- Dossiers : candidat voit les siens, agence voit ceux liés à ses annonces
create policy "dossiers_own" on dossiers
  for all using (
    candidat_id = (select id from profiles where clerk_id = current_setting('app.clerk_id', true))
  );

-- Dossier partagé via token (lecture seule publique)
create policy "dossiers_token_read" on dossiers
  for select using (partage_actif = true);

-- Visites : candidat voit les siennes, agent voit celles de ses listings
create policy "visites_candidat" on visites
  for all using (
    candidat_id = (select id from profiles where clerk_id = current_setting('app.clerk_id', true))
  );

-- Baux : locataire et bailleur voient les leurs
create policy "baux_parties" on baux
  for all using (
    locataire_id = (select id from profiles where clerk_id = current_setting('app.clerk_id', true))
    or bailleur_id = (select id from profiles where clerk_id = current_setting('app.clerk_id', true))
  );

-- Quittances : locataire voit les siennes
create policy "quittances_locataire" on quittances
  for all using (
    locataire_id = (select id from profiles where clerk_id = current_setting('app.clerk_id', true))
  );

-- Messages : expéditeur et destinataire
create policy "messages_parties" on messages
  for all using (
    expediteur_id   = (select id from profiles where clerk_id = current_setting('app.clerk_id', true))
    or destinataire_id = (select id from profiles where clerk_id = current_setting('app.clerk_id', true))
  );

-- Notifications : propriétaire uniquement
create policy "notifications_own" on notifications
  for all using (
    user_id = (select id from profiles where clerk_id = current_setting('app.clerk_id', true))
  );

-- ============================================================
-- DONNÉES DE TEST (commentez avant mise en prod)
-- ============================================================

-- Agence test
insert into agencies (id, nom, siret, numero_cpi, ville, code_postal, telephone, email)
values (
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Agence Dupont Immobilier',
  '12345678900012',
  'CPI 7501 2023 000 012345',
  'Paris',
  '75011',
  '+33 1 42 00 00 00',
  'contact@dupont-immo.fr'
);

-- Annonces test
insert into listings (
  agence_id, titre, ville, code_postal, departement,
  type_bien, type_bail, surface_m2, nb_pieces, nb_chambres,
  loyer_hc, charges, depot_garantie,
  dpe_classe, ges_classe,
  zone_encadrement, loyer_reference, loyer_reference_majore,
  irl_reference_valeur, irl_reference_trimestre,
  statut, disponible_le, meuble
) values
(
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Beau 3 pièces lumineux — Paris 11e',
  'Paris', '75011', '75',
  'appartement', 'vide', 62, 3, 2,
  1250, 80, 1250,
  'C', 'B',
  true, 14.47, 17.36,
  143.46, 'T1 2024',
  'publie', '2024-11-01', false
),
(
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Studio meublé idéal étudiant — Lyon 1er',
  'Lyon', '69001', '69',
  'studio', 'meuble', 22, 1, 0,
  620, 40, 620,
  'D', 'C',
  true, 13.20, 15.84,
  143.46, 'T1 2024',
  'publie', '2024-10-15', true
),
(
  'aaaaaaaa-0000-0000-0000-000000000001',
  'Maison 4 pièces avec jardin — Bordeaux',
  'Bordeaux', '33000', '33',
  'maison', 'vide', 95, 4, 3,
  1450, 0, 1450,
  'E', 'D',
  false, null, null,
  143.46, 'T1 2024',
  'publie', '2024-11-15', false
);

-- ============================================================
-- STORAGE BUCKETS (à créer dans le dashboard Supabase)
-- ============================================================
-- Storage > New bucket :
--   • "photos-listings"     → public  ✓
--   • "documents-dossiers"  → private (RLS)
--   • "contrats-baux"       → private (RLS)
--   • "quittances-pdf"      → private (RLS)
