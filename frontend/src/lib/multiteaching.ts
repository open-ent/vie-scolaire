import { MultiTeaching, Service } from "./services";

/** Dates d'un remplacement au format `AAAA-MM-JJ`. */
export interface Dates {
  start: string;
  end: string;
  entered: string;
}

export interface DateErrors {
  startAfterEnd: boolean;
}

const addDay = (d: string): string => {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString().slice(0, 10);
};

/**
 * Normalise les dates comme l'AngularJS : début et fin égaux → la fin passe au lendemain ; fin de saisie avant la fin
 * → elle prend la date de fin. Ex. 05/11 → 05/11 devient 05/11 → 06/11.
 */
export const normalizeDates = (d: Dates): Dates => {
  let { start, end, entered } = d;
  if (start && end && start === end) end = addDay(end);
  if (end && entered && entered < end) entered = end;
  return { start, end, entered };
};

export const dateErrors = (d: Dates): DateErrors => ({ startAfterEnd: !!d.start && !!d.end && d.start > d.end });

/** Un remplacement est « en cours » si aujourd'hui est entre son début et sa fin de saisie (inclus). */
export const isCurrent = (m: MultiTeaching, today: string = new Date().toISOString().slice(0, 10)): boolean =>
  !!m.start_date && !!m.entered_end_date && m.start_date.slice(0, 10) <= today && today <= m.entered_end_date.slice(0, 10);

/** Corps de création d'un co-enseignement (plusieurs co-enseignants, plusieurs classes). */
export const coTeachingPayload = (service: Service, structureId: string, teacherIds: string[], classIds: string[]) => ({
  structure_id: structureId,
  main_teacher_id: service.id_enseignant,
  second_teacher_ids: teacherIds,
  subject_id: service.id_matiere,
  class_or_group_ids: classIds,
  co_teaching: true,
  is_visible: service.is_visible,
});

/**
 * Corps de création ou de modification d'un remplacement (un seul remplaçant). À la modification, les lignes dont la
 * classe reste choisie sont mises à jour et celles dont la classe est retirée sont supprimées.
 */
export const substitutePayload = (service: Service, structureId: string, teacherId: string, classIds: string[], dates: Dates, old?: MultiTeaching) => {
  const body: Record<string, unknown> = {
    structure_id: structureId,
    main_teacher_id: service.id_enseignant,
    second_teacher_ids: [teacherId],
    subject_id: service.id_matiere,
    class_or_group_ids: classIds,
    start_date: dates.start,
    end_date: dates.end,
    entered_end_date: dates.entered,
    co_teaching: false,
    is_visible: service.is_visible,
  };
  if (old) {
    const lines = old.idsAndIdsGroups ?? [];
    body.ids_multiTeachingToUpdate = lines.filter((l) => classIds.includes(l.idGroup)).map((l) => l.id);
    body.ids_multiTeachingToDelete = lines.filter((l) => !classIds.includes(l.idGroup)).map((l) => l.id);
  }
  return body;
};

/** Identifiants des lignes à supprimer pour retirer un co-enseignant ou un remplaçant. */
export const deleteIds = (m: MultiTeaching): number[] => (m.idsAndIdsGroups ?? []).map((l) => l.id);

/** Co-enseignement : au moins un co-enseignant et une classe. Remplacement : un remplaçant, une classe, des dates cohérentes. */
export const canSave = (isCo: boolean, teacherIds: string[], classIds: string[], dates: Dates): boolean => {
  if (teacherIds.length === 0 || classIds.length === 0) return false;
  if (isCo) return true;
  return !!dates.start && !!dates.end && !!dates.entered && !dateErrors(dates).startAfterEnd;
};
