-- ============================================================================
-- 0010_generation_ia.sql
-- EF-EVAL-02 : génération IA de contenu (cours, exercices, devoirs,
-- interrogations/contrôles/compositions, corrigés) + assistant IA global en
-- langage naturel (PRD §51-55, Convention §17-19 et §52-56).
--
-- Convention §6/§58 : ne casse rien de l'existant — ajout de colonnes avec
-- valeur par défaut et d'une nouvelle table, aucune table ni contrainte
-- existante modifiée en profondeur.
-- ============================================================================

-- `lessons` servait jusqu'ici uniquement de bibliothèque de "cours". Le PRD
-- (§17) demande aussi des devoirs et des fiches de corrigé autonomes : on
-- distingue via `kind` plutôt que de créer 3 tables quasi identiques
-- (content jsonb, origin, version déjà partagés). Défaut 'cours' : aucune
-- ligne existante ne change de sens.
create type lesson_kind as enum ('cours', 'devoir', 'fiche_corrige');

alter table lessons add column kind lesson_kind not null default 'cours';

-- Historique de l'assistant IA global (PRD §51 : "Prépare mon cours de
-- demain pour ma 3e A."). Convention §24 : toute intervention de l'IA doit
-- rester traçable — on garde donc la conversation, organisation par
-- organisation, pas seulement le résultat final.
create table assistant_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  -- intent détecté, ids créés/consultés, etc. — traçabilité de ce que
  -- l'assistant a compris et fait, jamais une donnée métier à part entière.
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index idx_assistant_messages_org on assistant_messages(organization_id, created_at);

alter table assistant_messages enable row level security;

create policy "assistant_messages_org_members" on assistant_messages for all
  using (is_org_member(organization_id)) with check (is_org_member(organization_id));
