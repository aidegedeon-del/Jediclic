import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/dashboard/context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import Link from "next/link";
import { Camera, CheckCircle2 } from "lucide-react";
import { createSlot } from "./actions";

const WEEKDAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

export default async function EmploiDuTempsPage({
  searchParams,
}: {
  searchParams: Promise<{ imported?: string; conflicts?: string; incomplete?: string }>;
}) {
  const { imported, conflicts, incomplete } = await searchParams;
  const supabase = await createClient();
  const { membership } = await requireCurrentOrg();
  const orgId = membership.organization_id;

  const [{ data: slots }, { data: classes }, { data: subjects }] = await Promise.all([
    supabase
      .from("schedule_slots")
      .select("id, weekday, start_time, end_time, room, classes(name), subjects(name)")
      .eq("organization_id", orgId)
      .order("weekday")
      .order("start_time"),
    supabase.from("classes").select("id, name").eq("organization_id", orgId).is("archived_at", null),
    supabase.from("subjects").select("id, name").order("name"),
  ]);

  const byDay = WEEKDAYS.map((_, idx) => (slots ?? []).filter((s) => s.weekday === idx));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-voice text-2xl font-semibold text-foreground">Emploi du temps</h1>
        <Link href="/dashboard/emploi-du-temps/import">
          <Button variant="secondary">
            <Camera size={15} /> Importer une photo
          </Button>
        </Link>
      </div>

      {imported !== undefined && (
        <Card className="border-success/25 bg-success-soft">
          <CardContent className="flex items-start gap-2 py-3 text-sm">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-success" />
            <div>
              {Number(imported) > 0 && <p className="text-success">{imported} créneau(x) ajouté(s) depuis la photo importée.</p>}
              {Number(conflicts) > 0 && <p className="text-warning">{conflicts} créneau(x) ignoré(s) : chevauchement avec un cours déjà programmé.</p>}
              {Number(incomplete) > 0 && <p className="text-muted-foreground">{incomplete} créneau(x) laissé(s) de côté (jour/classe/matière/horaire non renseigné).</p>}
              {Number(imported) === 0 && <p className="text-warning">Aucun créneau intégré. L&apos;import reste en attente de relecture.</p>}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {WEEKDAYS.map((day, idx) => (
          <Card key={day}>
            <CardHeader><CardTitle>{day}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {byDay[idx].length === 0 && <p className="text-sm text-muted-foreground">Aucun cours ce jour-là.</p>}
              {byDay[idx].map((s) => (
                <div key={s.id} className="rounded-lg border border-border bg-background-soft px-3 py-2 text-sm">
                  <span className="font-data text-muted-foreground">{s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}</span>
                  {" · "}{s.classes?.name} · {s.subjects?.name}
                  {s.room && <span className="text-muted-foreground"> · Salle {s.room}</span>}
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>Ajouter un créneau</CardTitle></CardHeader>
        <CardContent>
          <form action={createSlot} className="grid gap-4 sm:grid-cols-3 sm:items-end">
            <div>
              <Label htmlFor="classId">Classe</Label>
              <Select id="classId" name="classId" required>
                {(classes ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="subjectId">Matière</Label>
              <Select id="subjectId" name="subjectId" required>
                {(subjects ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="weekday">Jour</Label>
              <Select id="weekday" name="weekday" required>
                {WEEKDAYS.map((d, idx) => <option key={d} value={idx}>{d}</option>)}
              </Select>
            </div>
            <div>
              <Label htmlFor="startTime">Début</Label>
              <Input id="startTime" name="startTime" type="time" required />
            </div>
            <div>
              <Label htmlFor="endTime">Fin</Label>
              <Input id="endTime" name="endTime" type="time" required />
            </div>
            <div>
              <Label htmlFor="room">Salle (optionnel)</Label>
              <Input id="room" name="room" />
            </div>
            <Button type="submit" className="sm:col-span-3">Ajouter le créneau</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
