/** Logique pure de l'écran « Présences » (sniplet `presences-manage` de l'AngularJS) : motifs, paramètres, catalogues. */

// ───────────────────────── Droits et initialisation ─────────────────────────

/** Noms complets des droits d'initialisation (module Présences, actions « factices »). */
export const INIT_RIGHTS = {
  oneD: "fr.openent.presences.controller.FakeRight|initSettings1D",
  twoD: "fr.openent.presences.controller.FakeRight|initSettings2D",
} as const;

export type InitType = "ONE_D" | "TWO_D";

/**
 * Boutons « Initialiser » proposés tant que le module n'est pas initialisé :
 * premier degré seul → ONE_D ; second degré (avec ou sans premier) → TWO_D ; aucun droit → rien.
 * Exemple : initButtons(false, true, true) → ["ONE_D"] ; initButtons(true, true, false) → ["TWO_D"].
 */
export const initButtons = (initialized: boolean, has1D: boolean, has2D: boolean): InitType[] => {
  if (initialized) return [];
  const out: InitType[] = [];
  if (has1D && !has2D) out.push("ONE_D");
  if (has2D) out.push("TWO_D");
  return out;
};

/** Structures où le module est activé : réponse de `/viescolaire/user/structures/actives?module=presences`. */
export const isModuleActive = (actives: Array<{ id_etablissement?: string }> | null | undefined, structureId: string): boolean =>
  (actives ?? []).some((a) => a.id_etablissement === structureId);

// ───────────────────────────────── Motifs ────────────────────────────────────

export type ReasonKind = "absence" | "lateness";

/** Identifiant de type de motif attendu par `/presences/reason?reasonTypeId=`. */
export const REASON_TYPE_ID: Record<ReasonKind, number> = { absence: 1, lateness: 2 };

export const ALERT_RULE = { REGULARIZED: "REGULARIZED", UNREGULARIZED: "UNREGULARIZED", LATENESS: "LATENESS" } as const;

export interface Reason {
  id: number;
  label: string;
  structure_id: string;
  proving: boolean;
  absence_compliance: boolean;
  hidden: boolean;
  used?: boolean;
  reason_alert_rules?: string[];
}

/** Formulaire d'un motif (ajout ou modification). */
export interface ReasonDraft {
  id?: number;
  label: string;
  proving: boolean;
  absenceCompliance: boolean;
  excludeAlertRegularised: boolean;
  excludeAlertNoRegularised: boolean;
  excludeAlertLateness: boolean;
  hidden?: boolean;
  structureId?: string;
}

/**
 * Formulaire d'ajout vierge. Un motif d'absence démarre « à régulariser » (proving=false), un motif de retard « justifié » (proving=true) ;
 * la prise en compte au bulletin est cochée dans les deux cas.
 */
export const emptyReasonDraft = (kind: ReasonKind): ReasonDraft => ({
  label: "",
  proving: kind === "lateness",
  absenceCompliance: true,
  excludeAlertRegularised: false,
  excludeAlertNoRegularised: false,
  excludeAlertLateness: false,
});

/** Après un ajout : libellé vidé, « régularisation » et « bulletin » remis à leur valeur initiale ; les cases d'alerte restent. */
export const resetReasonDraft = (kind: ReasonKind, d: ReasonDraft): ReasonDraft => ({
  ...d,
  label: "",
  proving: kind === "lateness",
  absenceCompliance: true,
});

/** Un libellé est requis (espaces seuls refusés). */
export const isValidLabel = (label: string | null | undefined): boolean => !!label && label.trim() !== "";

/** Le motif « -1 » (absence sans motif, ajouté par le serveur) n'est jamais listé. */
export const visibleReasons = (list: Reason[]): Reason[] => list.filter((r) => r.id !== -1);

const lower = (s: string) => s.toLowerCase();
const cmpStr = (a: string, b: string) => (lower(a) < lower(b) ? -1 : lower(a) > lower(b) ? 1 : 0);

/**
 * Ordre de la liste (orderBy AngularJS ['!proving', 'absence_compliance', 'label']) :
 * motifs justifiés d'abord, puis ceux qui ne comptent pas au bulletin avant ceux qui comptent, puis libellé.
 */
export const sortReasons = (list: Reason[]): Reason[] =>
  [...list].sort((a, b) => {
    if (a.proving !== b.proving) return a.proving ? -1 : 1;
    if (!!a.absence_compliance !== !!b.absence_compliance) return a.absence_compliance ? 1 : -1;
    return cmpStr(a.label, b.label);
  });

const rulesOf = (r: Reason): string[] => r.reason_alert_rules ?? [];

/** Formulaire de modification d'un motif ; les cases d'alerte non pertinentes pour le type restent à faux. */
export const draftOfReason = (kind: ReasonKind, r: Reason): ReasonDraft => ({
  id: r.id,
  label: r.label,
  proving: r.proving,
  absenceCompliance: r.absence_compliance,
  hidden: r.hidden,
  structureId: r.structure_id,
  excludeAlertRegularised: kind === "absence" && rulesOf(r).includes(ALERT_RULE.REGULARIZED),
  excludeAlertNoRegularised: kind === "absence" && rulesOf(r).includes(ALERT_RULE.UNREGULARIZED),
  excludeAlertLateness: kind === "lateness" && rulesOf(r).includes(ALERT_RULE.LATENESS),
});

/** Corps de `POST /presences/reason?reasonTypeId=…`. */
export const reasonCreateBody = (structureId: string, d: ReasonDraft) => ({
  label: d.label.trim(),
  absenceCompliance: d.absenceCompliance,
  proving: d.proving,
  excludeAlertRegularised: d.excludeAlertRegularised,
  excludeAlertNoRegularised: d.excludeAlertNoRegularised,
  excludeAlertLateness: d.excludeAlertLateness,
  structureId,
});

/** Corps de `PUT /presences/reason`. */
export const reasonUpdateBody = (d: ReasonDraft) => ({
  id: d.id,
  label: d.label.trim(),
  absenceCompliance: d.absenceCompliance,
  hidden: d.hidden,
  proving: d.proving,
  excludeAlertRegularised: d.excludeAlertRegularised,
  excludeAlertNoRegularised: d.excludeAlertNoRegularised,
  excludeAlertLateness: d.excludeAlertLateness,
  structureId: d.structureId,
});

/** Corps du basculement visible/masqué : toutes les règles d'alerte sont relues du motif, `hidden` est inversé. */
export const reasonToggleBody = (r: Reason) =>
  reasonUpdateBody({
    id: r.id,
    label: r.label,
    proving: r.proving,
    absenceCompliance: r.absence_compliance,
    hidden: !r.hidden,
    structureId: r.structure_id,
    excludeAlertLateness: rulesOf(r).includes(ALERT_RULE.LATENESS),
    excludeAlertRegularised: rulesOf(r).includes(ALERT_RULE.REGULARIZED),
    excludeAlertNoRegularised: rulesOf(r).includes(ALERT_RULE.UNREGULARIZED),
  });

/** Couleur et info-bulle de la cloche « alerte » d'un motif d'absence (null = pas de cloche). */
export const absenceAlertBell = (r: Reason): { color: string; titleKey: string; titleDefault: string } | null => {
  const reg = rulesOf(r).includes(ALERT_RULE.REGULARIZED);
  const unreg = rulesOf(r).includes(ALERT_RULE.UNREGULARIZED);
  if (!reg && !unreg) return { color: "#ffb600", titleKey: "presences.absence.reason.regularized.and.unregularized", titleDefault: "Alerte lorsque l'absence est régularisé ou non régularisée" };
  if (!reg) return { color: "#72bb53", titleKey: "presences.absence.reason.regularized", titleDefault: "Alerte lorsque ce motif est régularisé" };
  if (!unreg) return { color: "#ff8a84", titleKey: "presences.absence.reason.unregularized", titleDefault: "Alerte lorsque ce motif est non régularisé" };
  return null;
};

/** Cloche d'un motif de retard : violette tant que le motif ne porte pas la règle LATENESS. */
export const latenessAlertBell = (r: Reason): { color: string } | null => (rulesOf(r).includes(ALERT_RULE.LATENESS) ? null : { color: "#9c29b7" });

/** État de l'icône visible/masqué : seuls les éléments déjà utilisés se masquent ; les autres se suppriment. */
export const visibilityState = (item: { used?: boolean | null; hidden?: boolean | null }): "visible" | "hidden" | "deletable" =>
  !item.used ? "deletable" : item.hidden ? "hidden" : "visible";

// ─────────────────────────────── Paramètres ──────────────────────────────────

export type EventRecoveryMethod = "HOUR" | "HALF_DAY" | "DAY";

/** Paramètres de la structure (`/presences/structures/:id/settings`). */
export interface PresencesSetting {
  alert_absence_threshold?: number;
  alert_lateness_threshold?: number;
  alert_incident_threshold?: number;
  alert_forgotten_notebook_threshold?: number;
  event_recovery_method?: EventRecoveryMethod | null;
  allow_multiple_slots?: boolean;
  exclude_alert_absence_no_reason?: boolean;
  exclude_alert_lateness_no_reason?: boolean;
  exclude_alert_forgotten_notebook?: boolean;
}

export const DEFAULT_SETTING: PresencesSetting = {
  alert_absence_threshold: 0,
  alert_lateness_threshold: 0,
  alert_incident_threshold: 0,
  alert_forgotten_notebook_threshold: 0,
  exclude_alert_absence_no_reason: false,
  exclude_alert_lateness_no_reason: false,
  exclude_alert_forgotten_notebook: false,
};

/** Paramètres du serveur complétés par les valeurs par défaut (seuils à 0, cases décochées). */
export const withDefaults = (s: PresencesSetting | null | undefined): PresencesSetting => ({ ...DEFAULT_SETTING, ...(s ?? {}) });

export type ThresholdRef = "alert_absence_threshold" | "alert_lateness_threshold" | "alert_incident_threshold" | "alert_forgotten_notebook_threshold";

/** Les quatre seuils d'alerte, dans l'ordre d'affichage de l'AngularJS, avec leur clé i18n. */
export const THRESHOLDS: Array<{ ref: ThresholdRef; key: string; label: string }> = [
  { ref: "alert_absence_threshold", key: "presences.navigation.absence", label: "Absences" },
  { ref: "alert_lateness_threshold", key: "presences.absence.lateness", label: "Retards" },
  { ref: "alert_incident_threshold", key: "presences.incidents", label: "Incidents" },
  { ref: "alert_forgotten_notebook_threshold", key: "presences.register.event_type.forgotten.notebooks", label: "Carnets oubliés" },
];

/** Bouton « + » / « − » : jamais en dessous de 0. Exemple : nextThreshold(0, false) → 0 ; nextThreshold(4, true) → 5. */
export const nextThreshold = (current: number, increment: boolean): number => (increment ? (Number(current) || 0) + 1 : Math.max(0, (Number(current) || 0) - 1));

/** Saisie manuelle : entier ≥ 0, ou null si le champ est vide / illisible (rien n'est alors enregistré). */
export const parseThreshold = (raw: string): number | null => {
  if (raw.trim() === "") return null;
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) ? Math.max(0, n) : null;
};

/** Mode de comptage des événements ; absent ou nul → « par créneau » (HOUR), comme l'AngularJS. */
export const recoveryMethodOf = (s: PresencesSetting | null | undefined): EventRecoveryMethod => s?.event_recovery_method ?? "HOUR";

export const RECOVERY_METHODS: Array<{ value: EventRecoveryMethod; key: string; label: string }> = [
  { value: "DAY", key: "presences.statistics.manage.events.inventory.method.day", label: "par jour" },
  { value: "HALF_DAY", key: "presences.statistics.manage.events.inventory.method.half_day", label: "par demi-journée" },
  { value: "HOUR", key: "presences.statistics.manage.events.inventory.method.hour", label: "par créneau" },
];

// ─────────────── Catalogues (actions, disciplines, incidents, punitions) ──────────────

export type CatalogId = "action" | "discipline" | "incidentType" | "place" | "protagonist" | "partner" | "seriousness" | "punishmentType";

/** Un élément de catalogue tel que le renvoie le serveur (selon le catalogue, seuls certains champs existent). */
export interface CatalogItem {
  id: number;
  label: string;
  hidden?: boolean | null;
  used?: boolean | null;
  abbreviation?: string;
  level?: number;
  exclude_alert_seriousness?: boolean;
  type?: string;
  punishment_category_id?: number;
}

/** Formulaire commun aux catalogues (chaque catalogue n'utilise que ses champs). */
export interface CatalogForm {
  label: string;
  abbreviation: string;
  level: number;
  excludeAlertSeriousness: boolean;
  type: string;
  categoryId: number | null;
}

export const emptyCatalogForm = (): CatalogForm => ({ label: "", abbreviation: "", level: 0, excludeAlertSeriousness: false, type: "", categoryId: null });

/** Routes REST de chaque catalogue (liste, écriture au singulier) ; `structureParam` = nom du paramètre de structure de la liste. */
export const CATALOG_ROUTES: Record<CatalogId, { list: string; structureParam: string; write: string }> = {
  action: { list: "/presences/actions", structureParam: "structureId", write: "/presences/action" },
  discipline: { list: "/presences/disciplines", structureParam: "structureId", write: "/presences/discipline" },
  incidentType: { list: "/incidents/types", structureParam: "structureId", write: "/incidents/type" },
  place: { list: "/incidents/places", structureParam: "structureId", write: "/incidents/place" },
  protagonist: { list: "/incidents/protagonists/type", structureParam: "structureId", write: "/incidents/protagonist/type" },
  partner: { list: "/incidents/partners", structureParam: "structureId", write: "/incidents/partner" },
  seriousness: { list: "/incidents/seriousnesses", structureParam: "structureId", write: "/incidents/seriousness" },
  punishmentType: { list: "/incidents/punishments/type", structureParam: "structure_id", write: "/incidents/punishments/type" },
};

/** Niveaux de gravité (pastilles 0 à 7) : du rose pâle au rouge sombre, comme la charte du module Incidents. */
export const SERIOUSNESS_COLORS = ["#ffdad8", "#ffb4ad", "#ff8a84", "#ff5d55", "#ff3823", "#e61610", "#b70f0a", "#840705"] as const;
export const SERIOUSNESS_LEVELS = [0, 1, 2, 3, 4, 5, 6, 7];

/** Création possible ? Punition/sanction : modèle, type et libellé ; les autres : un libellé. */
export const canCreate = (id: CatalogId, f: CatalogForm): boolean =>
  id === "punishmentType" ? !!f.categoryId && isValidLabel(f.label) && !!f.type : isValidLabel(f.label);

/** Corps de création (`POST`). */
export const catalogCreateBody = (id: CatalogId, structureId: string, f: CatalogForm): Record<string, unknown> => {
  const label = f.label.trim();
  switch (id) {
    case "action":
      return { label, abbreviation: f.abbreviation, structureId };
    case "seriousness":
      return { label, level: f.level, excludeAlertSeriousness: f.excludeAlertSeriousness, structureId };
    case "punishmentType":
      return { label, type: f.type, punishment_category_id: f.categoryId, structure_id: structureId };
    default:
      return { label, structureId };
  }
};

/** Formulaire de modification pré-rempli depuis l'élément. */
export const catalogFormOf = (item: CatalogItem): CatalogForm => ({
  label: item.label,
  abbreviation: item.abbreviation ?? "",
  level: item.level ?? 0,
  excludeAlertSeriousness: !!item.exclude_alert_seriousness,
  type: item.type ?? "",
  categoryId: item.punishment_category_id ?? null,
});

/** Corps de modification (`PUT`) : l'élément `id` avec le formulaire `f` et l'état `hidden` voulu. */
export const catalogUpdateBody = (id: CatalogId, item: CatalogItem, f: CatalogForm, hidden: boolean): Record<string, unknown> => {
  const label = f.label.trim();
  const base = { id: item.id, label, hidden };
  switch (id) {
    case "action":
      return { ...base, abbreviation: f.abbreviation };
    case "seriousness":
      return { ...base, level: f.level, excludeAlertSeriousness: f.excludeAlertSeriousness };
    case "punishmentType":
      return { ...base, type: f.type, punishment_category_id: f.categoryId };
    default:
      return base;
  }
};

/** Corps du basculement visible/masqué : l'élément tel quel, `hidden` inversé. */
export const catalogToggleBody = (id: CatalogId, item: CatalogItem) => catalogUpdateBody(id, item, catalogFormOf(item), !item.hidden);

/** Tri par identifiant (`orderBy:'id'`). */
export const sortById = <T extends { id: number }>(list: T[]): T[] => [...list].sort((a, b) => a.id - b.id);

/** Punitions et sanctions sont listées à part (type `PUNISHMENT` / `SANCTION`), chacune triée par identifiant. */
export const splitPunishments = (list: CatalogItem[]): { punishments: CatalogItem[]; sanctions: CatalogItem[] } => ({
  punishments: sortById(list.filter((i) => i.type === "PUNISHMENT")),
  sanctions: sortById(list.filter((i) => i.type === "SANCTION")),
});

/** Réinitialisation après un ajout réussi : libellé vidé (+ abréviation, niveau ou type selon le catalogue). */
export const resetCatalogForm = (id: CatalogId, f: CatalogForm): CatalogForm => {
  const next = { ...f, label: "" };
  if (id === "action") next.abbreviation = "";
  if (id === "seriousness") next.level = 0;
  if (id === "punishmentType") next.type = "";
  return next;
};
