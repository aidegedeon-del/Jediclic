/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  compress: true,
  experimental: {
    serverActions: { bodySizeLimit: '5mb' },
    optimizePackageImports: ["lucide-react"],
    cpus: 1,
    workerThreads: false,
    webpackMemoryOptimizations: true,
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' }
    ]
  },
  // Point 18 du cahier des charges : en-têtes de sécurité HTTP.
  // Volontairement PAS de Content-Security-Policy ici : Next.js insère du
  // JS inline pour l'hydratation (RSC payload) et le flux Supabase Auth
  // (createBrowserClient, redirections OAuth/magic link) dépend de requêtes
  // fetch/cookies cross-origin vers *.supabase.co — un CSP mal calibré
  // casserait silencieusement l'authentification sans qu'aucun test ne le
  // révèle en local (le navigateur bloque simplement la requête). Une vraie
  // CSP nécessiterait un test manuel complet du flux de connexion en
  // environnement de staging avant activation ; ce n'est pas fait ici pour
  // respecter la contrainte "sans casser Supabase Auth". Les 4 en-têtes
  // ci-dessous sont en revanche sans risque (aucune dépendance à des
  // scripts/frames tiers) et durcissent immédiatement l'application.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Anti-clickjacking : empêche l'application d'être chargée dans
          // une <iframe> sur un autre site (protection contre les attaques
          // de type "UI redressing" sur les formulaires de connexion/notes).
          { key: 'X-Frame-Options', value: 'DENY' },
          // Empêche le navigateur de renifler le Content-Type déclaré
          // (protection contre certaines attaques XSS via upload de fichier).
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // N'envoie l'URL complète en Referer qu'en HTTPS vers la même
          // origine ; réduit la fuite d'URLs internes (ex. tokens en query
          // string) vers des domaines tiers référencés par l'application.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Désactive par défaut les API navigateur sensibles non utilisées
          // par l'application (caméra, micro, géolocalisation).
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
