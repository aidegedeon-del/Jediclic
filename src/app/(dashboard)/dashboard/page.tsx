import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/dashboard/context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { computeOrgProgressionDrift } from "@/lib/progress/compute";
import { getCurrentSchoolYear } from "@/lib/dashboard/school-year";
import { listSchoolCalendarEvents, findCalendarEventForDate, CALENDAR_CATEGORY_LABELS } from "@/lib/dashboard/school-calendar";
import { CalendarClock, Sun } from "lucide-react";

const WEEKDAY_LABELS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

export default async function DashboardHomePage() {
  const supabase = await createClient();
  const { membership } = await requireCurrentOrg();
  const orgId = membership.organization_id;

  const todayWeekday = (new Date().getDay() + 6) % 7; // 0 = lundi
  const todayStr = new Date().toISOString().slice(0, 10);

  const currentYear = await getCurrentSchoolYear(supabase, membership.organizations?.country_id);

  // Les trois sources sont indépendantes une fois l'année scolaire connue.
  // Les exécuter en parallèle réduit le temps total d'attente réseau du dashboard.
  const [calendarEvents, todaySlotsResult, drifts] = await Promise.all([
    currentYear ? listSchoolCalendarEvents(supabase, currentYear.id) : Promise.resolve([]),
    supabase
      .from("schedule_slots")
      .select("id, start_time, end_time, room, classes(name), subjects(name)")
      .eq("organization_id", orgId)
      .eq("weekday", todayWeekday)
      .order("start_time")
      .then(({ data }) => data ?? []),
    computeOrgProgressionDrift(supabase, orgId),
  ]);
  const todayEvent = findCalendarEventForDate(calendarEvents, todayStr);
  const todaySlots = todaySlotsResult;
  const lateDrifts = drifts.filter((d) => d.status === "late" || d.drift.kind === "late");
  const aheadDrifts = drifts.filter((d) => d.status === "ahead" || d.drift.kind === "ahead");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        {/* Jour de la semaine — aria-hidden pour le visuel décoratif, inclus dans h1 */}
        <p className="text-sm font-medium uppercase tracking-wide text-accent" aria-hidden="true">
          {WEEKDAY_LABELS[todayWeekday]}
        </p>
        <h1 className="font-voice text-2xl font-semibold text-foreground">
          <span className="sr-only">{WEEKDAY_LABELS[todayWeekday]} — </span>
          Bonjour, voici votre journée
        </h1>
        <p className="text-sm text-muted-foreground">Ce qui compte pour aujourd&apos;hui, sans avoir à chercher.</p>
      </div>

      {/* Événement du calendrier scolaire — role="status" */}
      {todayEvent && (
        <p
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 rounded-lg border border-warning/25 bg-warning-soft px-4 py-3 text-sm text-warning"
        >
          {/* Icône décorative */}
          <CalendarClock size={16} className="shrink-0" aria-hidden="true" />
          {CALENDAR_CATEGORY_LABELS[todayEvent.category]} : {todayEvent.label}
        </p>
      )}
      {currentYear && calendarEvents.length === 0 && (
        <p className="text-sm text-muted-foreground" role="status">
          Le découpage officiel de l&apos;année {currentYear.label} (congés, examens...) n&apos;est pas encore chargé.
        </p>
      )}

      {/* Cours du jour */}
      <Card>
        <CardHeader><CardTitle>Cours du jour</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {todayEvent && (todayEvent.category === "ferie" || todayEvent.category === "conge" || todayEvent.category === "pedagogique") ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sun size={16} className="shrink-0 text-accent" aria-hidden="true" />
              Pas de cours aujourd&apos;hui ({todayEvent.label}) — profitez-en.
            </p>
          ) : (
            <>
              {(!todaySlots || todaySlots.length === 0) && (
                <p className="text-sm text-muted-foreground" role="status">
                  Aucun cours programmé aujourd&apos;hui.
                </p>
              )}
              {todaySlots && todaySlots.length > 0 && (
                <ul role="list" className="space-y-2">
                  {todaySlots.map((slot) => (
                    <li
                      key={slot.id}
                      className="flex items-center justify-between rounded-lg border border-border bg-background-soft px-4 py-2.5 text-sm"
                    >
                      <span>
                        <span className="font-data text-muted-foreground">
                          {slot.start_time.slice(0, 5)}–{slot.end_time.slice(0, 5)}
                        </span>
                        {" · "}<span className="font-medium text-foreground">{slot.classes?.name}</span>
                        {" · "}{slot.subjects?.name}
                      </span>
                      {slot.room && (
                        <span className="text-xs text-muted-foreground">Salle {slot.room}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Progression — points d'attention */}
      <Card>
        <CardHeader>
          <CardTitle>Progression — points d&apos;attention</CardTitle>
          <CardDescription>Les écarts avec le programme officiel, repérés pour vous.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {lateDrifts.length === 0 && aheadDrifts.length === 0 && (
            <p className="text-sm text-muted-foreground" role="status">
              Aucun retard détecté pour l&apos;instant, par rapport au programme officiel chargé.
            </p>
          )}
          {(lateDrifts.length > 0 || aheadDrifts.length > 0) && (
            <ul role="list" className="space-y-2">
              {lateDrifts.map((d) => (
                <li
                  key={d.progressionId}
                  className="flex items-center justify-between rounded-lg border border-border bg-background-soft px-4 py-2.5 text-sm"
                >
                  <span>{d.className} — {d.unitTitle}</span>
                  <Badge variant="warning">
                    Retard{d.drift.kind === "late" && d.drift.daysDiff ? ` — ${d.drift.daysDiff} j` : ""}
                  </Badge>
                </li>
              ))}
              {aheadDrifts.map((d) => (
                <li
                  key={d.progressionId}
                  className="flex items-center justify-between rounded-lg border border-border bg-background-soft px-4 py-2.5 text-sm"
                >
                  <span>{d.className} — {d.unitTitle}</span>
                  <Badge variant="success">
                    Avance{d.drift.kind === "ahead" && d.drift.daysDiff ? ` — ${d.drift.daysDiff} j` : ""}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
