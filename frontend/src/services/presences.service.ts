import { CATALOG_ROUTES, CatalogId, CatalogItem, InitType, PresencesSetting, Reason, ReasonKind, REASON_TYPE_ID } from "../lib/presences";
import { http, JSON_HEADERS } from "./http";

/** Activation du module Présences pour l'établissement (case « Activer le module »). */
export const moduleActivationService = {
  actives: async (): Promise<Array<{ id_etablissement?: string }>> =>
    (await http().get<Array<{ id_etablissement?: string }>>("/viescolaire/user/structures/actives?module=presences")) ?? [],
  activate: (structureId: string) =>
    http().post<unknown>(`/viescolaire/user/structures/actives?structureId=${structureId}`, { structureId, module: "presences" }, JSON_HEADERS),
  deactivate: (structureId: string) => http().delete<unknown>(`/viescolaire/user/structures/actives?structureId=${structureId}&module=presences`),
};

/** Initialisation des données par défaut du module Présences. */
export const presencesInitService = {
  status: async (structureId: string): Promise<boolean> => !!(await http().get<{ initialized?: boolean }>(`/presences/initialization/structures/${structureId}`))?.initialized,
  init: (structureId: string, initType: InitType) => http().post<unknown>(`/presences/initialization/structures/${structureId}`, { init_type: initType }, JSON_HEADERS),
};

/** Paramètres de la structure : seuils d'alerte, comptage des événements, appels multiples. */
export const presencesSettingsService = {
  get: (structureId: string) => http().get<PresencesSetting>(`/presences/structures/${structureId}/settings`),
  /** Envoie les seuls champs fournis (comme l'AngularJS : `{allow_multiple_slots}`, `{event_recovery_method}` ou l'ensemble des alertes). */
  put: (structureId: string, body: PresencesSetting) => http().put<unknown>(`/presences/structures/${structureId}/settings`, body, JSON_HEADERS),
};

/** Motifs d'absence (reasonTypeId=1) et de retard (reasonTypeId=2). */
export const reasonsService = {
  list: async (structureId: string, kind: ReasonKind): Promise<Reason[]> =>
    (await http().get<Reason[]>(`/presences/reasons?structureId=${structureId}&reasonTypeId=${REASON_TYPE_ID[kind]}`)) ?? [],
  create: (kind: ReasonKind, body: object) => http().post<unknown>(`/presences/reason?reasonTypeId=${REASON_TYPE_ID[kind]}`, body, JSON_HEADERS),
  update: (body: object) => http().put<unknown>("/presences/reason", body, JSON_HEADERS),
  remove: (id: number) => http().delete<unknown>(`/presences/reason?id=${id}`),
};

/** Catalogues à liste simple : actions, disciplines, types/lieux/protagonistes/partenaires d'incident, gravités, types de punition. */
export const catalogService = {
  list: async (id: CatalogId, structureId: string): Promise<CatalogItem[]> => {
    const r = CATALOG_ROUTES[id];
    return (await http().get<CatalogItem[]>(`${r.list}?${r.structureParam}=${structureId}`)) ?? [];
  },
  create: (id: CatalogId, body: object) => http().post<unknown>(CATALOG_ROUTES[id].write, body, JSON_HEADERS),
  update: (id: CatalogId, body: object) => http().put<unknown>(CATALOG_ROUTES[id].write, body, JSON_HEADERS),
  remove: (id: CatalogId, itemId: number) => http().delete<unknown>(`${CATALOG_ROUTES[id].write}?id=${itemId}`),
  /** Modèles de saisie des punitions et sanctions (4 images). */
  punishmentCategories: async (): Promise<Array<{ id: number; label: string; url_img: string }>> =>
    (await http().get<Array<{ id: number; label: string; url_img: string }>>("/incidents/punishments/category")) ?? [],
};

/** Modèles de publipostage (module massmailing). */
export const massmailingService = {
  list: async (type: import("../lib/massmailing").TemplateType, structureId: string) =>
    (await http().get<import("../lib/massmailing").Template[]>(`/massmailing/settings/templates/${type}?structure=${structureId}&category=ALL`)) ?? [],
  create: (body: object) => http().post<import("../lib/massmailing").Template>("/massmailing/settings/templates", body, JSON_HEADERS),
  update: (id: number, body: object) => http().put<unknown>(`/massmailing/settings/templates/${id}`, body, JSON_HEADERS),
  remove: (id: number) => http().delete<unknown>(`/massmailing/settings/templates/${id}`),
};
