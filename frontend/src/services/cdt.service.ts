import { asList, CdtAudience, CdtKind, CdtType, isInitialized, typePayload, typeRoutes } from "../lib/cdt";
import { http, JSON_HEADERS } from "./http";

/** Le client HTTP ne lève pas sur un statut d'erreur : on lit l'état de la dernière réponse juste après l'appel. */
const unwrap = <T>(res: T): T => {
  if (http().isResponseError()) throw new Error(String(http().latestResponse?.status ?? "http"));
  return res;
};

/** Routes REST du module diary (cahier de textes) utilisées par le paramétrage de vie scolaire. */
export const cdtService = {
  /** Vrai si l'établissement a déjà été initialisé (types créés). */
  initialized: async (structureId: string) => isInitialized(unwrap(await http().get<unknown>(`/diary/initialization/structures/${structureId}`))),
  /** Initialise devoirs, types de travail et de séance (sans effet sur l'existant). */
  init: async (structureId: string) => {
    unwrap(await http().get<unknown>(`/diary/init/structures/${structureId}`));
  },
  types: async (kind: CdtKind, structureId: string) => asList<CdtType>(unwrap(await http().get<unknown>(typeRoutes(kind, structureId).list))),
  createType: async (kind: CdtKind, structureId: string, label: string) => {
    unwrap(await http().post<unknown>(typeRoutes(kind, structureId).create, typePayload(structureId, label), JSON_HEADERS));
  },
  updateType: async (kind: CdtKind, structureId: string, id: number, label: string) => {
    unwrap(await http().put<unknown>(typeRoutes(kind, structureId, id).update, typePayload(structureId, label, id), JSON_HEADERS));
  },
  /** Échoue (400) si le type est utilisé ou si c'est le dernier de l'établissement. */
  removeType: async (kind: CdtKind, structureId: string, id: number) => {
    unwrap(await http().delete<unknown>(typeRoutes(kind, structureId, id).remove));
  },
  audiences: async (structureId: string) => asList<CdtAudience>(unwrap(await http().get<unknown>(`/diary/structures/${structureId}/audience-settings`))),
  setAudienceEnabled: async (structureId: string, audienceId: string, enabled: boolean) => {
    unwrap(await http().put<unknown>(`/diary/structures/${structureId}/audience-settings/${audienceId}`, { enabled }, JSON_HEADERS));
  },
};
