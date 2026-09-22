-- ============================================================================
-- 0005_documents_abonnements_audit.sql
-- Documents importes (§14-16, §56), abonnements/licences (§33), audit (§30).
-- ============================================================================

-- L'original n'est jamais detruit/remplace (§15) : on stocke le fichier
-- (Supabase Storage) + les donnees extraites separement, avec un statut de
-- validation obligatoire avant integration (§22/§56).
create table documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id),
  kind document_kind not null,
  storage_path text not null,              -- chemin prive dans Supabase Storage
  extracted_data jsonb,                    -- resultat OCR/extraction brut
  confidence numeric(4,3),                 -- niveau de confiance si disponible
  status import_status not null default 'pending_review',
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Abonnements (§33) : professeur individuel OU etablissement + licences.
create table plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,               -- 'individual_monthly', 'establishment_tier1', ...
  name text not null,
  seats int,                               -- nombre de licences incluses (null = illimite/individuel)
  price_minor_units bigint not null,       -- montant en plus petite unite monetaire (jamais de float, §32)
  currency text not null default 'XOF',
  billing_period text not null default 'monthly' -- 'monthly' | 'yearly'
);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  plan_id uuid not null references plans(id),
  status subscription_status not null default 'trialing',
  seats_used int not null default 0,
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz,
  provider text,                           -- 'cinetpay', 'manual', ...
  provider_reference text,
  created_at timestamptz not null default now()
);

-- Journal d'audit (§30/§67) : actions sensibles tracees.
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade,
  actor_id uuid references auth.users(id),
  action text not null,                    -- 'result.update', 'student.delete', 'role.change', ...
  entity_table text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index idx_documents_org on documents(organization_id, status);
create index idx_audit_org on audit_logs(organization_id, created_at desc);
