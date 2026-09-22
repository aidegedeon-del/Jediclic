# Audit performance — JedicliC

Date : 4 septembre 2026

## Optimisations appliquées

### 1. Chargements serveur parallélisés
- Dashboard principal : calendrier, créneaux du jour et calcul de progression sont lancés en parallèle une fois l'année scolaire connue.
- Layout dashboard : invitations en attente et rappel d'abonnement sont lancés en parallèle.

### 2. Déduplication par requête
- `requireCurrentOrg()` est enveloppé avec `cache()` de React pour éviter plusieurs résolutions identiques du contexte organisation/utilisateur pendant une même requête serveur.

### 3. Bundle
- `optimizePackageImports: ["lucide-react"]` ajouté dans Next.js pour limiter les imports d'icônes côté bundle.
- `xlsx` reste chargé dynamiquement pour l'export navigateur.
- `jspdf` reste chargé dynamiquement dans le générateur PDF.
- Aucun import lourd `xlsx`, `papaparse` ou `jspdf` n'est présent dans un composant `use client`.

### 4. Images
- Les petits logos statiques passent par `next/image`.
- Les dimensions intrinsèques sont explicites, avec `priority` uniquement sur les logos above-the-fold d'authentification/vitrine.

### 5. Base de données
Ajout de `0038_performance_queries.sql` pour les accès fréquents :
- `schedule_slots(organization_id, weekday, start_time)`
- `teacher_progressions(organization_id, class_id)`
- `school_calendar_events(school_year_id, starts_on)`
- index partiel `school_years(country_id) WHERE is_current = true`

### 6. UX de chargement
- Ajout d'un `loading.tsx` au dashboard afin d'afficher immédiatement un squelette pendant les lectures serveur.

## Points déjà bien optimisés
- Plusieurs calculs utilisent des `Map` à accès O(1) au lieu de `find()` répétés.
- `0033_index_performance.sql` couvre déjà les chemins critiques notes/bulletins/élèves/documents.
- Les composants client sont limités ; les pages métier sont majoritairement server-side.

## Validation

Une installation complète des dépendances (`npm ci`) a dépassé le délai de l'environnement d'audit. Le lint, les tests et `npm run build` ne sont donc pas déclarés comme exécutés avec succès dans cet environnement.
