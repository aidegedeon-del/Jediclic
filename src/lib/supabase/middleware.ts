import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Rafraîchit la session Supabase sur chaque requête et protège les routes
// /dashboard, /onboarding. Convention §26 : la sécurité ne doit jamais
// reposer uniquement sur l'interface — ceci est une couche parmi d'autres,
// la véritable barrière reste RLS côté base.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const protectedPrefixes = ["/dashboard", "/onboarding", "/plateforme", "/abonnement-expire"];
  const isProtected = protectedPrefixes.some((p) => request.nextUrl.pathname.startsWith(p));

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Permet au layout dashboard (src/app/(dashboard)/dashboard/layout.tsx) de
  // savoir quelle page est demandée pour exempter /dashboard/abonnement et
  // /dashboard/etablissement du contrôle d'accès par abonnement — sans quoi
  // une organisation bloquée n'aurait plus aucun moyen de régulariser.
  response.headers.set("x-pathname", request.nextUrl.pathname);
  return response;
}
