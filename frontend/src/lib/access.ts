/** Une action du bureau (droit « workflow ») telle que la renvoie `/auth/oauth2/userinfo`. */
export interface Action {
  name?: string;
  displayName?: string;
}

/** Application accessible à l'usager (`apps` de userinfo). */
export interface App {
  address?: string;
}

/** Droits de paramétrage du module (noms d'affichage de leurs actions). */
export const RIGHTS = {
  periodYearManage: "period.year.manage",
  timeSlotsManage: "time.slot.manage",
  paramServices: "viescolaire.paramServices",
  paramTrombinoscope: "viescolaire.trombinoscope.manage",
} as const;

/** Vrai si l'usager porte ce droit (par nom d'affichage ou par nom complet). */
export const hasWorkflow = (actions: Action[] | undefined, right: string): boolean =>
  (actions ?? []).some((a) => a.displayName === right || a.name === right);

/** Vrai si l'application de cette adresse (`/presences`…) fait partie de celles de l'usager. */
export const canAccessApp = (apps: App[] | undefined, address: string): boolean =>
  (apps ?? []).some((a) => a.address === address);

/**
 * Directeur d'école primaire sans être super-administrateur : l'onglet « Emploi du temps » lui est masqué
 * (il s'initialise depuis l'application Présences), comme dans l'AngularJS.
 */
export const isDirector1DNonAdmc = (actions: Action[] | undefined, superAdmin: boolean): boolean =>
  hasWorkflow(actions, "presences.init.settings.1d") && hasWorkflow(actions, "presences.init.popup") && !superAdmin;
