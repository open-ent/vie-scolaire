import { Action, hasWorkflow, RIGHTS } from "./access";

/** Droits « workflow » du module Compétences, par leur nom complet (comme `Behaviours.rights.workflow` de l'AngularJS). */
export const COMP_RIGHTS = {
  setVisibilityAverageBfc: "fr.openent.competences.controllers.BFCController|setVisibility",
  paramCompetences: "fr.openent.competences.controllers.CompetenceController|createCompetence",
  linkGroupCycle: "fr.openent.competences.controllers.UtilsController|updateLinkGroupesCycles",
  bilanPeriodique: "fr.openent.competences.controllers.ElementBilanPeriodiqueController|createElementBilanPeriodique",
} as const;

export type CompSectionId = "levels" | "visibilityAverage" | "visibilityDnb" | "items" | "links" | "projects" | "services" | "subjects" | "absences" | "opinions" | "program" | "order";

/**
 * Entrées du menu, dans l'ordre de l'AngularJS. `right` : droit exigé (absent = toujours proposé).
 * « Modification des libellés des matières » et « Imports retards et absences » sont déclarés avec un droit
 * inexistant dans l'AngularJS (`viescolaire.adminChefEtab`, `viescolaire.importRetardAndAbsences`) : le menu les affiche à tous.
 */
export const COMP_SECTIONS: Array<{ id: CompSectionId; key: string; fallback: string; right?: string }> = [
  { id: "levels", key: "evaluations.level", fallback: "Niveau de maitrise et calcul du niveau" },
  { id: "visibilityAverage", key: "evaluation.bfc.visibility.average", fallback: "Visibilité du niveau calculé du BFC par domaine", right: COMP_RIGHTS.setVisibilityAverageBfc },
  { id: "visibilityDnb", key: "evaluation.bfc.visibility.baremeBFC", fallback: "Visibilité du barème DNB affiché sur le BFC ", right: COMP_RIGHTS.setVisibilityAverageBfc },
  { id: "items", key: "evaluations.competences.items.title", fallback: "Items de compétences", right: COMP_RIGHTS.paramCompetences },
  { id: "links", key: "evaluation.link.group.cycle", fallback: "Rattachement des cycles", right: COMP_RIGHTS.linkGroupCycle },
  { id: "projects", key: "evaluations.educatif.project", fallback: "Projets éducatifs", right: COMP_RIGHTS.bilanPeriodique },
  { id: "services", key: "evaluation.viescolaire.service", fallback: "Modalités des services", right: RIGHTS.paramServices },
  { id: "subjects", key: "evaluations.rename.subject.title", fallback: "Modification des libellés des matières" },
  { id: "absences", key: "viescolaire.param.absence.retard", fallback: "Imports retards et absences" },
  { id: "opinions", key: "viescolaire.conference.opinions", fallback: "Avis du conseil de classe" },
  { id: "program", key: "viescolaire.conference.elements", fallback: "Éléments du programme" },
  { id: "order", key: "evaluation.orderShowSubject.title", fallback: "Organiser les matières", right: COMP_RIGHTS.paramCompetences },
];

/** Entrées du menu visibles pour les droits de l'usager. */
export const visibleCompSections = (actions: Action[] | undefined) => COMP_SECTIONS.filter((s) => !s.right || hasWorkflow(actions, s.right));

/** Section affichée : celle demandée si elle est visible, sinon la première (« Niveau de maîtrise »). */
export const currentCompSection = (visible: Array<{ id: CompSectionId }>, wanted: CompSectionId): CompSectionId => (visible.some((s) => s.id === wanted) ? wanted : "levels");
