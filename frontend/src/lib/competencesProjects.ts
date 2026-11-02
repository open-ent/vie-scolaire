/** EPI (1), accompagnement personnalisé (2) ou parcours éducatif (3). */
export type ProjectKind = "EPI" | "AP" | "parcours";

export const KIND_TYPE: Record<ProjectKind, 1 | 2 | 3> = { EPI: 1, AP: 2, parcours: 3 };

export interface Theme {
  id: number;
  libelle: string;
  code?: string | null;
  /** Thème créé par l'établissement (modifiable et supprimable). */
  personnalise?: boolean;
}

export interface Intervenant {
  id: string;
  displayName: string;
}

export interface MatiereRef {
  id: string;
  name: string;
  externalId?: string;
  source?: string;
}

export interface EnsMat {
  intervenant: Intervenant;
  matiere: MatiereRef;
}

export interface GroupeRef {
  id: string;
  name: string;
}

/** Élément du bilan périodique : `GET /competences/elementsBilanPeriodique`. */
export interface Element {
  id: number;
  libelle?: string | null;
  description?: string | null;
  theme?: Theme | null;
  type?: number;
  groupes: GroupeRef[];
  intervenantsMatieres: EnsMat[];
}

/** Élément en cours de saisie dans la fenêtre. */
export interface Draft {
  id?: number;
  idEtablissement: string;
  theme?: Theme;
  libelle: string;
  description: string;
  classes: GroupeRef[];
  ens_mat: EnsMat[];
}

export const MAX_LIBELLE = 150;
export const MAX_DESCRIPTION = 600;

export const emptyDraft = (structureId: string): Draft => ({ idEtablissement: structureId, libelle: "", description: "", classes: [], ens_mat: [] });

export const draftOf = (e: Element, structureId: string): Draft => ({
  id: e.id,
  idEtablissement: structureId,
  theme: e.theme ?? undefined,
  libelle: e.libelle ?? "",
  description: e.description ?? "",
  classes: [...e.groupes],
  ens_mat: [...e.intervenantsMatieres],
});

/** Onglet d'un élément : EPI = thème + libellé, AP = libellé seul, parcours = thème seul. */
export const belongsTo = (kind: ProjectKind, e: Element): boolean =>
  kind === "EPI" ? !!e.theme && !!e.libelle : kind === "AP" ? !e.theme && !!e.libelle : !!e.theme && !e.libelle;

/** Texte de la recherche : libellé, thème, description, intervenants et classes. */
export const matchesSearch = (e: Element, text: string): boolean => {
  const t = text.trim().toLowerCase();
  if (!t) return true;
  const hay = [e.libelle, e.theme?.libelle, e.description, ...e.intervenantsMatieres.map((x) => `${x.intervenant.displayName} ${x.matiere.name}`), ...e.groupes.map((g) => g.name)];
  return hay.some((h) => (h ?? "").toLowerCase().includes(t));
};

export type SortProp = "theme.libelle" | "libelle";

/** Tri par thème ou libellé. L'AngularJS démarre par `theme.libelle` en ordre décroissant (`reverse = true`). */
export const sortElements = (list: Element[], prop: SortProp, reverse: boolean): Element[] => {
  const value = (e: Element) => (prop === "libelle" ? e.libelle ?? "" : e.theme?.libelle ?? "");
  const sorted = [...list].sort((a, b) => value(a).localeCompare(value(b)));
  return reverse ? sorted.reverse() : sorted;
};

/** Clic sur un en-tête : même colonne → inverse l'ordre, autre colonne → croissant. */
export const nextSort = (cur: { prop: SortProp; reverse: boolean }, prop: SortProp): { prop: SortProp; reverse: boolean } =>
  cur.prop === prop ? { prop, reverse: !cur.reverse } : { prop, reverse: false };

/** Matières distinctes parmi les intervenants, et présence d'une matière en double. */
export const distinctSubjects = (ensMat: EnsMat[]): { ids: string[]; size: number; hasTwoTimes: boolean } => {
  const count = new Map<string, number>();
  for (const x of ensMat) count.set(x.matiere.id, (count.get(x.matiere.id) ?? 0) + 1);
  return { ids: [...count.keys()], size: count.size, hasTwoTimes: [...count.values()].some((n) => n > 1) };
};

/**
 * Vrai quand l'enregistrement doit rester bloqué.
 * EPI : thème, libellé, au moins 2 intervenants de 2 matières différentes, une classe. AP : libellé, 1 intervenant, une classe.
 * Parcours : thème, une classe.
 */
export const isDraftIncomplete = (kind: ProjectKind, d: Draft, newClasses: GroupeRef[]): boolean => {
  const noClass = d.classes.length === 0 && newClasses.length === 0;
  const sub = distinctSubjects(d.ens_mat);
  if (kind === "EPI") return !d.theme || d.libelle.trim() === "" || d.ens_mat.length < 2 || noClass || sub.size < 2 || sub.hasTwoTimes;
  if (kind === "AP") return d.libelle.trim() === "" || d.ens_mat.length < 1 || noClass || sub.hasTwoTimes;
  return !d.theme || noClass;
};

/**
 * Libellé déjà pris : avec un thème, même libellé sur le même thème ; sans thème, même libellé.
 * `ownId` exclut l'élément qu'on modifie.
 */
export const labelExists = (elements: Element[], d: Pick<Draft, "libelle" | "theme">, ownId?: number): boolean =>
  elements.some((e) => e.id !== ownId && e.libelle === d.libelle && (d.theme ? e.theme?.libelle === d.theme.libelle : true));

/** Ajoute un couple intervenant / matière sans doublon. */
export const addEnsMat = (list: EnsMat[], intervenant: Intervenant, matiere: MatiereRef): EnsMat[] =>
  list.some((x) => x.intervenant.id === intervenant.id && x.matiere.id === matiere.id) ? list : [...list, { intervenant, matiere }];

/** Matières encore proposables : celles qui n'ont pas déjà un intervenant. */
export const freeSubjects = <T extends { id: string }>(matieres: T[], ensMat: EnsMat[]): T[] => {
  const used = new Set(ensMat.map((x) => x.matiere.id));
  return matieres.filter((m) => !used.has(m.id));
};

/** Classes à envoyer à la modification : celles déjà liées, plus les nouvelles choisies. */
export const mergeClasses = (current: GroupeRef[], added: GroupeRef[]): GroupeRef[] => [...current, ...added.filter((a) => !current.some((c) => c.id === a.id))];

/** Corps de création ou de modification (l'AngularJS envoie l'objet saisi tel quel, plus l'identifiant du thème). */
export const elementPayload = (kind: ProjectKind, d: Draft, newClasses: GroupeRef[], editing: boolean) => ({
  ...(d.id !== undefined ? { id: d.id } : {}),
  idEtablissement: d.idEtablissement,
  ...(d.theme ? { theme: d.theme, id_theme: d.theme.id } : {}),
  type: KIND_TYPE[kind],
  classes: editing ? mergeClasses(d.classes, newClasses) : newClasses,
  ens_mat: d.ens_mat,
  libelle: d.libelle,
  // une description vide n'est pas envoyée en modification
  ...(editing && d.description === "" ? {} : { description: d.description }),
});

/** Suppression de plusieurs éléments : un `idElement` par élément. */
export const deleteElementsQuery = (structureId: string, ids: number[]): string =>
  `idEtablissement=${structureId}${ids.map((i) => `&idElement=${i}`).join("")}`;

/** Thèmes proposés : standard ou personnalisés, par ordre alphabétique. */
export const themesOf = (themes: Theme[], custom: boolean): Theme[] => themes.filter((t) => !!t.personnalise === custom).sort((a, b) => a.libelle.localeCompare(b.libelle));

/** Un thème de même libellé existe déjà. */
export const themeExists = (themes: Theme[], libelle: string, ownId?: number): boolean => themes.some((t) => t.libelle === libelle && t.id !== ownId);
