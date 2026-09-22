import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/dashboard/context";
import { getCurrentSchoolYear } from "@/lib/dashboard/school-year";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Users } from "lucide-react";
import { createClass } from "./actions";

export default async function ClassesPage() {
  const supabase = await createClient();
  const { user, membership } = await requireCurrentOrg();
  const orgId = membership.organization_id;
  const isSupervisor = membership.role === "owner" || membership.role === "admin";

  const currentYear = await getCurrentSchoolYear(supabase, membership.organizations?.country_id);

  const [{ data: classes }, { data: levels }] = await Promise.all([
    currentYear
      ? supabase
          .from("classes")
          .select("id, name, teacher_id, education_levels(name), school_years(label), students(count)")
          .eq("organization_id", orgId)
          .eq("school_year_id", currentYear.id)
          .is("archived_at", null)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: null }),
    supabase.from("education_levels").select("id, name, education_cycles(name)").order("name"),
  ]);

  const teacherIds = Array.from(
    new Set((classes ?? []).map((c) => c.teacher_id).filter((id: string | null): id is string => !!id))
  );
  const { data: teacherProfiles } = isSupervisor && teacherIds.length > 0
    ? await supabase.from("profiles").select("id, full_name").in("id", teacherIds)
    : { data: null };
  const teacherNameById = new Map((teacherProfiles ?? []).map((p) => [p.id, p.full_name]));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-voice text-2xl font-semibold text-foreground">Vos classes</h1>
          {currentYear && <p className="text-sm text-muted-foreground">Année scolaire {currentYear.label}</p>}
        </div>
        <Link
          href="/dashboard/archives"
          className="text-sm font-medium text-primary hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
        >
          Voir les archives
        </Link>
      </div>

      {!currentYear && (
        <p
          role="alert"
          className="rounded-lg border border-warning/25 bg-warning-soft px-4 py-3 text-sm text-warning"
        >
          Aucune année scolaire en cours n&apos;est configurée. Contactez le support.
        </p>
      )}

      {/* Liste des classes */}
      <div className="grid gap-3 sm:grid-cols-2" role="list" aria-label="Liste de vos classes">
        {(classes ?? []).map((c) => {
          const isMine = c.teacher_id === user!.id;
          const studentCount = c.students?.[0]?.count ?? 0;
          return (
            <Card
              key={c.id}
              className="transition-shadow hover:shadow-soft-lg"
              role="listitem"
            >
              <Link
                href={`/dashboard/classes/${c.id}`}
                className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
                aria-label={`Classe ${c.name}${c.education_levels?.name ? ` — ${c.education_levels.name}` : ""} — ${studentCount} élève(s)`}
              >
                <CardContent className="pt-5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-voice font-semibold text-foreground">{c.name}</p>
                    {isSupervisor && (
                      c.teacher_id ? (
                        <Badge variant={isMine ? "default" : "success"}>
                          {isMine ? "Vous" : teacherNameById.get(c.teacher_id) || "Professeur assigné"}
                        </Badge>
                      ) : (
                        <Badge variant="warning">Sans professeur</Badge>
                      )
                    )}
                  </div>
                  <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                    {c.education_levels?.name} · {c.school_years?.label}
                    <span className="inline-flex items-center gap-1" aria-label={`${studentCount} élève(s)`}>
                      {/* Icône décorative */}
                      <Users size={13} aria-hidden="true" />
                      {studentCount}
                    </span>
                  </p>
                </CardContent>
              </Link>
              {isSupervisor && !c.teacher_id && (
                <div className="border-t border-border px-4 py-2">
                  <Link
                    href="/dashboard/etablissement"
                    className="text-xs font-medium text-primary hover:underline rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
                  >
                    Inviter un professeur pour cette classe
                  </Link>
                </div>
              )}
            </Card>
          );
        })}
        {(!classes || classes.length === 0) && (
          <p className="text-sm text-muted-foreground" role="status">
            Aucune classe pour l&apos;instant — créez la première ci-dessous, ça prend quelques secondes.
          </p>
        )}
      </div>

      {/* Formulaire de création */}
      <Card>
        <CardHeader>
          <CardTitle>Créer une classe</CardTitle>
          <CardDescription>Vous pourrez y ajouter des élèves juste après.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            action={createClass}
            className="grid gap-4 sm:grid-cols-2 sm:items-end"
            aria-label="Formulaire de création d'une classe"
          >
            <div>
              <Label htmlFor="name">Nom de la classe</Label>
              <Input id="name" name="name" placeholder="3e A" required aria-required="true" />
            </div>
            <div>
              <Label htmlFor="educationLevelId">Niveau</Label>
              <Select id="educationLevelId" name="educationLevelId" required aria-required="true">
                {(levels ?? []).map((l) => (
                  <option key={l.id} value={l.id}>{l.education_cycles?.name} — {l.name}</option>
                ))}
              </Select>
            </div>
            <Button type="submit" disabled={!currentYear} className="sm:col-span-2">
              Créer la classe
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
