/** Fonctions pures du module Vie scolaire (testables). */

const pad = (n: number) => String(n).padStart(2, '0');

/** Format « YYYY-MM-DD » d'une Date. */
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Formate une date backend (ISO « YYYY-MM-DD… » ou « jj/mm/aaaa ») en « jj/mm/aaaa » (locale FR).
 * Renvoie '' si vide/illisible.
 */
export function formatDate(s?: string): string {
  if (!s) return '';
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const fr = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(s);
  if (fr) return `${fr[1]}/${fr[2]}/${fr[3]}`;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('fr-FR');
}

/** Libellé lisible d'une période à partir de son type (numéro) et d'une table de libellés. */
export function periodeLabel(type: number | undefined, labels: Map<number, string>): string {
  if (type == null) return '—';
  return labels.get(type) ?? `Période ${type}`;
}

/** Comparateur alphabétique FR insensible à la casse/accents (pour trier classes/matières). */
export function byName<T extends { name: string }>(a: T, b: T): number {
  return a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' });
}

/** Résout un identifiant en libellé via une table, ou renvoie l'identifiant brut en repli. */
export function resolveName(id: string, table: Map<string, string>): string {
  return table.get(id) ?? id;
}

/** Comparateur alphabétique FR sur une chaîne (insensible casse/accents). */
export function compareFr(a: string, b: string): number {
  return a.localeCompare(b, 'fr', { sensitivity: 'base' });
}

/** Bornes d'une période du découpage (dates « YYYY-MM-DD »). */
export interface DecoupagePeriode {
  timestamp_dt: string;
  timestamp_fn: string;
  date_fin_saisie: string;
  date_conseil_classe: string;
  publication_bulletin: boolean;
}

/**
 * Découpe l'année scolaire [start, end] en `nb` périodes de durée égale.
 * Pour chaque période : début/fin calculés, fin de saisie & conseil de classe alignés sur la fin.
 * Sert de proposition par défaut, éditable ensuite dans le formulaire.
 */
export function decoupageAnnee(nb: number, start?: string, end?: string): DecoupagePeriode[] {
  const s = start ? new Date(start) : null;
  const e = end ? new Date(end) : null;
  if (!s || !e || Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || nb < 1) return [];
  const total = e.getTime() - s.getTime();
  const step = total / nb;
  const out: DecoupagePeriode[] = [];
  for (let i = 0; i < nb; i += 1) {
    const dt = new Date(s.getTime() + step * i);
    const fn = new Date(i === nb - 1 ? e.getTime() : s.getTime() + step * (i + 1) - 86400000);
    const fin = ymd(fn);
    out.push({
      timestamp_dt: ymd(dt),
      timestamp_fn: fin,
      date_fin_saisie: fin,
      date_conseil_classe: fin,
      publication_bulletin: false,
    });
  }
  return out;
}
