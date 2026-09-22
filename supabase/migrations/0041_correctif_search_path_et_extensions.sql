-- ============================================================================
-- 0041_correctif_search_path_et_extensions.sql
-- Correctif suite à l'audit de sécurité Supabase (22 septembre 2026) :
-- - search_path mutable sur 2 fonctions (expire_overdue_subscriptions,
--   generate_payment_reference)
-- - extensions citext et btree_gist installées dans le schéma public
-- Aucun changement de comportement applicatif.
-- ============================================================================

create or replace function public.expire_overdue_subscriptions()
returns void
language plpgsql
set search_path = public
as $function$
begin
  update subscriptions
  set status = 'expired'
  where status = 'active'
    and current_period_end is not null
    and current_period_end < now();
end;
$function$;

create or replace function public.generate_payment_reference()
returns text
language plpgsql
set search_path = public
as $function$
begin
  return 'PAY-' || to_char(now(), 'YYYYMM') || '-' || lpad(nextval('payment_submissions_reference_seq')::text, 5, '0');
end;
$function$;

create schema if not exists extensions;

alter extension citext set schema extensions;
alter extension btree_gist set schema extensions;

alter database postgres set search_path = public, extensions;
