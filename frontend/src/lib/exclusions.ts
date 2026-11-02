import { toInputDate } from "./schoolYear";

/** Période fermée de l'établissement (vacances, examens…), telle que la renvoie le serveur. */
export interface Exclusion {
  id: number;
  description: string;
  start_date: string;
  end_date: string;
  id_structure?: string;
}

export type SortKey = "description" | "start_date" | "end_date";

/** Exclusion en cours de saisie : dates au format `AAAA-MM-JJ`. */
export interface Draft {
  id?: number;
  description: string;
  start: string;
  end: string;
}

/** Description non vide, fin le même jour que le début ou après (règle de l'AngularJS). */
export const isValidExclusion = (d: Draft): boolean => d.description.trim() !== "" && !!d.start && !!d.end && d.end >= d.start;

/** Tri d'une colonne, croissant ou décroissant. Ex. par début : vacances d'automne avant vacances de printemps. */
export const sortExclusions = (list: Exclusion[], key: SortKey, reverse: boolean): Exclusion[] => {
  const sorted = [...list].sort((a, b) => String(a[key]).localeCompare(String(b[key])));
  return reverse ? sorted.reverse() : sorted;
};

/** Brouillon d'une exclusion existante, pour la modifier. */
export const draftOf = (e: Exclusion): Draft => ({ id: e.id, description: e.description, start: toInputDate(e.start_date), end: toInputDate(e.end_date) });

/** `2027-04-17 00:00:00` → `17/04/2027`. */
export const frDate = (value: string): string => {
  const [y, m, d] = toInputDate(value).split("-");
  return y ? `${d}/${m}/${y}` : "";
};

/** Corps de la création ou de la modification : journées entières (00:00:00 → 23:59:59). */
export const exclusionPayload = (structureId: string, d: Draft) => ({
  description: d.description.trim(),
  start_date: `${d.start} 00:00:00`,
  end_date: `${d.end} 23:59:59`,
  id_structure: structureId,
});
