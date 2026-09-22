-- ============================================================================
-- 0001_extensions_and_enums.sql
-- Extensions Postgres + types enumeres partages par tout le schema.
-- Convention §34 (architecture normalisee et relationnelle), §7 (systeme
-- educatif jamais code en dur), §28 (roles separes des profils).
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

create type user_role as enum ('owner', 'admin', 'manager', 'teacher', 'reader');

create type account_kind as enum ('individual_teacher', 'establishment');

create type subscription_status as enum ('trialing', 'active', 'past_due', 'canceled', 'expired');

create type content_origin as enum ('official', 'teacher', 'ai_generated');
-- Convention §6 (Regle de veracite) : toute donnee pedagogique importante doit
-- porter cette etiquette pour ne jamais confondre officiel / professeur / IA.

create type progression_status as enum ('planned', 'in_progress', 'done', 'late', 'ahead');

create type assessment_type as enum (
  'interrogation', 'controle', 'diagnostic', 'formative', 'sommative', 'composition'
);

create type document_kind as enum (
  'schedule_photo', 'grade_sheet', 'student_list', 'lesson_sheet', 'admin_document', 'other'
);

create type import_status as enum ('pending_review', 'validated', 'rejected');
-- Convention §22 / §56 : aucune donnee extraite automatiquement n'est integree
-- sans verification explicite du professeur.
