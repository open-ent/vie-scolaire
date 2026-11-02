/** Valeur « plusieurs valeurs différentes » (clé i18n `multiples`) quand les classes d'un service divergent. */
export const MULTIPLES = "multiples";

/** Paramétrage d'une classe ou d'un groupe d'un service (`competencesParams`). */
export interface Param {
  id_groupe: string;
  modalite: string;
  evaluable: boolean;
  coefficient: number | string | null;
  nom_groupe?: string;
}

export interface MultiTeacher {
  structure_id?: string;
  main_teacher_id?: string;
  second_teacher_id: string;
  subject_id?: string;
  idsAndIdsGroups?: Array<{ id: number; idGroup: string }>;
  start_date?: string;
  end_date?: string;
  entered_end_date?: string;
  is_visible?: boolean;
  displayName?: string;
}

/** Service tel que le renvoie `GET /viescolaire/services` (avec `competencesParams` quand le module Compétences est actif). */
export interface RawService {
  id_groupe: string;
  id_groups?: string[];
  id_enseignant: string;
  id_matiere: string;
  modalite?: string;
  evaluable?: boolean;
  coefficient?: number | string | null;
  is_visible?: boolean;
  coTeachers?: MultiTeacher[];
  substituteTeachers?: MultiTeacher[];
  competencesParams?: Param[];
}

export interface Group {
  id: string;
  name: string;
  type_groupe?: number;
}

export interface Matiere {
  id: string;
  name: string;
  externalId?: string;
  source?: string;
  sous_matieres?: Array<{ id_type_sousmatiere: number }>;
}

export interface Teacher {
  id: string;
  displayName: string;
}

export interface SubTopicType {
  id: number;
  libelle: string;
}

/** Coefficient d'une sous-matière pour un enseignant, une matière et un groupe. */
export interface SubTopicRow {
  libelle: string;
  id_structure: string;
  id_teacher: string;
  id_group: string;
  id_topic: string;
  id_subtopic: number | string;
  coefficient: number;
}

export interface SubTopicStored {
  id_structure?: string;
  id_teacher: string;
  id_group: string;
  id_topic: string;
  id_subtopic: number | string;
  coefficient: number | string;
}

/** Ligne de la liste : le service, ses noms résolus et ses classes. */
export interface Row extends RawService {
  id_etablissement: string;
  topicName: string;
  nom_enseignant: string;
  /** Nom du groupe principal du service. */
  nom_groupe: string;
  groups: Group[];
  groupsName: string;
  params: Param[];
  coTeachers: MultiTeacher[];
  substituteTeachers: MultiTeacher[];
  coTeachersName: string;
  substituteTeachersName: string;
  subTopics: SubTopicRow[];
}

export interface Context {
  structureId: string;
  classes: Group[];
  matieres: Matiere[];
  teachers: Teacher[];
  subTopicTypes: SubTopicType[];
  subTopicStored: SubTopicStored[];
}

export const topicLabel = (m: Matiere): string => `${m.name} (${m.externalId} - ${m.source})`;

const num = (v: unknown): number => Number(v);
/** Coefficient d'un service : 1 quand le serveur n'en donne pas. */
export const baseCoefficient = (s: RawService): number | string => (s.coefficient === null || s.coefficient === undefined ? 1 : s.coefficient);

/**
 * Valeurs affichées dans la ligne : si une classe diffère du service, la modalité devient « multiples »
 * et le coefficient reste vide (placeholder « Multiples »).
 */
export const mergedValues = (s: RawService): { modalite: string; coefficient: number | undefined; multipleCoefficient: boolean } => {
  const params = s.competencesParams ?? [];
  const coef = baseCoefficient(s);
  const otherModalite = params.some((p) => p.modalite !== s.modalite);
  const otherCoef = params.some((p) => num(p.coefficient) !== num(coef));
  return { modalite: otherModalite ? MULTIPLES : s.modalite ?? "", coefficient: otherCoef ? undefined : num(coef), multipleCoefficient: otherCoef };
};

const byName = (a: Group, b: Group) => a.name.localeCompare(b.name);

/**
 * Résout les noms d'un service ; un service sans enseignant, groupe principal ou matière connus n'est pas listé.
 * Les groupes viennent des paramètres par classe s'il y en a, sinon du groupe principal.
 */
export const enrich = (raw: RawService[], ctx: Context): Row[] => {
  const out: Row[] = [];
  for (const s of raw) {
    const teacher = ctx.teachers.find((t) => t.id === s.id_enseignant);
    const main = ctx.classes.find((c) => c.id === s.id_groupe);
    const matiere = ctx.matieres.find((m) => m.id === s.id_matiere);
    if (!teacher || !main || !matiere) continue;
    const params = (s.competencesParams ?? []).map((p) => ({ ...p, nom_groupe: ctx.classes.find((c) => c.id === p.id_groupe)?.name }));
    const groups = params.length > 0 ? [...new Map(params.map((p) => [p.id_groupe, ctx.classes.find((c) => c.id === p.id_groupe)] as const).filter((e): e is [string, Group] => !!e[1])).values()].sort(byName) : [main];
    const named = (list?: MultiTeacher[]) => (list ?? []).map((m) => ({ ...m, displayName: ctx.teachers.find((t) => t.id === m.second_teacher_id)?.displayName ?? "" }));
    const coTeachers = named(s.coTeachers);
    const substituteTeachers = named(s.substituteTeachers);
    const subTopics: SubTopicRow[] = [];
    for (const sm of matiere.sous_matieres ?? []) {
      const type = ctx.subTopicTypes.find((t) => t.id === sm.id_type_sousmatiere);
      if (!type) continue;
      const stored = ctx.subTopicStored.find((x) => x.id_teacher === s.id_enseignant && x.id_topic === s.id_matiere && x.id_group === s.id_groupe && x.id_subtopic === sm.id_type_sousmatiere);
      subTopics.push({
        libelle: type.libelle,
        id_structure: ctx.structureId,
        id_teacher: s.id_enseignant,
        id_group: s.id_groupe,
        id_topic: s.id_matiere,
        id_subtopic: sm.id_type_sousmatiere,
        coefficient: stored ? parseFloat(String(stored.coefficient)) : 1,
      });
    }
    out.push({
      ...s,
      id_etablissement: ctx.structureId,
      topicName: topicLabel(matiere),
      nom_enseignant: teacher.displayName,
      nom_groupe: main.name,
      groups,
      groupsName: groups.map((g) => g.name).join(", "),
      params,
      coTeachers,
      substituteTeachers,
      coTeachersName: coTeachers.map((c) => c.displayName).filter(Boolean).join(" "),
      substituteTeachersName: substituteTeachers.map((c) => c.displayName).filter(Boolean).join(" "),
      subTopics,
    });
  }
  return out;
};

/** Case « évaluable » : tout coché, tout décoché ou mixte (par classe). */
export type EvaluableState = "all" | "none" | "various";
export const evaluableState = (r: Pick<Row, "params" | "evaluable">): EvaluableState => {
  if (r.params.length === 0) return r.evaluable ? "all" : "none";
  const n = r.params.filter((p) => p.evaluable).length;
  return n === r.params.length ? "all" : n === 0 ? "none" : "various";
};

// --- visibilité aux élèves / parents (l'œil) -------------------------------------------------------------------

/** Remplaçant en cours : aujourd'hui entre le début et la fin de saisie (jours inclus). Ex. 2026-10-12 dans [2026-10-01, 2026-10-31]. */
export const isCurrentSubstitute = (m: MultiTeacher, today: string): boolean => {
  const d = (v?: string) => (v ?? "").slice(0, 10);
  return !!m.start_date && d(m.start_date) <= today && today <= d(m.entered_end_date);
};

const visibleOthers = (r: Pick<Row, "coTeachers" | "substituteTeachers">, today: string, except?: string): MultiTeacher[] =>
  [...r.coTeachers.filter((c) => c.is_visible === true), ...r.substituteTeachers.filter((s) => s.is_visible === true && isCurrentSubstitute(s, today))].filter((m) => m.second_teacher_id !== except);

/** Œil de l'enseignant principal bloqué : il est visible et plus personne d'autre ne l'est (il faut un visible au moins). */
export const mainEyeLocked = (r: Pick<Row, "is_visible" | "coTeachers" | "substituteTeachers">, today: string): boolean =>
  r.is_visible ? visibleOthers(r, today).length === 0 : false;

/** Œil d'un co-enseignant ou remplaçant bloqué : il est visible et ni l'enseignant principal ni un autre ne l'est. */
export const multiEyeLocked = (r: Pick<Row, "is_visible" | "coTeachers" | "substituteTeachers">, m: MultiTeacher, today: string): boolean =>
  m.is_visible ? !(r.is_visible || visibleOthers(r, today, m.second_teacher_id).length > 0) : false;

// --- tri, recherche ---------------------------------------------------------------------------------------------

export type SortKey = "topicName" | "nom_groupe" | "nom_enseignant" | "remplacement" | "coefficient" | "modalite" | "evaluable";

const sortValue = (r: Row, k: SortKey): string | number => {
  const m = mergedValues(r);
  switch (k) {
    case "remplacement":
      return r.substituteTeachersName;
    case "coefficient":
      return m.coefficient ?? -1;
    case "modalite":
      return m.modalite;
    case "evaluable":
      return evaluableState(r) === "all" ? 2 : evaluableState(r) === "various" ? 1 : 0;
    default:
      return r[k];
  }
};

export const sortRows = (rows: Row[], key: SortKey, ascending: boolean): Row[] => {
  const sorted = [...rows].sort((a, b) => {
    const x = sortValue(a, key);
    const y = sortValue(b, key);
    return typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
  });
  return ascending ? sorted : sorted.reverse();
};

/** Clic sur un en-tête : même colonne → inverse, autre colonne → croissant. */
export const nextSortState = (cur: { key: SortKey; asc: boolean }, key: SortKey): { key: SortKey; asc: boolean } => (cur.key === key ? { key, asc: !cur.asc } : { key, asc: true });

/** Mot saisi (Entrée) : « classe » s'il correspond à une classe d'un service, sinon mot libre. Null si déjà présent. */
export const classifyWord = (raw: string, rows: Row[], words: string[], classWords: string[]): { kind: "class" | "word"; value: string } | null => {
  const value = raw.trim().toUpperCase();
  if (!value) return null;
  const isClass = rows.some((r) => r.groupsName.toUpperCase().includes(value) || r.nom_groupe.toUpperCase().includes(value));
  if (isClass) return classWords.includes(value) ? null : { kind: "class", value };
  return words.includes(value) ? null : { kind: "word", value };
};

/**
 * Applique les mots : tous les mots libres doivent se trouver dans l'enseignant, la matière, un co-enseignant ou un remplaçant ;
 * les mots « classe » ne gardent que les services ayant une classe correspondante et ne montrent que ces classes.
 */
export const applyWords = (rows: Row[], words: string[], classWords: string[]): Row[] => {
  const out: Row[] = [];
  for (const r of rows) {
    const hay = [r.nom_enseignant, r.topicName, r.coTeachersName, r.substituteTeachersName].map((x) => x.toUpperCase());
    if (!words.every((w) => hay.some((h) => h.includes(w.toUpperCase())))) continue;
    if (classWords.length === 0) {
      out.push(r);
      continue;
    }
    const groups = r.groups.filter((g) => classWords.some((w) => g.name.toUpperCase().includes(w.toUpperCase())));
    if (groups.length === 0) continue;
    const ids = groups.map((g) => g.id);
    out.push({ ...r, groups, groupsName: groups.map((g) => g.name).join(", "), id_groups: ids, params: r.params.filter((p) => ids.includes(p.id_groupe)) });
  }
  return out;
};

/** Filtres de type de groupe et d'évaluabilité ; la requête reprend les noms du serveur. */
export interface Filters {
  classes: boolean;
  groups: boolean;
  manualGroups: boolean;
  evaluable: boolean;
  notEvaluable: boolean;
}
export const DEFAULT_FILTERS: Filters = { classes: true, groups: true, manualGroups: true, evaluable: true, notEvaluable: false };
export const filtersQuery = (f: Filters): string => (Object.keys(DEFAULT_FILTERS) as Array<keyof Filters>).map((k) => `${k}=${f[k]}`).join("&");

// --- enregistrement ---------------------------------------------------------------------------------------------

/** Groupes d'un service pour les envois : ceux du service, sinon le groupe principal. */
const groupIds = (r: Pick<Row, "id_groups" | "id_groupe">): string[] => (r.id_groups && r.id_groups.length > 0 ? r.id_groups : [r.id_groupe]);

/** Corps de `PUT /viescolaire/service` (un service, tous ses groupes). */
export const servicePayload = (r: Row) => ({
  id_etablissement: r.id_etablissement,
  id_enseignant: r.id_enseignant,
  id_matiere: r.id_matiere,
  id_groupes: groupIds(r),
  modalite: r.modalite,
  evaluable: r.evaluable,
  coefficient: baseCoefficient(r),
  is_visible: r.is_visible,
});

/** Corps de `PUT /viescolaire/services` : une ligne par classe ; modalité ou coefficient forcés pour toutes si fournis. */
export const paramsPayload = (r: Row, params: Param[], force: { modalite?: string; coefficient?: number } = {}) => ({
  services: params.map((p) => ({
    id_etablissement: r.id_etablissement,
    id_enseignant: r.id_enseignant,
    id_matiere: r.id_matiere,
    id_groupes: [p.id_groupe],
    modalite: force.modalite ?? p.modalite,
    evaluable: p.evaluable,
    coefficient: force.coefficient ?? p.coefficient,
  })),
});

/** Bascule « évaluable » de toutes les classes. */
export const withEvaluable = (params: Param[], evaluable: boolean): Param[] => params.map((p) => ({ ...p, evaluable }));

/** Coefficient saisi valide (nombre ≥ 0). */
export const validCoefficient = (v: string): number | null => {
  const n = Number(v);
  return v.trim() !== "" && Number.isFinite(n) && n >= 0 ? n : null;
};

export const subTopicPayload = (s: SubTopicRow, groups: Group[]) => ({
  coefficient: s.coefficient,
  id_teacher: s.id_teacher,
  id_group: s.id_group,
  id_topic: s.id_topic,
  id_subtopic: s.id_subtopic,
  id_structure: s.id_structure,
  groups,
});

export const multiVisibilityPayload = (m: MultiTeacher) => ({
  structure_id: m.structure_id,
  main_teacher_id: m.main_teacher_id,
  second_teacher_ids: m.second_teacher_id,
  subject_id: m.subject_id,
  class_or_group_ids: (m.idsAndIdsGroups ?? []).map((x) => x.idGroup),
  is_visible: !m.is_visible,
});

/** Chemin de la recherche des devoirs liés (cases décochées : tous les groupes du service, ou ceux fournis). */
export const homeworkQuery = (r: Pick<Row, "id_etablissement" | "id_matiere" | "id_enseignant" | "id_groupe" | "id_groups">, groupIdsOverride?: string[]): string =>
  `idEtablissement=${r.id_etablissement}&id_matiere=${r.id_matiere}&id_enseignant=${r.id_enseignant}&id_groups=${(groupIdsOverride ?? groupIds(r)).join(",")}`;

/** Classes dont « évaluable » passe de coché à décoché : seules elles peuvent porter des devoirs. */
export const switchedOff = (before: Param[], after: Param[]): Param[] => after.filter((p) => !p.evaluable && before.find((b) => b.id_groupe === p.id_groupe)?.evaluable);

/** Corps du nouveau service créé quand les devoirs sont déplacés vers une autre matière. */
export const movedServicePayload = (r: Row, matiereId: string) => ({ ...servicePayload(r), id_matiere: matiereId, evaluable: true, id_groupes: groupIds(r) });

/** Texte de l'avertissement : « [nbDevoir] » est remplacé par le nombre de devoirs. */
export const homeworkMessage = (template: string, n: number): string => template.replace("[nbDevoir]", String(n));
