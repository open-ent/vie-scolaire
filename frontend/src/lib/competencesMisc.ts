// --- visibilité du BFC (moyenne par domaine, barème du DNB) ---------------------------------------------------

/** 0 : caché pour tout le monde, 1 : caché pour les enseignants, 2 : visible pour tous. */
export type Visibility = 0 | 1 | 2;
export const VISIBILITY_OPTIONS: Array<{ value: Visibility; key: string; fallback: string }> = [
  { value: 0, key: "evaluation.bfc.set.visiblity.nobody", fallback: "Masqué pour tout le monde" },
  { value: 1, key: "evaluation.bfc.set.visiblity.authorized", fallback: "Visible uniquement des personnes habilitées (chefs établissement, personnels de direction, ...)" },
  { value: 2, key: "evaluation.bfc.set.visiblity.all", fallback: "Visible par tout le monde" },
];
/** Identifiant du réglage côté serveur : 1 = moyenne du BFC, 2 = barème du DNB. */
export const VISIBILITY_ID = { average: 1, dnb: 2 } as const;

// --- avis du conseil de classe et d'orientation ----------------------------------------------------------------

export interface Opinion {
  id: number;
  libelle: string;
  /** 1 = avis du conseil de classe, 2 = avis d'orientation. */
  type_avis: number;
  /** Nul pour un avis fourni par la plateforme (lecture seule). */
  id_etablissement: string | null;
  active: boolean;
}

export const MAX_OPINION = 150;

export const opinionsOfType = (list: Opinion[], type: 1 | 2): Opinion[] => list.filter((o) => o.type_avis === type);
export const isReadOnlyOpinion = (o: Opinion): boolean => o.id_etablissement === null;

/** Libellé vide : l'AngularJS n'enregistre pas et recharge la liste (l'ancien texte revient). */
export const canSaveOpinion = (libelle: string): boolean => libelle !== "";

/** Chemin de modification : le libellé passe dans l'adresse, donc encodé. Ex. « Très bien » → Tr%C3%A8s%20bien. */
export const opinionUpdatePath = (o: Pick<Opinion, "id" | "active" | "libelle">): string =>
  `/competences/avis/bilan/periodique?id_avis=${o.id}&active=${o.active}&libelle=${encodeURIComponent(o.libelle)}`;

// --- éléments du programme -------------------------------------------------------------------------------------

export interface Proposition {
  id: number;
  libelle: string;
  /** Nul pour une proposition fournie par la plateforme (lecture seule). */
  id_etablissement: string | null;
}

export const isReadOnlyProposition = (p: Proposition): boolean => p.id_etablissement == null;

export const MAX_PROPOSITION = 255;

// --- libellés des matières (modèles) ---------------------------------------------------------------------------

export interface ModelSubject {
  id?: number | string;
  name: string;
  libelle: string;
}

export interface SubjectModel {
  id?: number;
  title: string;
  subjects: ModelSubject[];
}

/** Modèles dont le titre commence par le texte cherché (sans casse) ; « * » ou vide = tous. Triés par titre. */
export const filterModels = (models: SubjectModel[], search: string): SubjectModel[] => {
  const s = search.trim() === "*" ? "" : search.trim().toUpperCase();
  return models.filter((m) => m.title.toUpperCase().startsWith(s)).sort((a, b) => a.title.localeCompare(b.title));
};

/** Nouveau modèle : copie des matières du premier modèle (celui par défaut), titre à saisir. */
export const newModel = (models: SubjectModel[]): SubjectModel => ({ title: "", subjects: (models[0]?.subjects ?? []).map((s) => ({ ...s })) });

/** Matières d'un modèle triées par nom, comme à l'écran. */
export const sortedSubjects = (m: SubjectModel): ModelSubject[] => [...m.subjects].sort((a, b) => a.name.localeCompare(b.name));

export const canSaveModel = (m: SubjectModel): boolean => m.title.trim() !== "";

export const modelPayload = (m: SubjectModel, structureId: string) => ({ ...m, idStructure: structureId });

// --- ordre d'affichage des matières ----------------------------------------------------------------------------

export interface RankedSubject {
  id: string;
  name: string;
  rank: number;
  code?: string;
  source?: string;
}

export const prepareSubjects = (raw: Array<{ id: string; name: string; rank: number; externalId?: string; source?: string }>): RankedSubject[] =>
  raw.map((s) => ({ id: s.id, name: s.name, rank: s.rank, code: s.externalId, source: s.source }));

/** Bornes envoyées au serveur pour monter ou descendre une matière de la position `index`. */
export const moveRange = (index: number, direction: "up" | "down"): { indexStart: number; indexEnd: number } =>
  direction === "up" ? { indexStart: index - 1, indexEnd: -1 } : { indexStart: index, indexEnd: index + 1 };

/**
 * Bornes d'un glisser-déposer : `dropIndex` est la ligne visée (undefined = zone au-dessus de la liste).
 * Renvoie null si la matière est déposée sur sa propre place.
 */
export const dropRange = (dragRank: number, dropIndex: number | undefined): { indexStart: number; indexEnd: number } | null => {
  if (dropIndex === dragRank) return null;
  if (dropIndex === undefined || dropIndex < dragRank) return { indexStart: dropIndex === undefined ? 0 : dropIndex + 1, indexEnd: -1 };
  return { indexStart: dragRank, indexEnd: dropIndex };
};

export const reshufflePayload = (structureId: string, id: string, range: { indexStart: number; indexEnd: number }) => ({ idStructure: structureId, id, ...range });

/** Le serveur confirme un changement d'ordre par une liste `ids`. */
export const reshuffleOk = (data: unknown): boolean => !!data && typeof data === "object" && "ids" in (data as object);

// --- imports de retards et d'absences --------------------------------------------------------------------------

export interface PeriodType {
  id: number;
  type: number;
  ordre: number;
}

/** Périodes proposées, triées par type puis par ordre. */
export const sortPeriodTypes = (list: PeriodType[]): PeriodType[] => [...list].sort((a, b) => a.type - b.type || a.ordre - b.ordre);

export interface ImportState {
  installed?: boolean;
  activate?: boolean;
  presences_sync?: boolean;
}

/** La case « récupérer depuis Présences » est masquée si le module Présences n'est pas installé ou activé. */
export const syncCheckboxHidden = (s: ImportState): boolean => !s.installed || !s.activate;
export const syncChecked = (s: ImportState): boolean => !!s.presences_sync && !!s.installed && !!s.activate;

export interface ImportResult {
  filename?: string;
  error?: boolean;
  isValid?: boolean;
  nbInsert?: number;
  nbLines?: number;
  homonymes?: Array<{ firstName: string; lastName: string; classesName: string }>;
}

/** Résultat d'un fichier : erreur serveur, fichier invalide, ou succès avec le nombre d'élèves importés / ignorés. */
export const importOutcome = (r: ImportResult): { kind: "error" | "invalid" | "success"; inserted: number; skipped: number } => {
  if (r.error) return { kind: "error", inserted: 0, skipped: 0 };
  if (!r.isValid) return { kind: "invalid", inserted: 0, skipped: 0 };
  const inserted = r.nbInsert ?? 0;
  // le fichier compte 2 lignes d'en-tête : 52 lignes, 40 insérées → 10 ignorées
  return { kind: "success", inserted, skipped: Math.max(0, (r.nbLines ?? 0) - inserted - 2) };
};

/** Taille lisible : 2048 → « 2 Ko », 3145728 → « 3 Mo ». */
export const formatSize = (bytes: number): string => (bytes >= 1048576 ? `${Math.round((bytes / 1048576) * 10) / 10} Mo` : bytes >= 1024 ? `${Math.round(bytes / 1024)} Ko` : `${bytes} o`);

/** Cases à cocher « Activer le module » : l'établissement est actif s'il figure dans la liste du serveur. */
export const isStructureActive = (actives: Array<{ id_etablissement: string }> | null | undefined, structureId: string): boolean =>
  (actives ?? []).some((a) => a.id_etablissement === structureId);
