"use server";

import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit/log";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { ACTIVE_ORG_COOKIE } from "@/lib/dashboard/constants";

// Convention §22/§56 : rejoindre une organisation n'est jamais automatique,
// même sur invitation — l'utilisateur doit explicitement accepter. La RLS
// (migration 0009, policy "members_insert_via_invitation") revérifie tout
// ceci côté base : ce contrôle applicatif est une défense en profondeur,
// pas la seule barrière (Convention §26).
//
// CORRECTION FIABILITÉ :
// - Idempotence : vérification qu'un membre pour cette invitation n'existe pas déjà
//   (double soumission → redirection sans erreur)
// - Vérification explicite de chaque étape avec messages d'erreur clairs
// - En cas d'échec de la mise à jour du statut de l'invitation après insertion
//   du membre, on log et on continue (le membre existe, c'est l'essentiel)
export async function acceptInvitation(invitationId: string, formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) redirect("/login");

  const { data: invitation } = await supabase
    .from("invitations")
    .select("id, organization_id, email, role, status, needs_seat_payment, seat_payment_submission_id, class_id")
    .eq("id", invitationId)
    .single();

  if (!invitation) {
    throw new Error("Cette invitation n'existe pas ou n'est plus valide.");
  }

  // CORRECTION : Idempotence — vérifier si le membre existe déjà pour cette invitation
  const { data: existingMember } = await supabase
    .from("organization_members")
    .select("id, organization_id")
    .eq("invitation_id", invitationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingMember) {
    // Déjà accepté (double soumission ou rechargement de page)
    // Mettre à jour le cookie et rediriger sans erreur
    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_ORG_COOKIE, existingMember.organization_id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    redirect("/dashboard");
  }

  if (invitation.status !== "pending") {
    throw new Error("Cette invitation n'est plus valide.");
  }
  if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
    throw new Error("Cette invitation ne correspond pas à votre compte.");
  }

  const fullName = String(formData.get("fullName") ?? "").trim();
  if (fullName) {
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ full_name: fullName })
      .eq("id", user.id);
    if (profileError) {
      // Non bloquant : le profil peut être mis à jour plus tard
      console.warn("[acceptInvitation] Mise à jour profil échouée (non bloquant) :", profileError.message);
    }
  }

  // Création atomique du membership + acceptation de l'invitation côté DB.
  // Le rôle et l'organisation sont relus depuis la ligne verrouillée en base :
  // ils ne peuvent pas être forgés par le client.
  const { data: member, error: memberError } = await supabase
    .rpc("accept_organization_invitation", { p_invitation_id: invitationId });
  if (memberError || !member) {
    throw new Error(memberError?.message ?? "Impossible d'accepter cette invitation.");
  }

  // EF-AUDIT-01 (§30, "changement de rôle")
  await logAudit({
    organizationId: invitation.organization_id,
    actorId: user.id,
    action: "member.role_assign",
    entityTable: "organization_members",
    entityId: member?.id ?? null,
    beforeData: null,
    afterData: { role: invitation.role, via: "invitation_accepted" },
  });

  // Sélecteur multi-espaces : faire atterrir dans l'espace rejoint
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_ORG_COOKIE, invitation.organization_id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  redirect("/dashboard");
}

export async function declineInvitation(invitationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) redirect("/login");

  // CORRECTION : Vérification que l'invitation est bien pending avant rejet
  const { data: invitation } = await supabase
    .from("invitations")
    .select("id, status")
    .eq("id", invitationId)
    .eq("email", user.email)
    .maybeSingle();

  if (!invitation) {
    throw new Error("Invitation introuvable ou non destinée à votre compte.");
  }
  if (invitation.status === "revoked") {
    // Déjà refusée : idempotent
    revalidatePath("/dashboard/invitations");
    revalidatePath("/onboarding");
    return;
  }
  if (invitation.status !== "pending") {
    throw new Error(`Cette invitation ne peut pas être refusée (statut : ${invitation.status}).`);
  }

  const { error } = await supabase.rpc("decline_organization_invitation", { p_invitation_id: invitationId });
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/invitations");
  revalidatePath("/onboarding");
}
