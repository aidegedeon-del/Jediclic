import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/dashboard/context";
import { getCurrentSchoolYear } from "@/lib/dashboard/school-year";
import { listSchoolCalendarEvents, CALENDAR_CATEGORY_LABELS } from "@/lib/dashboard/school-calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays } from "lucide-react";

const CATEGORY_BADGE_VARIANT: Record<string, "warning" | "success" | "default"> = {
  ferie: "warning",
  conge: "warning",
  examen: "success",
  pedagogique: "default",
};

// Lecture seule : ce calendrier est le découpage officiel publié par le
// MENA/DELC, chargé plateforme (comme school_years/school_periods) — jamais
// saisi ici par un enseignant ou un établissement.
export default async function CalendrierScolairePage() {
  const supabase = await createClient();
  const { membership } = await requireCurrentOrg();
  const currentYear = await getCurrentSchoolYear(supabase, membership.organizations?.country_id);
  const events = currentYear ? await listSchoolCalendarEvents(supabase, currentYear.id) : [];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 font-voice text-2xl font-semibold text-foreground">
          <CalendarDays size={22} className="text-primary" /> Calendrier scolaire
        </h1>
        <p className="text-sm text-muted-foreground">
          Découpage officiel MENA/DELC{currentYear ? ` — ${currentYear.label}` : ""} : congés, jours fériés, examens, journées pédagogiques.
        </p>
      </div>
      <Card>
        <CardContent className="space-y-2 pt-5">
          {events.map((e) => (
            <div key={e.id} className="flex items-center justify-between rounded-lg border border-border-strong px-4 py-3 text-sm">
              <div>
                <p className="font-medium text-foreground">{e.label}</p>
                <p className="text-muted-foreground">du {e.starts_on} au {e.ends_on}</p>
              </div>
              <Badge variant={CATEGORY_BADGE_VARIANT[e.category] ?? "default"}>{CALENDAR_CATEGORY_LABELS[e.category as keyof typeof CALENDAR_CATEGORY_LABELS]}</Badge>
            </div>
          ))}
          {events.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Le découpage officiel de l&apos;année{currentYear ? ` ${currentYear.label}` : ""} n&apos;est pas encore chargé — il sera disponible dès sa publication par le MENA.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
