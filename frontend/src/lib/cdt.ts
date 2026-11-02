/** Paramétrage du cahier de textes (module diary) : types de devoirs/séances, initialisation, activation par classe/groupe. */

export type CdtKind = "homework" | "session";

/** Type de devoir ou de séance, tel que le renvoie le serveur (trié par `rank`). */
export interface CdtType {
  id: number;
  structure_id: string;
  label: string;
  rank?: number;
}

/** Classe ou groupe avec l'état du cahier de textes (MOD11) et ses enseignants. */
export interface CdtAudience {
  id: string;
  name: string;
  enabled: boolean;
  teacherNames: string[];
}

export type CdtSection = "init" | "homework" | "session" | "audience";

/** Entrées du menu latéral, dans l'ordre de l'Angular (`currParam` 0 à 3). */
export const CDT_SECTIONS: { id: CdtSection; label: string; fallback: string }[] = [
  { id: "init", label: "cdt.data.init", fallback: "Initilisation des données" },
  { id: "homework", label: "cdt.homework.type", fallback: "Types de travail à faire" },
  { id: "session", label: "cdt.session.type", fallback: "Types de séance" },
  { id: "audience", label: "cdt.audience.settings.title", fallback: "Cahier de textes par classe/groupe" },
];

/** Longueur maximale (`maxlength`) d'un libellé de type. */
export const MAX_LABEL = 50;

/** Libellé valable : au moins 2 caractères (règle de l'Angular : `length > 1`), ici hors espaces de bord. Ex. « Ex » oui, « E » non. */
export const isValidTypeLabel = (label: string): boolean => label.trim().length > 1;

/** La suppression n'est proposée que s'il reste plus d'un type : le dernier ne peut pas être retiré. */
export const canDeleteType = (count: number): boolean => count > 1;

/** Routes REST du module diary pour chaque sorte de type (les deux listes n'ont pas la même forme). */
export const typeRoutes = (kind: CdtKind, structureId: string, id?: number) =>
  kind === "homework"
    ? {
        list: `/diary/homework-types/${structureId}`,
        create: "/diary/homework-type",
        update: `/diary/homework-type/${id}`,
        remove: `/diary/homework-type/${id}/${structureId}`,
      }
    : {
        list: `/diary/session-types?idStructure=${encodeURIComponent(structureId)}`,
        create: "/diary/session-type",
        update: `/diary/session-type/${id}`,
        remove: `/diary/session-type/${id}/${structureId}`,
      };

/** Corps de création/modification. Ex. création : `{ structure_id: "s1", label: "Exercice" }` ; modification : + `id`. */
export const typePayload = (structureId: string, label: string, id?: number) => ({
  ...(id !== undefined ? { id } : {}),
  structure_id: structureId,
  label: label.trim(),
});

/** Types triés par rang (le serveur les trie déjà ; garde-fou si `rank` manque : ordre d'origine conservé). */
export const sortTypes = (list: CdtType[]): CdtType[] => [...list].sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));

/** Réponse de `/diary/initialization/structures/:id` : `{ initialized: true }`, ou objet vide si jamais initialisé. */
export const isInitialized = (data: unknown): boolean => !!data && typeof data === "object" && (data as { initialized?: unknown }).initialized === true;

/** Enseignants d'une classe en une ligne (« A, B »), ou `null` s'il n'y en a aucun. */
export const teachersLabel = (a: CdtAudience): string | null => (a.teacherNames?.length ? a.teacherNames.join(", ") : null);

/** Liste après bascule d'une classe/groupe. Ex. activé → désactivé pour l'id « c1 ». */
export const withEnabled = (list: CdtAudience[], id: string, enabled: boolean): CdtAudience[] => list.map((a) => (a.id === id ? { ...a, enabled } : a));

/** Écarte toute réponse qui n'est pas une liste (erreur renvoyée comme objet). */
export const asList = <T>(data: unknown): T[] => (Array.isArray(data) ? (data as T[]) : []);
