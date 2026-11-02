export interface Slot {
  id: string;
  name: string;
  startHour: string;
  endHour: string;
}

/** Profil de plages horaires (grille horaire) d'un établissement. */
export interface TimeSlot {
  _id: string;
  name: string;
  schoolId?: string;
  /** Fin de demi-journée, au format `HH:mm:ss` (le serveur écrit `end_of_half_day`, pas `endOfHalfDay`). */
  end_of_half_day?: string;
  default?: boolean;
  slots?: Slot[];
}

export interface Classe {
  id: string;
  name: string;
}

/** `8:5` → `08:05` ; une heure déjà au bon format est inchangée. Vide si la valeur n'est pas une heure. */
export const formatTime = (time?: string): string => {
  const m = /^(\d{1,2}):(\d{1,2})/.exec(time ?? "");
  return m ? `${m[1].padStart(2, "0")}:${m[2].padStart(2, "0")}` : "";
};

/** Profil appliqué à l'établissement (marqué `default` par le serveur). */
export const defaultTimeSlot = (list: TimeSlot[]): TimeSlot | undefined => list.find((t) => t.default);

/** Fins de plage proposables comme fin de demi-journée : l'heure de fin de chaque plage, sans doublon, triées. */
export const endTimes = (slot?: TimeSlot): string[] =>
  [...new Set((slot?.slots ?? []).map((s) => formatTime(s.endHour)).filter(Boolean))].sort();

/** Classes triées par nom, comme dans la liste de l'AngularJS. */
export const sortClasses = (classes: Classe[]): Classe[] => [...classes].sort((a, b) => a.name.localeCompare(b.name));

/** Classes sans profil de plages horaires parmi `classes`, étant donné les classes déjà associées (tous profils). */
export const unassociated = (classes: Classe[], associatedIds: Set<string>): Classe[] =>
  sortClasses(classes.filter((c) => !associatedIds.has(c.id)));

/** Fin de demi-journée d'un profil, au format `HH:mm` (vide si elle n'est pas définie). */
export const endOfHalfDay = (slot?: TimeSlot): string => formatTime(slot?.end_of_half_day);
