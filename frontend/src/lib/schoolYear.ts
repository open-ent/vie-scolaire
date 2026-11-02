/** Année scolaire d'un établissement, telle que la renvoie `GET /viescolaire/settings/periode`. */
export interface SchoolYear {
  id?: number;
  start_date?: string;
  end_date?: string;
  code?: string;
  isOpening?: boolean;
}

/** `2026-09-01 00:00:00` ou `2026-09-01T00:00:00.000Z` → `2026-09-01` (valeur d'un champ date). */
export const toInputDate = (value?: string): string => (value ? value.slice(0, 10) : "");

/**
 * Le formulaire est valide si la fin n'est pas avant le début et si l'année n'est pas déjà terminée
 * (on ne programme pas une année passée) — mêmes règles que l'AngularJS.
 */
export const isValidSchoolYear = (start: string, end: string, now: Date = new Date()): boolean => {
  if (!start || !end) return false;
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T23:59:59`);
  return e.getTime() >= s.getTime() && now.getTime() < e.getTime();
};

/** Corps de la création/modification : le début à minuit, la fin à 23 h 59 min 59 s. */
export const schoolYearPayload = (structureId: string, start: string, end: string, id?: number, description = "") => ({
  id,
  description,
  start_date: `${start} 00:00:00`,
  end_date: `${end} 23:59:59`,
  id_structure: structureId,
});
