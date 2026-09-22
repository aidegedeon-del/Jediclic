# JedicliC — Security Hardening Report

## Corrections appliquées

### 1. Rôles, invitations et abonnements
- `0036_durcissement_roles_invitations.sql` verrouille les changements de rôle et d'invitations via RPC transactionnelles.
- Les écritures directes client sur `organization_members`, `invitations` et `subscriptions` sensibles sont supprimées.
- Les fonctions d'administration vérifient l'organisation et la hiérarchie de rôles.

### 2. Isolation multi-tenant et RLS
- `0037_durcissement_rls_multitenant.sql` remplace les policies pédagogiques permissives issues des anciens `FOR ALL` par des policies séparées `SELECT/INSERT/UPDATE/DELETE`.
- Les `WITH CHECK` empêchent le changement d'organisation, de classe, de professeur ou de relation métier vers une ressource non autorisée.
- Les résultats exigent une correspondance assessment ↔ student ↔ class ↔ organization.
- Les bulletins, remédiations et recommandations IA contrôlent également les relations entre classe et élève.

### 3. Intégrité DB
- Ajout de helpers de vérification de rattachement.
- Ajout de triggers DB de cohérence multi-tenant sur les principales tables pédagogiques.
- Une incohérence organisation/classe/élève/évaluation/résultat est refusée même si un futur bug applicatif survient.

### 4. Disciplines gratuites
- Suppression de l'INSERT direct `teacher_discipline_grants`.
- Ajout de `grant_free_teacher_discipline()` avec verrou transactionnel et limite réelle de 2 disciplines gratuites par compte et organisation.
- `src/lib/subscriptions/disciplines.ts` utilise désormais cette RPC.

### 5. Onboarding
- Suppression de l'INSERT direct ouvert sur `organizations`.
- Ajout de `complete_onboarding()` : organisation + établissement + owner + profil dans une transaction DB.
- `src/app/(onboarding)/onboarding/actions.ts` utilise désormais cette RPC.

### 6. Fonctions SECURITY DEFINER
- Réduction de l'exécution publique des helpers existants.
- `search_path = public` maintenu sur les fonctions sensibles.

## Vérifications statiques
- Recherche des écritures client directes sur `organization_members`, `subscriptions` et invitations sensibles.
- Vérification que les nouvelles actions utilisent les RPC.
- Vérification que les migrations 0036 et 0037 sont dans l'ordre et ne modifient pas les migrations historiques.

## Limitation
Le build et les tests DB d'exécution doivent être lancés dans un environnement disposant des dépendances Node/Supabase. Dans cet environnement, `npm ci` a dépassé le délai disponible ; aucun succès de build n'est déclaré sans commande réellement exécutée avec code 0.
