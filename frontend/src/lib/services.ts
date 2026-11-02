/** Service d'enseignement tel que le renvoie `GET /viescolaire/services` : des identifiants, pas de noms. */
export interface RawService {
  id_groupe: string;
  id_groups?: string[];
  id_enseignant: string;
  id_matiere: string;
  modalite?: string;
  evaluable?: boolean;
  coefficient?: number;
  typeGroupe?: string;
  is_visible?: boolean;
  is_manual?: boolean;
  coTeachers?: MultiTeaching[];
  substituteTeachers?: MultiTeaching[];
}

/** Co-enseignant ou remplaçant d'un service (même structure côté serveur). */
export interface MultiTeaching {
  structure_id?: string;
  main_teacher_id?: string;
  second_teacher_id: string;
  subject_id?: string;
  idsAndIdsGroups?: Array<{ id: number; idGroup: string }>;
  start_date?: string;
  end_date?: string;
  entered_end_date?: string;
  is_visible?: boolean;
  /** Nom de l'enseignant, rempli à l'affichage. */
  displayName?: string;
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

/** Classe ou groupe : `type_groupe` 0 classe, 1 groupe d'enseignement, 2 groupe manuel. */
export interface Group {
  id: string;
  name: string;
  type_groupe?: number;
}

export interface SubTopic {
  id: number;
  libelle: string;
  id_structure?: string;
}

/** Une ligne de la liste : le service avec ses noms résolus. */
export interface Service extends RawService {
  topicName: string;
  teacherName: string;
  groupName: string;
  coTeachers: MultiTeaching[];
  substituteTeachers: MultiTeaching[];
  subTopics: SubTopic[];
  searchable: string;
}

export const GROUP_TYPES = [
  { key: "classes", label: "Classes", fallback: "evaluation.service.filter.classes", type: 0 },
  { key: "groups", label: "Groupes d'enseignement", fallback: "evaluation.service.filter.groupes", type: 1 },
  { key: "manualGroups", label: "Groupes manuels", fallback: "evaluation.service.filter.manualGroupes", type: 2 },
] as const;

/** Libellé de la matière, comme l'AngularJS : « Mathématiques (009800 - AAF) ». */
export const topicLabel = (m?: Matiere): string => (m ? `${m.name} (${m.externalId} - ${m.source})` : "");

/**
 * Résout les noms d'un service. Un service dont la matière, l'enseignant ou la classe est inconnu n'est pas affiché
 * (comme l'AngularJS, `hasNullProperty`). Les co-enseignants et remplaçants inconnus sont gardés sans nom.
 */
export const enrich = (raw: RawService[], matieres: Matiere[], teachers: Teacher[], groups: Group[], subTopics: SubTopic[]): Service[] => {
  const mat = new Map(matieres.map((m) => [m.id, m]));
  const tea = new Map(teachers.map((t) => [t.id, t]));
  const grp = new Map(groups.map((g) => [g.id, g]));
  const sub = new Map(subTopics.map((s) => [s.id, s]));
  const named = (list?: MultiTeaching[]) => (list ?? []).map((m) => ({ ...m, displayName: tea.get(m.second_teacher_id)?.displayName ?? "" }));
  const out: Service[] = [];
  for (const s of raw) {
    const m = mat.get(s.id_matiere);
    const t = tea.get(s.id_enseignant);
    const ids = s.id_groups && s.id_groups.length > 0 ? s.id_groups : [s.id_groupe];
    const names = [...new Set(ids.map((id) => grp.get(id)?.name).filter((n): n is string => !!n))].sort((a, b) => a.localeCompare(b));
    if (!m || !t || names.length === 0) continue;
    const coTeachers = named(s.coTeachers);
    const substituteTeachers = named(s.substituteTeachers);
    const topicName = topicLabel(m);
    out.push({
      ...s,
      topicName,
      teacherName: t.displayName,
      groupName: names.join(", "),
      coTeachers,
      substituteTeachers,
      subTopics: (m.sous_matieres ?? []).map((x) => sub.get(x.id_type_sousmatiere)).filter((x): x is SubTopic => !!x),
      searchable: [t.displayName, topicName, ...coTeachers.map((c) => c.displayName), ...substituteTeachers.map((c) => c.displayName)].join(" ").toUpperCase(),
    });
  }
  return out;
};

export type SortKey = "topicName" | "groupName" | "teacherName" | "substitute";

const sortValue = (s: Service, key: SortKey): string => (key === "substitute" ? s.substituteTeachers.map((x) => x.displayName).join(" ") : s[key]);

/** Tri d'une colonne, croissant ou décroissant. */
export const sortServices = (list: Service[], key: SortKey, ascending: boolean): Service[] => {
  const sorted = [...list].sort((a, b) => sortValue(a, key).localeCompare(sortValue(b, key)));
  return ascending ? sorted : sorted.reverse();
};

/**
 * Filtre de recherche : les mots du premier champ (enseignant, matière, co-enseignant, remplaçant) doivent TOUS être
 * trouvés ; les mots « classe » ne gardent que les services dont une classe correspond.
 */
export const filterServices = (list: Service[], words: string[], classWords: string[]): Service[] =>
  list.filter((s) => {
    const okWords = words.every((w) => s.searchable.includes(w.toUpperCase()));
    const okClass = classWords.length === 0 || classWords.some((w) => s.groupName.toUpperCase().includes(w.toUpperCase()));
    return okWords && okClass;
  });

/** Paramètre `filter` de la requête : `classes=true&groups=true&manualGroups=false`. */
export const typeFilterQuery = (selected: Record<string, boolean>): string => GROUP_TYPES.map((g) => `${g.key}=${selected[g.key] !== false}`).join("&");

/** Un même triplet matière / enseignant / classe ne peut exister deux fois (contrôle avant création). */
export const alreadyExists = (services: RawService[], matiereId: string, teacherId: string, classIds: string[]): boolean =>
  !!matiereId && !!teacherId && classIds.some((c) => services.some((s) => s.id_matiere === matiereId && s.id_enseignant === teacherId && ((s.id_groups ?? []).includes(c) || s.id_groupe === c)));

/** Corps de création d'un service (une ligne par classe choisie, regroupées dans `id_groupes`). */
export const createPayload = (structureId: string, teacherId: string, matiereId: string, classIds: string[], evaluable: boolean) => ({
  id_etablissement: structureId,
  id_enseignant: teacherId,
  id_matiere: matiereId,
  id_groupes: classIds,
  modalite: "S",
  evaluable,
  coefficient: 1,
  is_visible: true,
});

/** Chemin de suppression d'un service manuel. */
export const deletePath = (s: Pick<RawService, "id_matiere" | "id_groupe" | "id_groups" | "id_enseignant">): string =>
  `/viescolaire/service?id_matiere=${s.id_matiere}&id_groups=${(s.id_groups && s.id_groups.length > 0 ? s.id_groups : [s.id_groupe]).join(",")}&id_enseignant=${s.id_enseignant}`;
