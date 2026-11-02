import { SchoolYear } from "../lib/schoolYear";
import { http, JSON_HEADERS } from "./http";

export const settingsService = {
  schoolYear: (structureId: string) => http().get<SchoolYear>(`/viescolaire/settings/periode?structure=${structureId}`),
  createSchoolYear: (body: object) => http().post<unknown>("/viescolaire/settings/periode", body, JSON_HEADERS),
  updateSchoolYear: (id: number, body: object) => http().put<unknown>(`/viescolaire/settings/periode/${id}`, body, JSON_HEADERS),
};

export const timeSlotService = {
  list: (structureId: string) => http().get<import("../lib/timeSlots").TimeSlot[]>(`/viescolaire/time-slots?structureId=${structureId}`),
  setDefault: (id: string, structureId: string) => http().post<unknown>("/viescolaire/time-slots", { id, id_structure: structureId }, JSON_HEADERS),
  setEndOfHalfDay: (id: string, structureId: string, time: string) =>
    http().put<unknown>(`/viescolaire/time-slots?id=${id}&structureId=${structureId}`, { time, structureId }, JSON_HEADERS),
  classes: (structureId: string) => http().get<import("../lib/timeSlots").Classe[]>(`/viescolaire/classes?idEtablissement=${structureId}`),
  audience: (timeSlotId: string) => http().get<string[]>(`/viescolaire/timeslot/${timeSlotId}`),
  associate: (timeslotId: string, classId: string) => http().post<unknown>("/viescolaire/timeslot/audience", { timeslot_id: timeslotId, class_id: classId }, JSON_HEADERS),
  dissociate: (classId: string) => http().delete<unknown>(`/viescolaire/timeslot/audience/${classId}`),
  dissociateAll: (timeSlotId: string) => http().delete<unknown>(`/viescolaire/timeslot/${timeSlotId}`),
};

export const periodService = {
  list: (structureId: string) => http().get<import("../lib/periods").Periode[]>(`/viescolaire/periodes?idEtablissement=${structureId}`),
  types: () => http().get<import("../lib/periods").PeriodType[]>("/viescolaire/periodes/types"),
  save: (body: object) => http().put<unknown>("/viescolaire/periodes", body, JSON_HEADERS),
  publish: (periodId: number, publication: boolean) => http().put<unknown>(`/viescolaire/periode/${periodId}?publication=${publication}`),
};

export const exclusionService = {
  list: async (structureId: string) =>
    (await http().get<import("../lib/exclusions").Exclusion[]>(`/viescolaire/settings/periodes/exclusions?structureId=${structureId}`)) ?? [],
  create: (body: object) => http().post<unknown>("/viescolaire/settings/exclusion", body, JSON_HEADERS),
  update: (id: number, body: object) => http().put<unknown>(`/viescolaire/settings/exclusion/${id}`, body, JSON_HEADERS),
  remove: (id: number) => http().delete<unknown>(`/viescolaire/settings/exclusion/${id}`),
  /** Nombre de cours déjà programmés sur la période (avertissement avant de la fermer). */
  countCourses: async (structureId: string, start: string, end: string): Promise<number> => {
    try {
      const body = await http().get<unknown>(`/viescolaire/common/courses/${structureId}/${start}/${end}`);
      return Array.isArray(body) ? body.length : 0;
    } catch {
      return 0;
    }
  },
};

export const groupingService = {
  list: (structureId: string) => http().get<import("../lib/groupings").Grouping[]>(`/viescolaire/grouping/structure/${structureId}/list`),
  create: (structureId: string, name: string) => http().post<{ id: string }>(`/viescolaire/grouping/structure/${structureId}`, { name }, JSON_HEADERS),
  rename: (id: string, name: string) => http().put<unknown>(`/viescolaire/grouping/${id}`, { name }, JSON_HEADERS),
  remove: (id: string) => http().delete<unknown>(`/viescolaire/grouping/${id}`),
  addClass: (id: string, classId: string) => http().post<unknown>(`/viescolaire/grouping/${id}/add`, { student_division_id: classId }, JSON_HEADERS),
  /** DELETE avec corps JSON (le client de la plateforme n'en porte pas) : appel direct, avec le jeton CSRF. */
  removeClass: async (id: string, classId: string) => {
    const token = /XSRF-TOKEN=([^;]+)/.exec(document.cookie)?.[1];
    const res = await fetch(`/viescolaire/grouping/${id}/delete`, {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json", ...(token ? { "X-XSRF-TOKEN": decodeURIComponent(token) } : {}) },
      body: JSON.stringify({ student_division_id: classId }),
    });
    if (!res.ok) throw new Error(String(res.status));
  },
};

export const teachingService = {
  list: (structureId: string, filter: string) => http().get<import("../lib/services").RawService[]>(`/viescolaire/services?idEtablissement=${structureId}&${filter}`),
  groups: (structureId: string) => http().get<import("../lib/services").Group[]>(`/viescolaire/classes?idEtablissement=${structureId}&forAdmin=true`),
  matieres: (structureId: string) => http().get<import("../lib/services").Matiere[]>(`/viescolaire/matieres?idEtablissement=${structureId}`),
  teachers: (structureId: string) => http().get<import("../lib/services").Teacher[]>(`/viescolaire/teachers?idEtablissement=${structureId}`),
  subTopics: (structureId: string) => http().get<import("../lib/services").SubTopic[]>(`/viescolaire/types/sousmatieres?idStructure=${structureId}`),
  create: (body: object) => http().post<unknown>("/viescolaire/service", body, JSON_HEADERS),
  remove: (path: string) => http().delete<unknown>(path),
};

export const multiTeachingService = {
  create: (structureId: string, body: object) => http().post<unknown>(`/viescolaire/multiteaching/create?structureId=${structureId}`, body, JSON_HEADERS),
  update: (structureId: string, body: object) => http().put<unknown>(`/viescolaire/multiteaching/update?structureId=${structureId}`, body, JSON_HEADERS),
  remove: (structureId: string, ids: number[]) => http().put<unknown>(`/viescolaire/multiteaching/delete?structureId=${structureId}`, { ids }, JSON_HEADERS),
};

export const subTopicService = {
  create: (structureId: string, libelle: string) => http().post<{ id: number }>("/viescolaire/types/sousmatiere", { libelle, id_structure: structureId }, JSON_HEADERS),
  update: (id: number, structureId: string, libelle: string) => http().put<unknown>(`/viescolaire/types/sousmatiere/${id}`, { id, libelle, id_structure: structureId }, JSON_HEADERS),
  relations: (body: object) => http().post<unknown>("/viescolaire/types/sousmatieres/relations", body, JSON_HEADERS),
};

/** Devoirs (module Compétences) liés à un service : bloquent sa suppression tant qu'ils ne sont pas supprimés ou déplacés. */
export const serviceHomeworkService = {
  list: (structureId: string, s: { id_matiere: string; id_groups?: string[]; id_groupe: string; id_enseignant: string }) =>
    http().get<Array<{ id: number }>>(
      `/competences/devoirs/service?idEtablissement=${structureId}&id_matiere=${s.id_matiere}&id_groups=${(s.id_groups && s.id_groups.length > 0 ? s.id_groups : [s.id_groupe]).join(",")}&id_enseignant=${s.id_enseignant}`,
    ),
  remove: (ids: number[]) => http().put<unknown>("/competences/devoirs/delete", { id_devoirs: ids }, JSON_HEADERS),
  move: (structureId: string, ids: number[], matiereId: string) => http().put<unknown>(`/competences/devoirs/service?idEtablissement=${structureId}`, { id_devoirs: ids, id_matiere: matiereId }, JSON_HEADERS),
};

const xsrf = (): Record<string, string> => {
  const m = /XSRF-TOKEN=([^;]+)/.exec(document.cookie);
  return m ? { "X-XSRF-TOKEN": decodeURIComponent(m[1]) } : {};
};

/** Envoi d'un fichier (multipart) : appel direct, le navigateur pose lui-même la frontière du corps. */
const sendFile = async (method: "POST" | "PUT", url: string, file: File): Promise<Response> => {
  const body = new FormData();
  body.append("file", file);
  return fetch(url, { method, credentials: "include", headers: xsrf(), body });
};

export const trombinoscopeService = {
  settings: async (structureId: string) => (await http().get<{ active: boolean }>(`/viescolaire/structures/${structureId}/trombinoscope/setting`))?.active ?? false,
  setSettings: (structureId: string, active: boolean) => http().post<unknown>(`/viescolaire/structures/${structureId}/trombinoscope/setting`, { active }, JSON_HEADERS),
  reports: async (structureId: string) => (await http().get<{ all: import("../lib/trombinoscope").Report[] }>(`/viescolaire/structures/${structureId}/trombinoscope/reports?limit=-1&offset=0`))?.all ?? [],
  failures: async (structureId: string) => (await http().get<{ all: import("../lib/trombinoscope").Failure[] }>(`/viescolaire/structures/${structureId}/trombinoscope/failures`))?.all ?? [],
  clearFailures: (structureId: string) => http().delete<unknown>(`/viescolaire/structures/${structureId}/trombinoscope/failures`),
  link: (structureId: string, studentId: string, pictureId: string) => http().post<unknown>(`/viescolaire/structures/${structureId}/students/${studentId}/trombinoscope`, { pictureId }, JSON_HEADERS),
  importZip: (structureId: string, file: File) => sendFile("POST", `/viescolaire/structures/${structureId}/trombinoscope`, file),
  replacePicture: (structureId: string, studentId: string, file: File) => sendFile("PUT", `/viescolaire/structures/${structureId}/students/${studentId}/trombinoscope`, file),
  removePicture: (structureId: string, studentId: string) => http().delete<unknown>(`/viescolaire/structures/${structureId}/students/${studentId}/trombinoscope`),
  students: async (structureId: string, query: string) => (await http().get<import("../lib/trombinoscope").Student[]>(`/viescolaire/structures/${structureId}/students${query}`)) ?? [],
  searchStudents: (structureId: string, q: string) =>
    http().get<import("../lib/trombinoscope").Found[]>(`/viescolaire/user/search?q=${encodeURIComponent(q.replace("\\s", "").toLowerCase())}&structureId=${structureId}&field=lastName&field=firstName&field=displayName&profile=Student`),
  searchGroups: (structureId: string, q: string) =>
    http().get<import("../lib/trombinoscope").Found[]>(`/viescolaire/group/search?q=${encodeURIComponent(q.replace("\\s", "").toLowerCase())}&structureId=${structureId}&field=name`),
};
