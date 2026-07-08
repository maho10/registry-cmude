import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type PackageType = "full" | "partial";

export interface Participant {
  id: string;
  name: string;
  package_type: PackageType;
  diet_type: string | null;
  food_restrictions: string | null;
  lunch_day_2: boolean;
  lunch_day_2_at: string | null;
  lunch_day_3: boolean;
  lunch_day_3_at: string | null;
  lunch_day_4: boolean;
  lunch_day_4_at: string | null;
  lunch_day_5: boolean;
  lunch_day_5_at: string | null;
  lunch_day_7: boolean;
  lunch_day_7_at: string | null;
  lunch_day_8: boolean;
  lunch_day_8_at: string | null;
  arrival_kit: boolean;
  arrival_kit_at: string | null;
  is_minor: boolean;
  room: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventConfig {
  id: number;
  event_name: string;
  arrival_date: string; // ISO date string "YYYY-MM-DD" — day the event begins (offset 0)
}

/**
 * Fixed CMUDE day structure, numbered from arrival_date (day 1).
 * Only arrival_date is configurable; everything else derives from it.
 * Day 6 (rest) has no lunch, so lunch days are NOT contiguous — that's why
 * we track a day table with a hasLunch flag instead of a plain day range.
 * A different event would just swap this table out (different day count,
 * labels, hasLunch pattern, and partial/full cutoff days).
 */
export interface EventDay {
  day: number; // matches the `lunch_day_${day}` column, for lunch days
  label: string;
  hasLunch: boolean;
}

export const EVENT_DAYS: EventDay[] = [
  { day: 1, label: "Día 1 — Llegada", hasLunch: false },
  { day: 2, label: "Día 2 — Ronda 0", hasLunch: true },
  { day: 3, label: "Día 3 — Rondas 1–3", hasLunch: true },
  { day: 4, label: "Día 4 — Rondas 4–6", hasLunch: true },
  { day: 5, label: "Día 5 — Rondas 7–9", hasLunch: true },
  { day: 6, label: "Día 6 — Descanso", hasLunch: false },
  { day: 7, label: "Día 7 — Cuartos de final", hasLunch: true },
  { day: 8, label: "Día 8 — Semifinal y Final", hasLunch: true },
  { day: 9, label: "Día 9 — Salida", hasLunch: false },
];

const PARTIAL_CUTOFF_DAY = 5;
const FULL_CUTOFF_DAY = 8;

const LUNCH_DAYS = EVENT_DAYS.filter((d) => d.hasLunch);

/** Lunch days a participant's package entitles them to, in order. */
export function lunchPhasesForPackage(packageType: PackageType): EventDay[] {
  const cutoff = packageType === "full" ? FULL_CUTOFF_DAY : PARTIAL_CUTOFF_DAY;
  return LUNCH_DAYS.filter((d) => d.day <= cutoff);
}

/** Returns today's event day relative to arrival_date, or null if outside the event window. */
export function currentPhase(arrivalDate: string): EventDay | null {
  const start = new Date(arrivalDate + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayNumber = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return EVENT_DAYS.find((d) => d.day === dayNumber) ?? null;
}

/** Returns the lunch field name for a given day number. */
export function lunchField(day: number): keyof Participant {
  return `lunch_day_${day}` as keyof Participant;
}

/** Returns true if all lunches the participant's package entitles them to are marked. */
export function isComplete(p: Participant): boolean {
  return lunchPhasesForPackage(p.package_type).every((day) => p[lunchField(day.day)]);
}

/** Color classes for diet types. */
export const DIET_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  none: { bg: "bg-gray-100", text: "text-gray-700", label: "Sin restricción" },
  vegetarian: { bg: "bg-green-100", text: "text-green-800", label: "Vegetariano" },
  vegan: { bg: "bg-emerald-100", text: "text-emerald-800", label: "Vegano" },
  "lactose-intolerant": { bg: "bg-yellow-100", text: "text-yellow-800", label: "Intolerancia a lactosa" },
  allergy: { bg: "bg-red-100", text: "text-red-800", label: "Alergia" },
};

export function dietStyle(dietType: string | null) {
  const key = dietType?.toLowerCase() ?? "none";
  return DIET_COLORS[key] ?? { bg: "bg-purple-100", text: "text-purple-800", label: dietType ?? "—" };
}

export type ScanMode = "kit" | "lunch";

export interface ScanResult {
  granted: boolean;
  field: keyof Participant | null; // field to set true when granted
}

/**
 * Evaluates a scan and reports whether it should be granted, plus which
 * field to mark true. Does not write to the DB — callers write on `granted`.
 */
export function evaluateScan(mode: ScanMode, p: Participant, arrivalDate: string): ScanResult {
  if (mode === "kit") {
    return { granted: !p.arrival_kit, field: "arrival_kit" };
  }

  // Lunch mode: kit must be picked up first, today must be a lunch day
  // covered by the package, and not already claimed today.
  if (!p.arrival_kit) return { granted: false, field: null };

  const phase = currentPhase(arrivalDate);
  if (!phase || !phase.hasLunch) return { granted: false, field: null };

  const covered = lunchPhasesForPackage(p.package_type).some((d) => d.day === phase.day);
  if (!covered) return { granted: false, field: null };

  const field = lunchField(phase.day);
  if (p[field]) return { granted: false, field };

  return { granted: true, field };
}
