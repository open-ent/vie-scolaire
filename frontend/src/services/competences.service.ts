import { http, JSON_HEADERS } from "./http";

type Json = Record<string, unknown>;

/** Jeton CSRF posé par la plateforme (cookie XSRF-TOKEN). */
const xsrf = (): Record<string, string> => {
  const m = /XSRF-TOKEN=([^;]+)/.exec(document.cookie);
  return m ? { "X-XSRF-TOKEN": decodeURIComponent(m[1]) } : {};
};

/** Appel direct (corps vide ou JSON, réponse JSON facultative) quand le client de la plateforme ne convient pas. */
const call = async <T = unknown>(method: string, url: string, body?: unknown): Promise<T | null> => {
  const res = await fetch(url, {
    method,
    credentials: "include",
    headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), ...xsrf() },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(String(res.status));
  const text = await res.text();
  try {
    return text ? (JSON.parse(text) as T) : null;
  } catch {
    return null;
  }
};

const arr = async <T>(p: Promise<T[] | null | undefined>): Promise<T[]> => (await p) ?? [];

/** Activation du module Compétences (« notes ») pour l'établissement. */
export const activationService = {
  actives: (module: string) => arr(http().get<Array<{ id_etablissement: string }>>(`/viescolaire/user/structures/actives?module=${module}`)),
  activate: (module: string, structureId: string) => http().post<unknown>(`/viescolaire/user/structures/actives?structureId=${structureId}`, { structureId, module }, JSON_HEADERS),
  deactivate: (module: string, structureId: string) => call("DELETE", `/viescolaire/user/structures/actives?structureId=${structureId}&module=${module}`),
};

/** Niveaux de maîtrise et calcul du niveau. */
export const levelService = {
  list: (structureId: string) => arr(http().get<import("../lib/competencesLevels").Niveau[]>(`/competences/maitrise/level/${structureId}`)),
  /** Création d'un niveau personnalisé : le serveur renvoie `[ { id } ]`. */
  create: async (structureId: string, body: object): Promise<number | null> => (await http().post<Array<{ id: number }>>(`/competences/maitrise/level?idEtablissement=${structureId}`, body, JSON_HEADERS))?.[0]?.id ?? null,
  update: (structureId: string, id: number, body: object) => http().put<unknown>(`/competences/maitrise/level/${id}?idEtablissement=${structureId}`, body, JSON_HEADERS),
  /** Réinitialise tous les niveaux de l'établissement. */
  reset: (structureId: string) => http().delete<unknown>(`/competences/maitrise/level/${structureId}`),
  isSkillAverage: async (structureId: string): Promise<boolean> => !!(await http().get<{ is_average_skills?: boolean }>(`/competences/structure/${structureId}/options/isSkillAverage`))?.is_average_skills,
  setSkillAverage: (structureId: string, isSkillAverage: boolean) => http().post<unknown>(`/competences/structure/options/isSkillAverage?structureId=${structureId}`, { structureId, isSkillAverage }, JSON_HEADERS),
};

/** Visibilité de la moyenne du BFC (1) et du barème du DNB (2). */
export const visibilityService = {
  get: async (structureId: string, id: number): Promise<number | undefined> => (await http().get<Array<{ visible: number }>>(`/competences/bfc/visibility/structures/${structureId}/${id}`))?.[0]?.visible,
  set: (structureId: string, id: number, visible: number) => http().put<unknown>(`/competences/bfc/visibility/structures/${structureId}/${id}/${visible}`),
};

/** Items de compétences. */
export const itemService = {
  domaines: (structureId: string) => arr(http().get<import("../lib/competencesItems").Domaine[]>(`/competences/domaines?idStructure=${structureId}`)),
  enseignements: (structureId: string) => arr(http().get<import("../lib/competencesItems").EnseignementRaw[]>(`/competences/enseignements?idStructure=${structureId}`)),
  create: (body: object) => http().post<unknown>("/competences/competence", body, JSON_HEADERS),
  /** Masquage, renommage, changement de domaine et réordonnancement passent tous par ce PUT. */
  update: (body: object) => http().put<Json>("/competences/competence", body, JSON_HEADERS),
  /** Suppression d'un item ajouté, ou retour au libellé d'origine : un item déjà utilisé est masqué au lieu d'être supprimé. */
  remove: (id: number, structureId: string) => call<{ deletecompetence?: string }>("DELETE", `/competences/competence?id=${id}&id_etablissement=${structureId}`),
  resetAll: (structureId: string) => http().delete<unknown>(`/competences/items/${structureId}`),
};

/** Rattachement des classes et groupes aux cycles. */
export const cycleLinkService = {
  groupes: (structureId: string) => arr(http().get<import("../lib/competencesCycles").Groupe[]>(`/viescolaire/classes?idEtablissement=${structureId}`)),
  /** Devoirs déjà saisis sur les classes dont le cycle change. */
  check: (structureId: string, body: object) => arr(http().post<Array<{ name: string; id_groupe: string }>>(`/competences/link/check/data/classes?idEtablissement=${structureId}`, body, JSON_HEADERS)),
  save: (body: object) => http().put<unknown>("/competences/link/groupes/cycles", body, JSON_HEADERS),
};

/** Projets éducatifs : EPI, accompagnement personnalisé, parcours. */
export const projectService = {
  elements: (structureId: string) => arr(http().get<import("../lib/competencesProjects").Element[]>(`/competences/elementsBilanPeriodique?idEtablissement=${structureId}`)),
  themes: (type: number, structureId: string) => arr(http().get<import("../lib/competencesProjects").Theme[]>(`/competences/thematique?type=${type}&idEtablissement=${structureId}`)),
  createTheme: (body: object) => http().post<unknown>("/competences/thematique", body, JSON_HEADERS),
  updateTheme: (id: number, body: object) => http().put<unknown>(`/competences/thematique?idThematique=${id}`, body, JSON_HEADERS),
  removeTheme: (id: number) => http().delete<unknown>(`/competences/thematique?idThematique=${id}`),
  elementsOfTheme: (themeId: number) => arr(http().get<unknown[]>(`/competences/elements/thematique?idThematique=${themeId}`)),
  create: (type: number, body: object) => http().post<unknown>(`/competences/elementBilanPeriodique?type=${type}`, body, JSON_HEADERS),
  update: (id: number, type: number, body: object) => http().put<unknown>(`/competences/elementBilanPeriodique?idElement=${id}&type=${type}`, body, JSON_HEADERS),
  remove: (query: string) => http().delete<unknown>(`/competences/elementsBilanPeriodique?${query}`),
  /** Appréciations déjà saisies : sur des éléments (`idEtablissement`) ou sur un élément d'une classe. */
  appreciations: (query: string) => arr(http().get<unknown[]>(`/competences/elementsAppreciations?${query}`)),
  teachers: (structureId: string) => arr(http().get<import("../lib/competencesProjects").Intervenant[]>(`/competences/user/list?profile=Teacher&structureId=${structureId}`)),
  matieres: (structureId: string) => arr(http().get<import("../lib/competencesProjects").MatiereRef[]>(`/viescolaire/matieres?idEtablissement=${structureId}`)),
  classes: (structureId: string) => arr(http().get<import("../lib/competencesProjects").GroupeRef[]>(`/viescolaire/classes?idEtablissement=${structureId}`)),
};

/** Services : modalité, coefficient, évaluabilité, visibilité et devoirs liés. */
export const competenceServiceService = {
  list: (structureId: string, filters: string) => arr(http().get<import("../lib/competencesServices").RawService[]>(`/viescolaire/services?idEtablissement=${structureId}&${filters}`)),
  classes: (structureId: string) => arr(http().get<import("../lib/competencesServices").Group[]>(`/viescolaire/classes?idEtablissement=${structureId}&forAdmin=true`)),
  matieres: (structureId: string) => arr(http().get<import("../lib/competencesServices").Matiere[]>(`/viescolaire/matieres?idEtablissement=${structureId}`)),
  teachers: (structureId: string) => arr(http().get<import("../lib/competencesServices").Teacher[]>(`/viescolaire/teachers?idEtablissement=${structureId}`)),
  modalites: (structureId: string) => arr(http().get<Array<{ id: string; libelle: string }>>(`/competences/modalites?idEtablissement=${structureId}`)),
  subTopicTypes: (structureId: string) => arr(http().get<import("../lib/competencesServices").SubTopicType[]>(`/viescolaire/types/sousmatieres?idStructure=${structureId}`)),
  subTopicStored: (structureId: string) => arr(http().get<import("../lib/competencesServices").SubTopicStored[]>(`/competences/subtopics/services/${structureId}`)),
  saveSubTopic: (body: object) => http().post<unknown>("/competences/subtopics/services/update", body, JSON_HEADERS),
  update: (body: object) => http().put<unknown>("/viescolaire/service", body, JSON_HEADERS),
  updateMany: (body: object) => http().put<unknown>("/viescolaire/services", body, JSON_HEADERS),
  create: (body: object) => http().post<unknown>("/viescolaire/service", body, JSON_HEADERS),
  updateMultiVisibility: (structureId: string, body: object) => http().put<unknown>(`/viescolaire/multiteaching/update_visibility?structureId=${structureId}`, body, JSON_HEADERS),
  homework: (query: string) => arr(http().get<Array<{ id: number }>>(`/competences/devoirs/service?${query}`)),
  moveHomework: (structureId: string, body: object) => http().put<unknown>(`/competences/devoirs/service?structureId=${structureId}`, body, JSON_HEADERS),
  deleteHomework: (idDevoirs: number[]) => http().put<unknown>("/competences/devoirs/delete", { id_devoirs: idDevoirs }, JSON_HEADERS),
};

/** Libellés des matières (modèles), avis du conseil, éléments du programme, ordre des matières. */
export const opinionService = {
  list: (structureId: string) => arr(http().get<import("../lib/competencesMisc").Opinion[]>(`/competences/avis/bilan/periodique?id_structure=${structureId}`)),
  create: (body: object) => http().post<unknown>("/competences/avis/bilan/periodique", body, JSON_HEADERS),
  update: (path: string) => http().put<unknown>(path),
  remove: (id: number) => http().delete<unknown>(`/competences/avis/bilan/periodique?id_avis=${id}`),
};

export const programService = {
  domaines: (idCycle: number) => arr(http().get<Array<{ id: number; libelle: string }>>(`/competences/element/programme/domaines?idCycle=${idCycle}`)),
  sousDomaines: (idDomaine: number) => arr(http().get<Array<{ id: number; libelle: string }>>(`/competences/element/programme/sous/domaines?idDomaine=${idDomaine}`)),
  propositions: (idSousDomaine: number, structureId: string) =>
    arr(http().get<import("../lib/competencesMisc").Proposition[]>(`/competences/element/programme/propositions?idSousDomaine=${idSousDomaine}&idEtablissement=${structureId}`)),
  create: (body: object) => http().post<unknown>("/competences/element/programme/propositions", body, JSON_HEADERS),
  update: (body: object) => http().put<unknown>("/competences/element/programme/propositions", body, JSON_HEADERS),
  remove: (id: number) => http().delete<unknown>(`/competences/element/programme/propositions?idProposition=${id}`),
};

export const subjectModelService = {
  list: (structureId: string) => arr(http().get<import("../lib/competencesMisc").SubjectModel[]>(`/competences/matieres/models/${structureId}`)),
  save: (structureId: string, body: object) => http().post<unknown>(`/competences/matieres/libelle/model/save?idEtablissement=${structureId}`, body, JSON_HEADERS),
  remove: (id: number, structureId: string) => http().delete<unknown>(`/competences/matieres/model/${id}?idEtablissement=${structureId}`),
};

export const subjectRankService = {
  list: (structureId: string) => arr(http().get<Array<{ id: string; name: string; rank: number; externalId?: string; source?: string }>>(`/viescolaire/matieres?idEtablissement=${structureId}`)),
  /** Le serveur répond `{ ids: [...] }` quand l'ordre a bien changé. */
  reshuffle: (structureId: string, body: object) => http().put<unknown>(`/competences/subjects/reshuffle-rank?idEtablissement=${structureId}`, body, JSON_HEADERS),
  reset: (structureId: string) => http().delete<unknown>(`/competences/subjects/${structureId}/id-structure/initialization-rank`),
};

/** Import des retards et absences (fichier CSV) ou récupération depuis Présences. */
export const absenceImportService = {
  periodTypes: () => arr(http().get<import("../lib/competencesMisc").PeriodType[]>("/viescolaire/periodes/types")),
  state: (structureId: string) => http().get<import("../lib/competencesMisc").ImportState>(`/competences/init/sync/presences?structureId=${structureId}`),
  setSync: (structureId: string, state: boolean) => http().post<unknown>(`/competences/sync/presences?structureId=${structureId}`, { state, structureId }, JSON_HEADERS),
  /** Envoi multipart : le navigateur pose lui-même la frontière du corps. */
  upload: async (idPeriode: number, structureId: string, file: File): Promise<import("../lib/competencesMisc").ImportResult> => {
    const body = new FormData();
    body.append("file", file);
    const res = await fetch(`/viescolaire/import/evenements?idPeriode=${idPeriode}&idEtablissement=${structureId}`, { method: "POST", credentials: "include", headers: xsrf(), body });
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as import("../lib/competencesMisc").ImportResult;
  },
};
