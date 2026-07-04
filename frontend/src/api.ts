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

/** Plage horaire (créneau) du référentiel de la structure. */
export interface TimeSlot {
  id: string;
  name: string;
  startHour: string;
  endHour: string;
}

/** Élève (annuaire de la structure). */
export interface Eleve {
  id: string;
  displayName: string;
}

/** Commentaire de mémento. */
export interface MementoComment {
  id?: number;
  comment: string;
  owner_name?: string;
  created?: string;
}

/** Fiche mémento d'un élève. */
export interface Memento {
  id: string;
  name: string;
  birth_date?: string;
  accommodation?: string;
  transport?: boolean;
  classes?: string[];
  comment?: string;
  comments?: MementoComment[];
  relatives?: Array<{ displayName?: string; name?: string; mobile?: string; phone?: string }>;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(String(res.status));
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

function xsrfHeader(): Record<string, string> {
  const m = typeof document !== 'undefined' ? document.cookie.match(/XSRF-TOKEN=([^;]+)/) : null;
  return m ? { 'X-XSRF-TOKEN': decodeURIComponent(m[1]) } : {};
}

const base = { credentials: 'include' as const };
const mutHeaders = () => ({ 'Content-Type': 'application/json', ...xsrfHeader() });

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

/** Plages horaires (créneaux) de la structure, triées par heure de début. */
export const getTimeSlots = async (structureId: string): Promise<TimeSlot[]> =>
  json<TimeSlot[]>(await fetch(`/edt/time-slots?structureId=${structureId}`, base))
    .then((arr) => [...arr].sort((a, b) => (a.startHour || '').localeCompare(b.startHour || '')))
    .catch(() => []);

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

// ── Mémento (fiche élève + commentaires) — nécessite droit vie scolaire / ADML ────
/** Élèves de la structure (annuaire), triés par nom. */
export const getStudents = async (structureId: string): Promise<Eleve[]> =>
  json<Array<{ id: string; type?: string; displayName?: string }>>(
    await fetch(`/directory/structure/${structureId}/users`, base),
  ).then((arr) =>
    arr
      .filter((u) => u.type === 'Student')
      .map((u) => ({ id: u.id, displayName: u.displayName ?? u.id }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'fr', { sensitivity: 'base' })),
  );

/** Fiche mémento d'un élève. */
export const getMemento = async (studentId: string): Promise<Memento> =>
  json<Memento>(await fetch(`/viescolaire/memento/students/${studentId}`, base));

/** Ajoute un commentaire au mémento d'un élève. */
export const addMementoComment = async (studentId: string, comment: string): Promise<void> => {
  const res = await fetch(`/viescolaire/memento/students/${studentId}/comments`, {
    ...base,
    method: 'POST',
    headers: mutHeaders(),
    body: JSON.stringify({ comment }),
  });
  if (!res.ok) throw new Error(String(res.status));
};

export const api = {
  getPeriodes,
  getPeriodeTypes,
  getSchoolYear,
  getTimeSlots,
  getMatieres,
  getClasses,
  getStudents,
  getMemento,
  addMementoComment,
};
