-- ============================================================================
-- 0008_storage_documents.sql
-- Bucket de stockage prive pour les fichiers importes (listes d'eleves,
-- emplois du temps photographies, fiches de notes...). Convention §46 : pas
-- d'URLs publiques permanentes pour des documents contenant des donnees
-- d'eleves. Convention §26 : l'isolation ne doit pas reposer sur le frontend
-- seul -> RLS sur storage.objects, pas seulement sur la table `documents`.
--
-- Convention : chaque fichier est range sous le prefixe
--   {organization_id}/...
-- ce qui permet de restreindre l'acces objet par objet a partir du premier
-- segment du chemin, avec la meme fonction is_org_member() que le reste du
-- schema (0006_rls_policies.sql).
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "documents_bucket_select_org_members"
on storage.objects for select
using (
  bucket_id = 'documents'
  and is_org_member((storage.foldername(name))[1]::uuid)
);

create policy "documents_bucket_insert_org_members"
on storage.objects for insert
with check (
  bucket_id = 'documents'
  and is_org_member((storage.foldername(name))[1]::uuid)
);

create policy "documents_bucket_delete_org_members"
on storage.objects for delete
using (
  bucket_id = 'documents'
  and is_org_member((storage.foldername(name))[1]::uuid)
);
