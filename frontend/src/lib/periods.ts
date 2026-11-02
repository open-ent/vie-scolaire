import { toInputDate } from "./schoolYear";
import { Classe } from "./timeSlots";

/** Période d'une classe, telle que la renvoie `GET /viescolaire/periodes`. */
export interface Periode {
  id?: number;
  id_classe?: string;
  id_type?: number;
  timestamp_dt: string;
  timestamp_fn: string;
  date_fin_saisie: string;
  date_conseil_classe?: string;
  publication_bulletin?: boolean;
}

/** Type de période : famille (1 année, 2 semestre, 3 trimestre) et rang dans la famille. */
export interface PeriodType {
  id: number;
  type: number;
  ordre: number;
}

/** Période en cours d'édition dans la fenêtre : dates au format `AAAA-MM-JJ`. */
export interface Draft {
  timestamp_dt: string;
  timestamp_fn: string;
  date_fin_saisie: string;
  date_conseil_classe: string;
  publication_bulletin: boolean;
}

export interface Errors {
  fn: boolean;
  fnS: boolean;
  over: boolean;
  contig: boolean;
}

const day = (s?: string): string => toInputDate(s);

/** Périodes regroupées par classe, triées par début. */
export const byClass = (periodes: Periode[]): Map<string, Periode[]> => {
  const out = new Map<string, Periode[]>();
  for (const p of periodes) {
    if (!p.id_classe) continue;
    out.set(p.id_classe, [...(out.get(p.id_classe) ?? []), p].sort((a, b) => day(a.timestamp_dt).localeCompare(day(b.timestamp_dt))));
  }
  return out;
};

/** Familles de période disponibles (1, 2, 3…), triées. */
export const periodFamilies = (types: PeriodType[]): number[] => [...new Set(types.map((t) => t.type))].sort((a, b) => a - b);

/**
 * Période à afficher pour une classe : celle qui contient aujourd'hui ; sinon la plus proche (début ou fin) ;
 * sinon la première. Ex. entre le trimestre 1 (fini le 30/11) et le trimestre 2 (début 02/12), le 01/12 → la plus proche.
 */
export const currentPeriod = (periodes: Periode[], now: Date = new Date()): Periode | undefined => {
  if (periodes.length === 0) return undefined;
  const today = now.toISOString().slice(0, 10);
  const inside = periodes.find((p) => day(p.timestamp_dt) <= today && today <= day(p.timestamp_fn));
  if (inside) return inside;
  const gap = (d: string) => Math.abs(new Date(`${d}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime());
  let best = periodes[0];
  let bestGap = Infinity;
  for (const p of periodes) {
    for (const d of [day(p.timestamp_dt), day(p.timestamp_fn)]) {
      if (gap(d) < bestGap) {
        bestGap = gap(d);
        best = p;
      }
    }
  }
  return best;
};

/** Famille + rang d'une période (via son type) ; sert à écrire « Trimestre 2 ». */
export const periodName = (p: Periode | undefined, types: PeriodType[]): { type: number; ordre: number } | undefined => {
  const t = types.find((x) => x.id === p?.id_type);
  return t ? { type: t.type, ordre: t.ordre } : undefined;
};

/** Classes filtrées par nombre de périodes (0 = non initialisées) et par début du nom (insensible à la casse). */
export const filterClasses = (classes: Classe[], periods: Map<string, Periode[]>, family: number | null, name: string): Classe[] => {
  const prefix = name.trim().toUpperCase();
  return classes
    .filter((c) => family === null || (periods.get(c.id)?.length ?? 0) === family)
    .filter((c) => !prefix || prefix === "*" || c.name.toUpperCase().startsWith(prefix))
    .sort((a, b) => a.name.localeCompare(b.name));
};

/** `n` périodes vierges datées d'aujourd'hui, prêtes à être renseignées. */
export const buildDrafts = (n: number, today: string): Draft[] =>
  Array.from({ length: n }, () => ({ timestamp_dt: today, timestamp_fn: today, date_fin_saisie: today, date_conseil_classe: today, publication_bulletin: false }));

/** Édition de la première classe sélectionnée : ses périodes deviennent les brouillons. */
export const toDrafts = (periodes: Periode[]): Draft[] =>
  periodes.map((p) => ({
    timestamp_dt: day(p.timestamp_dt),
    timestamp_fn: day(p.timestamp_fn),
    date_fin_saisie: day(p.date_fin_saisie),
    date_conseil_classe: day(p.date_conseil_classe),
    publication_bulletin: !!p.publication_bulletin,
  }));

/** Les brouillons, triés par début de période. */
export const sortDrafts = (drafts: Draft[]): Draft[] => [...drafts].sort((a, b) => a.timestamp_dt.localeCompare(b.timestamp_dt));

/**
 * Erreurs de saisie, comme l'AngularJS : fin après début (strictement), fin de saisie après début, pas de
 * chevauchement, périodes contiguës (pas plus d'un jour d'écart entre deux périodes qui se suivent).
 */
export const checkDrafts = (drafts: Draft[]): Errors => {
  const fn = drafts.some((p) => !(p.timestamp_fn > p.timestamp_dt));
  const fnS = drafts.some((p) => !(p.date_fin_saisie > p.timestamp_dt));
  const inside = (d: string, o: Draft) => d >= o.timestamp_dt && d <= o.timestamp_fn;
  const over = drafts.some((p, i) => drafts.some((o, j) => i !== j && (inside(p.timestamp_dt, o) || inside(p.timestamp_fn, o))));
  const daysBetween = (a: string, b: string) => Math.round((new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime()) / 86_400_000);
  const contig = drafts.some((p, i) => {
    const prev = drafts[i - 1];
    const next = drafts[i + 1];
    return (!!prev && daysBetween(prev.timestamp_fn, p.timestamp_dt) > 1) || (!!next && daysBetween(p.timestamp_fn, next.timestamp_dt) > 1);
  });
  return { fn, fnS, over, contig };
};

export const hasError = (e: Errors): boolean => e.fn || e.fnS || e.over || e.contig;

/** Vrai si les classes sélectionnées n'ont pas toutes les mêmes dates que les brouillons (avertissement). */
export const classesDiffer = (selected: Classe[], periods: Map<string, Periode[]>, drafts: Draft[]): boolean =>
  selected.some((c) => {
    const ps = periods.get(c.id) ?? [];
    return ps.length !== drafts.length || ps.some((p, i) => day(p.timestamp_dt) !== drafts[i].timestamp_dt || day(p.timestamp_fn) !== drafts[i].timestamp_fn || day(p.date_fin_saisie) !== drafts[i].date_fin_saisie);
  });

/** Corps de `PUT /viescolaire/periodes`. */
export const periodsPayload = (structureId: string, classIds: string[], drafts: Draft[]) => ({
  idEtablissement: structureId,
  idClasses: classIds,
  periodes: drafts.map((d) => ({
    timestamp_dt: d.timestamp_dt,
    timestamp_fn: d.timestamp_fn,
    date_fin_saisie: d.date_fin_saisie,
    date_conseil_classe: d.date_conseil_classe,
    publication_bulletin: d.publication_bulletin,
  })),
});
