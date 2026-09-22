# JedicliC — Audit et durcissement Responsive

## Corrections appliquées

- Ajout d'une navigation mobile dédiée au dashboard (`MobileNav`) avec en-tête compact, menu latéral accessible et barre de navigation rapide.
- Masquage de la sidebar desktop sous `md` et conservation de la sidebar complète à partir de `md`.
- Espacement du contenu principal adapté au mobile (`px-4`, `pt-20`, `pb-24`) avec `min-w-0` pour éviter les débordements.
- Protection globale contre les débordements horizontaux involontaires sur petits écrans.
- Tableaux de données rendus défilables horizontalement sur mobile afin de préserver leur lisibilité sans écraser les colonnes.
- Zones de navigation/action mobile conservées à 44px minimum lorsque pertinent.
- OrgSwitcher réutilisé dans la navigation mobile.
- Header de la vitrine ajusté pour les petits écrans.

## Contrôles effectués

- Recherche des largeurs fixes et espacements pouvant provoquer des débordements.
- Inventaire des tableaux : les tableaux applicatifs sont placés dans des conteneurs `overflow-x-auto` là où nécessaire.
- Vérification de la structure du layout dashboard desktop/mobile.
- Vérification des scripts disponibles dans `package.json`.

## Limitation

Le build/lint n'a pas pu être exécuté dans cet environnement : `npm ci --no-audit --no-fund` a dépassé le délai de transport du conteneur. Aucun succès de build n'est donc déclaré sur cette base.

## Recommandation de validation finale

Tester au minimum : 320px, 360px, 375px, 390px, 430px, 768px, 1024px et desktop large, puis vérifier spécifiquement : dashboard, classes, élèves, notes, évaluations, bulletins, imports, documents et établissement.
