/** Item de compétence (ou connaissance quand il porte des items) du référentiel de l'établissement. */
export interface Competence {
  id: number;
  nom: string;
  id_cycle: number;
  id_enseignement: number;
  ids_domaine_int?: number[] | null;
  /** Item créé par l'établissement (modifiable et supprimable). */
  ismanuelle?: boolean;
  masque?: boolean;
  /** Libellé personnalisé d'un item du référentiel (réinitialisable). */
  hasnameperso?: boolean;
  code_domaine?: string | null;
  index?: number;
  competences_2?: Competence[];
  competences?: Competence[];
}

/** Réponse brute de `GET /competences/enseignements?idStructure=`. */
export interface EnseignementRaw {
  id: number;
  nom: string;
  ids_domaine_int?: number[] | null;
  competences_1?: Competence[];
}

export interface Enseignement {
  id: number;
  nom: string;
  /** Connaissances de l'enseignement ; chacune porte ses items dans `competences`. */
  competences: Competence[];
}

/** Domaine du socle, en arbre : `GET /competences/domaines?idStructure=`. */
export interface Domaine {
  id: number;
  niveau: number;
  libelle: string;
  codification: string;
  id_cycle: number;
  domaines?: Domaine[];
  competences?: Competence[];
}

/** Aplatit `competences_1` / `competences_2` en `competences`. */
export const buildEnseignements = (raw: EnseignementRaw[]): Enseignement[] =>
  raw.map((e) => ({
    id: e.id,
    nom: e.nom,
    competences: (e.competences_1 ?? []).map((c) => ({ ...c, competences: c.competences_2 ?? [], competences_2: undefined })),
  }));

/** Enseignements d'un cycle : seules les connaissances de ce cycle restent, un enseignement vide disparaît. */
export const enseignementsOfCycle = (list: Enseignement[], idCycle: number | null): Enseignement[] =>
  list
    .map((e) => ({ ...e, competences: e.competences.filter((c) => c.id_cycle === idCycle) }))
    .filter((e) => e.competences.length > 0);

export const domainesOfCycle = (list: Domaine[], idCycle: number | null): Domaine[] => list.filter((d) => d.id_cycle === idCycle);

/** Mot recherché présent dans le texte, sans tenir compte de la casse ; un mot vide ne correspond à rien. */
export const containsIgnoreCase = (text: string | null | undefined, keyword: string): boolean =>
  keyword.trim() !== "" && (text ?? "").toLowerCase().includes(keyword.toLowerCase());

/** Un item correspond à la recherche par son nom ou par le code de son domaine. */
export const matchesCompetence = (c: Competence, keyword: string): boolean => containsIgnoreCase(c.nom, keyword) || containsIgnoreCase(c.code_domaine, keyword);

/** Découpe un texte pour surligner le mot : « Lire un texte » + « lire » → [{Lire, hit}, { un texte}]. */
export const highlightParts = (text: string, keyword: string): Array<{ text: string; hit: boolean }> => {
  if (keyword.trim() === "") return [{ text, hit: false }];
  const lower = text.toLowerCase();
  const k = keyword.toLowerCase();
  const out: Array<{ text: string; hit: boolean }> = [];
  let from = 0;
  for (let i = lower.indexOf(k); i >= 0; i = lower.indexOf(k, from)) {
    if (i > from) out.push({ text: text.slice(from, i), hit: false });
    out.push({ text: text.slice(i, i + k.length), hit: true });
    from = i + k.length;
  }
  if (from < text.length) out.push({ text: text.slice(from), hit: false });
  return out;
};

/** Une section (enseignement ou connaissance) est dépliée de force quand elle contient un résultat de recherche. */
export const hasMatch = (c: Competence | Enseignement, keyword: string): boolean =>
  keyword.trim() !== "" &&
  (containsIgnoreCase(c.nom, keyword) || (c.competences ?? []).some((x) => matchesCompetence(x, keyword) || hasMatch(x, keyword)));

/** Domaine contenant, à un niveau quelconque, un item qui correspond au mot (recherche sur le nom seul, comme l'AngularJS). */
export const domaineHasMatch = (d: Domaine, keyword: string): boolean =>
  (d.competences ?? []).some((c) => containsIgnoreCase(c.nom, keyword)) || (d.domaines ?? []).some((x) => domaineHasMatch(x, keyword));

/** Items d'une connaissance dans l'ordre d'affichage : `index` du serveur, à défaut la position reçue. */
export const orderedItems = (items: Competence[]): Competence[] =>
  items.map((c, i) => ({ ...c, index: c.index ?? i })).sort((a, b) => (a.index as number) - (b.index as number));

/**
 * Déplace un item d'un cran (-1 vers le haut, +1 vers le bas) ; renvoie null au bord de la liste.
 * Ex. [A, B, C], déplacer B de -1 → [B, A, C].
 */
export const moveItem = (items: Competence[], id: number, delta: -1 | 1): Competence[] | null => {
  const list = orderedItems(items);
  const from = list.findIndex((c) => c.id === id);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= list.length) return null;
  const [x] = list.splice(from, 1);
  list.splice(to, 0, x);
  return list.map((c, i) => ({ ...c, index: i }));
};

/** Corps de réordonnancement : tous les items de la connaissance avec leur nouveau rang. */
export const orderPayload = (items: Competence[], structureId: string) => ({
  index: items.map((c) => ({ id: c.id, id_etablissement: structureId, id_enseignement: c.id_enseignement, index: c.index })),
});

/** Item en cours de création sous une connaissance (id_type 2 = item). */
export interface NewItem {
  nom: string;
  id_parent: number;
  id_cycle: number;
  id_enseignement: number;
  id_type: 2;
  ids_domaine: number[];
  id_etablissement: string;
}

/** Nouvel item : il hérite des domaines de sa connaissance. */
export const newItemFor = (connaissance: Competence, structureId: string): NewItem => ({
  nom: "",
  id_parent: connaissance.id,
  id_cycle: connaissance.id_cycle,
  id_enseignement: connaissance.id_enseignement,
  id_type: 2,
  ids_domaine: connaissance.ids_domaine_int ? [...connaissance.ids_domaine_int] : [],
  id_etablissement: structureId,
});

/** Enregistrement possible : un nom et au moins un domaine. */
export const canSaveItem = (item: NewItem): boolean => item.nom.trim() !== "" && item.ids_domaine.length > 0;

/** Ajoute ou retire un domaine de la sélection. */
export const toggleDomaine = (ids: number[], id: number, selected: boolean): number[] => (selected ? (ids.includes(id) ? ids : [...ids, id]) : ids.filter((x) => x !== id));

export const createItemPayload = (i: NewItem) => ({
  nom: i.nom,
  id_etablissement: i.id_etablissement,
  id_parent: i.id_parent,
  id_type: i.id_type,
  id_cycle: i.id_cycle,
  id_enseignement: i.id_enseignement,
  ids_domaine: i.ids_domaine,
});

export const maskPayload = (c: Competence, structureId: string) => ({ id: c.id, id_etablissement: structureId, masque: !c.masque });
export const renamePayload = (c: Competence, nom: string, structureId: string) => ({ id: c.id, id_etablissement: structureId, nom });
export const domainePayload = (c: Competence, idDomaine: number, structureId: string) => ({ id: c.id, id_etablissement: structureId, id_domaine: idDomaine });

/** Message selon le retour du serveur : un item déjà utilisé est masqué au lieu d'être supprimé. */
export const deleteOutcome = (res: { deletecompetence?: string } | null | undefined): "mask" | "deleted" => (res?.deletecompetence === "MASQUAGE" ? "mask" : "deleted");
export const maskOutcome = (nowMasked: boolean, res: { masquecompetence?: string } | null | undefined): "used" | "done" => (nowMasked && res?.masquecompetence === "use" ? "used" : "done");
