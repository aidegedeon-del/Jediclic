import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/dashboard/context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { addStudent } from "./actions";

export default async function ClassDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  await requireCurrentOrg();

  const [{ data: klass }, { data: students }] = await Promise.all([
    supabase.from("classes").select("id, name, education_levels(name), school_years(label)").eq("id", id).single(),
    supabase.from("students").select("id, full_name, student_number").eq("class_id", id).is("archived_at", null).order("full_name"),
  ]);

  const addStudentWithId = addStudent.bind(null, id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-voice text-2xl font-semibold text-foreground">{klass?.name}</h1>
        <p className="text-sm text-muted-foreground">
          {klass?.education_levels?.name} · {klass?.school_years?.label}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Élèves ({students?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {/* Liste des élèves — rôle list explicite (WCAG 1.3.1) */}
          {(students ?? []).length > 0 && (
            <ul role="list" className="space-y-2" aria-label="Liste des élèves de la classe">
              {(students ?? []).map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between rounded-lg border border-border bg-background-soft px-4 py-2 text-sm"
                >
                  <span>{s.full_name}</span>
                  {s.student_number && (
                    <span className="text-xs text-muted-foreground">
                      Matricule {s.student_number}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}

          {(!students || students.length === 0) && (
            <p className="text-sm text-muted-foreground" role="status">
              Aucun élève pour l&apos;instant — ajoutez le premier ci-dessous.
            </p>
          )}

          {/* Formulaire d'ajout d'élève */}
          <form
            action={addStudentWithId}
            className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-3 sm:items-end"
            aria-label="Ajouter un élève à la classe"
          >
            <div>
              <Label htmlFor="fullName">Nom complet</Label>
              <Input id="fullName" name="fullName" required aria-required="true" autoComplete="name" />
            </div>
            <div>
              <Label htmlFor="studentNumber">Matricule (optionnel)</Label>
              <Input id="studentNumber" name="studentNumber" autoComplete="off" />
            </div>
            <Button type="submit">Ajouter l&apos;élève</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
