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
