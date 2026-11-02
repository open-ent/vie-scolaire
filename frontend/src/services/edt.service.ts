// Services de l'onglet « Emploi du temps » : portés du module EDT (même routes), appels directs avec jeton CSRF.

function xsrfHeader(): Record<string, string> {
  const m = typeof document !== 'undefined' ? document.cookie.match(/XSRF-TOKEN=([^;]+)/) : null;
  return m ? { 'X-XSRF-TOKEN': decodeURIComponent(m[1]) } : {};
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(String(res.status));
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

const base = { credentials: 'include' as const };
const mutHeaders = () => ({ 'Content-Type': 'application/json', ...xsrfHeader() });

export interface CourseTag {
  id: number;
  label: string;
  abbreviation?: string;
  isHidden?: boolean;
  /** Prioritaire à l'affichage quand deux cours se superposent. */
  isPrimary?: boolean;
  /** Un appel (présences) est associé aux cours portant cette étiquette. */
  allowRegister?: boolean;
  /** Déjà posée sur des cours : se masque, ne se supprime pas. */
  isUsed?: boolean;
}

/** Étiquette saisie dans l'administration, ex. { label: "Sortie", abbreviation: "SOR", isPrimary: false, allowRegister: true }. */
export interface CourseTagInput {
  label: string;
  abbreviation: string;
  isPrimary: boolean;
  allowRegister: boolean;
}

const tagRequest = async (url: string, method: string, body?: unknown): Promise<void> => {
  const res = await fetch(url, { ...base, method, headers: mutHeaders(), body: body === undefined ? undefined : JSON.stringify(body) });
  if (!res.ok) throw new Error(String(res.status));
};

/** Rapport d'un import STS précédent : date et texte du rapport (gabarit sts-report.txt du serveur). */
export interface StsReport {
  created?: string | { $date?: string | number };
  report: string;
}

/** Rapports des imports STS de l'établissement, du plus récent au plus ancien. */
export const getStsReports = async (structureId: string): Promise<StsReport[]> =>
  (await json<StsReport[]>(await fetch(`/edt/structures/${structureId}/sts/reports`, base))) ?? [];

/**
 * Import STS (deux fichiers XML, STS-EMP et EMP-STS), comme le sniplet AngularJS : envoi multipart
 * (sans Content-Type JSON). Réponse : { report } ; en cas d'échec, l'erreur porte une clé de libellé,
 * ex. « edt.sts.import.error.unauthorized ».
 */
export const importSts = async (structureId: string, stsEmp: File, empSts: File): Promise<{ ok: boolean; report?: string; error?: string }> => {
  const form = new FormData();
  form.append('file1', stsEmp);
  form.append('file2', empSts);
  const res = await fetch(`/edt/structures/${structureId}/sts`, { ...base, method: 'POST', headers: xsrfHeader(), body: form });
  const body = (await res.json().catch(() => null)) as { report?: string; error?: string } | null;
  return res.ok ? { ok: true, report: body?.report } : { ok: false, error: body?.error };
};

// ── Exclusions de périodes (périodes fermées, module viescolaire) ──────────────
/** Période fermée de l'établissement, ex. { description: "Vacances de printemps", start_date: "2027-04-17 00:00:00", … }. */
export interface Exclusion {
  id: number;
  description: string;
  start_date: string;
  end_date: string;
  id_structure?: string;
}

/** Exclusions de l'établissement, comme Exclusions.sync de l'AngularJS. */
export const getExclusions = async (structureId: string): Promise<Exclusion[]> =>
  (await json<Exclusion[]>(await fetch(`/viescolaire/settings/periodes/exclusions?structureId=${structureId}`, base))) ?? [];

/** Création (sans id) ou modification ; dates « YYYY-MM-DD », journées entières comme Exclusion.toJSON. */
export const saveExclusion = async (structureId: string, ex: { id?: number; description: string; start: string; end: string }): Promise<void> => {
  const body = { description: ex.description, start_date: `${ex.start} 00:00:00`, end_date: `${ex.end} 23:59:59`, id_structure: structureId };
  const res = await fetch(ex.id ? `/viescolaire/settings/exclusion/${ex.id}` : '/viescolaire/settings/exclusion', {
    ...base,
    method: ex.id ? 'PUT' : 'POST',
    headers: mutHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(String(res.status));
};

export const deleteExclusion = async (id: number): Promise<void> => {
  const res = await fetch(`/viescolaire/settings/exclusion/${id}`, { ...base, method: 'DELETE', headers: mutHeaders() });
  if (!res.ok) throw new Error(String(res.status));
};

/** Nombre de cours déjà programmés sur une période (avertissement avant de la fermer). */
export const countCoursesBetween = async (structureId: string, start: string, end: string): Promise<number> => {
  const res = await fetch(`/viescolaire/common/courses/${structureId}/${start}/${end}`, base);
  if (!res.ok) return 0;
  const body = await res.json().catch(() => []);
  return Array.isArray(body) ? body.length : 0;
};

/**
 * Zones de vacances acceptées par le serveur (InitController.isValidZone, données
 * data.education.gouv.fr), avec la clé de leur libellé. Ex. { value: "Zone B", label: "edt.zone.select.ZoneB" }.
 */
export const HOLIDAYS_ZONES: Array<{ value: string; label: string }> = [
  { value: 'Zone A', label: 'edt.zone.select.ZoneA' },
  { value: 'Zone B', label: 'edt.zone.select.ZoneB' },
  { value: 'Zone C', label: 'edt.zone.select.ZoneC' },
  { value: 'Corse', label: 'edt.zone.select.Corse' },
  { value: 'Guadeloupe', label: 'edt.zone.select.Guadeloupe' },
  { value: 'Guyane', label: 'edt.zone.select.Guyane' },
  { value: 'Martinique', label: 'edt.zone.select.Martinique' },
  { value: 'Mayotte', label: 'edt.zone.select.Mayotte' },
  { value: 'Nouvelle Calédonie', label: 'edt.zone.select.NouvelleCaledonie' },
  { value: 'Polynésie', label: 'edt.zone.select.Polynesie' },
  { value: 'Réunion', label: 'edt.zone.select.Reunion' },
  { value: 'Saint Pierre et Miquelon', label: 'edt.zone.select.SaintPierreEtMiquelon' },
  { value: 'Wallis et Futuna', label: 'edt.zone.select.WallisEtFutuna' },
];

/**
 * Initialise les données de l'année de l'établissement (dates, vacances de la zone) dans les modules
 * de vie scolaire, comme structureService.initStructureData de l'AngularJS. Dates « YYYY-MM-DD ».
 */
export const initStructureData = async (structureId: string, zone: string, start: string, end: string): Promise<void> => {
  const q = new URLSearchParams({ zone, schoolYearStartDate: `${start} 00:00:00`, schoolYearEndDate: `${end} 23:59:59` });
  const res = await fetch(`/edt/init/${structureId}?${q.toString()}`, base);
  if (!res.ok) throw new Error(String(res.status));
};

/** Administration des étiquettes de cours, mêmes routes que l'AngularJS (services/courseTag.service.ts). */
export const createCourseTag = (structureId: string, tag: CourseTagInput) => tagRequest(`/edt/structures/${structureId}/course/tag`, 'POST', tag);
export const updateCourseTag = (id: number, tag: CourseTagInput) => tagRequest('/edt/course/tag', 'PUT', { ...tag, id });
export const deleteCourseTag = (structureId: string, id: number) => tagRequest(`/edt/structures/${structureId}/course/tag/${id}`, 'DELETE');
export const setCourseTagHidden = (structureId: string, id: number, isHidden: boolean) =>
  tagRequest(`/edt/structures/${structureId}/course/tag/${id}/hidden`, 'PUT', { isHidden });

export const getCourseTags = async (structureId: string): Promise<CourseTag[]> =>
  (await json<CourseTag[]>(await fetch(`/edt/structures/${structureId}/course/tags`, base))) ?? [];


export const getSchoolYear = async (structureId: string): Promise<{ start: string; end: string } | null> => {
  const res = await fetch(`/viescolaire/settings/periode/schoolyear?structureId=${structureId}`, base);
  if (!res.ok) return null;
  const body = (await res.json().catch(() => null)) as { id?: number; start_date?: string; end_date?: string } | null;
  return body?.id !== undefined && body.start_date && body.end_date ? { start: body.start_date.slice(0, 10), end: body.end_date.slice(0, 10) } : null;
};

export const api = { getStsReports, importSts, initStructureData, createCourseTag, updateCourseTag, deleteCourseTag, setCourseTagHidden, getCourseTags, getSchoolYear };
