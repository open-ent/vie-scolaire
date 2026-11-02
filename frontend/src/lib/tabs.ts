import { Action, App, canAccessApp, hasWorkflow, isDirector1DNonAdmc, RIGHTS } from "./access";

/** Services activés pour la plateforme (variable `window.vscoServices` posée par la vue). */
export interface Services {
  competences?: boolean;
  presences?: boolean;
  diary?: boolean;
  edt?: boolean;
}

export type SectionId = "ecole" | "competences" | "presences" | "diary" | "edt";
export type SchoolTabId = "annee" | "periodes" | "exclusions" | "creneaux" | "services" | "regroupements" | "trombinoscope";

export interface Context {
  actions?: Action[];
  apps?: App[];
  superAdmin?: boolean;
  services?: Services;
}

/** Onglets principaux visibles : « École » toujours, les autres selon l'application accessible et le service activé. */
export const visibleSections = (c: Context): SectionId[] => {
  const s = c.services ?? {};
  const out: SectionId[] = ["ecole"];
  if (s.competences && canAccessApp(c.apps, "/competences")) out.push("competences");
  if (s.presences && canAccessApp(c.apps, "/presences") && !isDirector1DNonAdmc(c.actions, !!c.superAdmin)) out.push("presences");
  if (s.diary && canAccessApp(c.apps, "/diary")) out.push("diary");
  if (s.edt && canAccessApp(c.apps, "/edt") && !isDirector1DNonAdmc(c.actions, !!c.superAdmin)) out.push("edt");
  return out;
};

/** Sous-onglets de l'onglet « École » visibles (certains exigent un droit de gestion). */
export const visibleSchoolTabs = (c: Context): SchoolTabId[] => {
  const can = (r: string) => hasWorkflow(c.actions, r);
  const out: SchoolTabId[] = [];
  if (can(RIGHTS.periodYearManage)) out.push("annee");
  out.push("periodes");
  if (can(RIGHTS.periodYearManage)) out.push("exclusions");
  if (can(RIGHTS.timeSlotsManage)) out.push("creneaux");
  if (can(RIGHTS.paramServices)) out.push("services");
  out.push("regroupements");
  if (can(RIGHTS.paramTrombinoscope)) out.push("trombinoscope");
  return out;
};

/** Sous-onglet affiché à l'ouverture : « Périodes » (comme l'AngularJS), sinon le premier visible. */
export const defaultSchoolTab = (tabs: SchoolTabId[]): SchoolTabId | undefined =>
  tabs.includes("periodes") ? "periodes" : tabs[0];
