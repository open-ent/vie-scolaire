// Client REST du module Vie scolaire (viescolaire) — session ENT, même origine.
// Incrément 1 : lecture seule du référentiel (périodes, matières, classes).

export interface Periode {
  id: number;
  /** Identifiant du type de période (trimestre/semestre…) selon le référentiel. */
  type?: number;
  id_type?: number;
  /** Bornes de la période (dates ISO). */
  timestamp_dt?: string;
  timestamp_fn?: string;
  id_etablissement?: string;
}

export interface PeriodeType {
  id: number;
  /** Famille de découpage : 1 = année, 2 = semestre, 3 = trimestre. */
  type?: number;
  ordre?: number;
  libelle?: string;
}

export interface Matiere {
  id: string;
  name: string;
}

export interface Classe {
  id: string;
  name: string;
}

/** Année scolaire de la structure (settings/periode, code = YEAR). */
export interface SchoolYear {
  id: number;
  start_date?: string;
  end_date?: string;
  code?: string;
  is_opening?: boolean;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(String(res.status));
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

const base = { credentials: 'include' as const };

// ── Référentiel (lecture seule) ────────────────────────────────────────────────
/** Périodes scolaires de l'établissement. */
export const getPeriodes = async (structureId: string): Promise<Periode[]> =>
  json<Periode[]>(await fetch(`/viescolaire/periodes?idEtablissement=${structureId}`, base));

/** Référentiel des types de période (trimestre, semestre…). */
export const getPeriodeTypes = async (): Promise<PeriodeType[]> =>
  json<PeriodeType[]>(await fetch(`/viescolaire/periodes/types`, base));

/** Année scolaire de la structure (bornes + code). */
export const getSchoolYear = async (structureId: string): Promise<SchoolYear | null> =>
  json<SchoolYear>(await fetch(`/viescolaire/settings/periode?structure=${structureId}`, base)).catch(() => null);

/** Matières de l'établissement (issues de l'EDT). */
export const getMatieres = async (structureId: string): Promise<Matiere[]> =>
  json<Array<{ id: string; name: string }>>(
    await fetch(`/viescolaire/matieres?idEtablissement=${structureId}`, base),
  ).then((arr) => arr.map((m) => ({ id: m.id, name: m.name })));

/** Classes de l'établissement. */
export const getClasses = async (structureId: string): Promise<Classe[]> =>
  json<Array<{ id: string; name: string }>>(
    await fetch(`/viescolaire/classes?idEtablissement=${structureId}`, base),
  ).then((arr) => arr.map((c) => ({ id: c.id, name: c.name })));

export const api = {
  getPeriodes,
  getPeriodeTypes,
  getSchoolYear,
  getMatieres,
  getClasses,
};
