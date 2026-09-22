-- ============================================================================
-- 0031_suivi_eleve_multi_annees.sql
-- Suite de la discussion "fin d'année scolaire" (22 août 2026, décision de
-- principe) : une nouvelle année scolaire = classes/élèves/notes reconstruits
-- à zéro (rien n'est copié automatiquement, un même professeur n'est pas
-- forcément reconduit sur les mêmes classes). Mais l'utilisateur veut garder
-- le suivi d'un élève sur plusieurs années.
--
-- `students` reste l'inscription d'un élève DANS une classe d'UNE année
-- scolaire précise (rien ne change ici, Convention §59 : jamais de
-- réécriture d'une table déjà en place sans raison forte). On ajoute une
-- fiche permanente séparée, `student_profiles`, qui représente l'élève
-- lui-même, indépendamment de l'année ou de la classe. Le lien entre les
-- deux est OPTIONNEL et JAMAIS automatique/silencieux (Convention §56 :
-- import -> analyse -> validation -> intégration) : soit le professeur
-- importe explicitement depuis une classe archivée (le lien se fait tout
-- seul, il retrouve la même fiche), soit il tape un nom à la main et rien
-- n'est lié tant qu'il n'a pas explicitement rattaché la ligne à une fiche
-- existante (fonctionnalité de rapprochement, pas dans cette migration —
-- l'import depuis l'archive suffit pour le cas d'usage principal).
-- ============================================================================

create table student_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  full_name text not null,
  student_number text,
  created_at timestamptz not null default now()
);

create index idx_student_profiles_org on student_profiles(organization_id);

alter table students
  add column student_profile_id uuid references student_profiles(id) on delete set null;

create index idx_students_profile on students(student_profile_id);

alter table student_profiles enable row level security;

create policy "student_profiles_all_org_members" on student_profiles for all
  using (is_org_member(organization_id))
  with check (is_org_member(organization_id));

comment on table student_profiles is
  'Fiche élève permanente, indépendante de l''année scolaire — permet de retrouver le même élève d''une année à l''autre malgré le changement de classe/professeur. `students` reste la seule source de vérité pour une inscription annuelle (notes, bulletins) ; cette table ne fait que relier plusieurs inscriptions au même élève réel.';
comment on column students.student_profile_id is
  'Lien optionnel vers la fiche permanente de l''élève (voir student_profiles). Rempli automatiquement lors d''un import "depuis une classe archivée" ; jamais deviné automatiquement pour une saisie manuelle ou un import de fichier classique.';

-- Import "depuis une classe archivée" (source = les élèves déjà en base
-- d'une classe passée, pas un fichier) : pas de fichier original à stocker
-- dans Storage, contrairement aux imports CSV/Excel/OCR existants — la
-- "source" ici est justement la classe archivée elle-même
-- (extracted_data.sourceClassId), qui reste consultable telle quelle dans
-- les Archives. `storage_path` devient donc nullable pour ce cas précis
-- uniquement ; les imports fichier/photo continuent de toujours le
-- renseigner (rien ne change côté existant, Convention §15).
alter table documents alter column storage_path drop not null;
