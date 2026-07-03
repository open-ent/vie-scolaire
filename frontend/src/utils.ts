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
