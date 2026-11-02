import { Classe, sortClasses } from "./timeSlots";

/** Regroupement (ou niveau) de classes d'un établissement. */
export interface Grouping {
  id: string;
  name: string;
  structure_id?: string;
  student_divisions: Classe[];
}

/** Regroupements triés par nom, comme la liste de l'AngularJS. */
export const sortGroupings = (list: Grouping[]): Grouping[] => [...list].sort((a, b) => a.name.localeCompare(b.name));

/** Un nom de regroupement est valide s'il n'est pas vide ; les espaces autour sont retirés à l'envoi. */
export const validGroupingName = (name: string): boolean => name.trim() !== "";

/** Classes de l'établissement qu'on peut encore ajouter à ce regroupement (celles qui n'en font pas déjà partie). */
export const addableClasses = (all: Classe[], grouping: Grouping): Classe[] => {
  const used = new Set(grouping.student_divisions.map((c) => c.id));
  return sortClasses(all.filter((c) => !used.has(c.id)));
};

/** Classes d'un regroupement, triées par nom. */
export const classesOf = (grouping: Grouping): Classe[] => sortClasses(grouping.student_divisions ?? []);
