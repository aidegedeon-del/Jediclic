import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/dashboard/context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Mail, AlertTriangle } from "lucide-react";
import { acceptInvitation, declineInvitation } from "@/lib/invitations/actions";

// Un utilisateur qui a déjà un espace (professeur individuel ou membre d'un
// autre établissement) ne repasse jamais par /onboarding — c'est ici qu'il
// voit et traite les invitations reçues sur son adresse e-mail.
export default async function InvitationsPage() {
  const supabase = await createClient();
  const { user } = await requireCurrentOrg();

  const { data: invitations } = user?.email
    ? await supabase
        .from("invitations")
        .select("id, role, created_at, organizations(name)")
        .eq("email", user.email)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
    : { data: [] };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 font-voice text-2xl font-semibold text-foreground">
          <Mail size={22} className="text-primary" /> Mes invitations
        </h1>
        <p className="text-sm text-muted-foreground">Les établissements qui vous invitent apparaissent ici.</p>
      </div>

      {(!invitations || invitations.length === 0) && (
        <p className="text-sm text-muted-foreground">Aucune invitation en attente pour le moment.</p>
      )}

      {(invitations ?? []).map((inv) => {
        const acceptWithId = acceptInvitation.bind(null, inv.id);
        const declineWithId = declineInvitation.bind(null, inv.id);
        return (
          <Card key={inv.id}>
            <CardHeader><CardTitle>{inv.organizations?.name ?? "Établissement"}</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Rôle proposé : {inv.role === "teacher" ? "enseignant" : inv.role}
              </p>
              <p className="flex items-start gap-1.5 text-xs text-warning">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                Accepter vous ajoute comme membre de cet établissement, en plus de votre espace actuel — vous
                pourrez basculer entre les deux à tout moment depuis « Espace actif » dans la barre latérale.
              </p>
              <form action={acceptWithId} className="space-y-3">
                <div>
                  <Label htmlFor={`fullName_${inv.id}`}>Nom à afficher pour cet établissement</Label>
                  <Input id={`fullName_${inv.id}`} name="fullName" defaultValue={user?.user_metadata?.full_name ?? ""} />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" size="sm">Accepter</Button>
                </div>
              </form>
              <form action={declineWithId}>
                <Button type="submit" variant="ghost" size="sm">Refuser</Button>
              </form>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
