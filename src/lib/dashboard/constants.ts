// Nom du cookie stockant l'organisation actuellement sélectionnée par
// l'utilisateur (sélecteur multi-espaces). Fichier séparé de context.ts et
// actions.ts car un fichier marqué "use server" ne peut exporter que des
// fonctions async — une constante partagée doit vivre ailleurs.
export const ACTIVE_ORG_COOKIE = "active_org_id";
