import { describe, expect, it } from "vitest";
import { canSave, coTeachingPayload, dateErrors, deleteIds, isCurrent, normalizeDates, substitutePayload } from "./multiteaching";
import { Service } from "./services";

const svc = { id_enseignant: "t1", id_matiere: "m1", id_groupe: "g1", is_visible: true } as unknown as Service;

describe("co-enseignants et remplaçants", () => {
  it("passe la fin au lendemain si début et fin sont égaux", () => {
    expect(normalizeDates({ start: "2026-11-05", end: "2026-11-05", entered: "2026-11-05" })).toEqual({ start: "2026-11-05", end: "2026-11-06", entered: "2026-11-06" });
    expect(normalizeDates({ start: "2026-11-30", end: "2026-11-30", entered: "2026-11-30" }).end).toBe("2026-12-01");
  });
  it("ramène la fin de saisie à la fin si elle est antérieure", () => {
    expect(normalizeDates({ start: "2026-11-01", end: "2026-11-10", entered: "2026-11-05" }).entered).toBe("2026-11-10");
    expect(normalizeDates({ start: "2026-11-01", end: "2026-11-10", entered: "2026-11-20" }).entered).toBe("2026-11-20");
  });
  it("signale un début après la fin", () => {
    expect(dateErrors({ start: "2026-11-10", end: "2026-11-01", entered: "2026-11-10" }).startAfterEnd).toBe(true);
    expect(dateErrors({ start: "2026-11-01", end: "2026-11-10", entered: "2026-11-10" }).startAfterEnd).toBe(false);
  });
  it("reconnaît un remplacement en cours", () => {
    const m = { second_teacher_id: "t2", start_date: "2026-11-01", entered_end_date: "2026-11-10" };
    expect(isCurrent(m, "2026-11-05")).toBe(true);
    expect(isCurrent(m, "2026-11-11")).toBe(false);
    expect(isCurrent({ second_teacher_id: "t2" }, "2026-11-05")).toBe(false);
  });
  it("construit le corps d'un co-enseignement", () => {
    expect(coTeachingPayload(svc, "s1", ["t2", "t3"], ["g1"])).toEqual({ structure_id: "s1", main_teacher_id: "t1", second_teacher_ids: ["t2", "t3"], subject_id: "m1", class_or_group_ids: ["g1"], co_teaching: true, is_visible: true });
  });
  it("construit le corps d'un remplacement, avec mise à jour et suppression des lignes", () => {
    const old = { second_teacher_id: "t2", idsAndIdsGroups: [{ id: 10, idGroup: "g1" }, { id: 11, idGroup: "g2" }] };
    const b = substitutePayload(svc, "s1", "t3", ["g1"], { start: "2026-11-01", end: "2026-11-10", entered: "2026-11-12" }, old);
    expect(b).toMatchObject({ second_teacher_ids: ["t3"], co_teaching: false, start_date: "2026-11-01", ids_multiTeachingToUpdate: [10], ids_multiTeachingToDelete: [11] });
    expect(substitutePayload(svc, "s1", "t3", ["g1"], { start: "a", end: "b", entered: "c" })).not.toHaveProperty("ids_multiTeachingToUpdate");
  });
  it("liste les lignes à supprimer", () => {
    expect(deleteIds({ second_teacher_id: "t2", idsAndIdsGroups: [{ id: 1, idGroup: "g" }, { id: 2, idGroup: "h" }] })).toEqual([1, 2]);
    expect(deleteIds({ second_teacher_id: "t2" })).toEqual([]);
  });
  it("valide l'enregistrement", () => {
    const ok = { start: "2026-11-01", end: "2026-11-10", entered: "2026-11-10" };
    expect(canSave(true, ["t2"], ["g1"], { start: "", end: "", entered: "" })).toBe(true);
    expect(canSave(true, [], ["g1"], ok)).toBe(false);
    expect(canSave(false, ["t2"], ["g1"], ok)).toBe(true);
    expect(canSave(false, ["t2"], [], ok)).toBe(false);
    expect(canSave(false, ["t2"], ["g1"], { start: "2026-11-10", end: "2026-11-01", entered: "2026-11-10" })).toBe(false);
  });
});
