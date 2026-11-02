import { describe, expect, it } from "vitest";
import { asList, canDeleteType, CDT_SECTIONS, isInitialized, isValidTypeLabel, sortTypes, teachersLabel, typePayload, typeRoutes, withEnabled } from "./cdt";

describe("paramétrage cahier de textes", () => {
  it("expose les 4 entrées dans l'ordre de l'Angular", () => {
    expect(CDT_SECTIONS.map((s) => s.id)).toEqual(["init", "homework", "session", "audience"]);
  });
  it("valide le libellé : 2 caractères minimum", () => {
    expect(isValidTypeLabel("Ex")).toBe(true);
    expect(isValidTypeLabel("E")).toBe(false);
    expect(isValidTypeLabel("  E ")).toBe(false);
    expect(isValidTypeLabel("")).toBe(false);
  });
  it("ne propose la suppression que s'il reste plusieurs types", () => {
    expect(canDeleteType(1)).toBe(false);
    expect(canDeleteType(0)).toBe(false);
    expect(canDeleteType(2)).toBe(true);
  });
  it("construit les routes de chaque sorte de type", () => {
    expect(typeRoutes("homework", "s1", 4)).toEqual({ list: "/diary/homework-types/s1", create: "/diary/homework-type", update: "/diary/homework-type/4", remove: "/diary/homework-type/4/s1" });
    expect(typeRoutes("session", "s1", 4)).toEqual({ list: "/diary/session-types?idStructure=s1", create: "/diary/session-type", update: "/diary/session-type/4", remove: "/diary/session-type/4/s1" });
  });
  it("prépare le corps avec libellé rogné", () => {
    expect(typePayload("s1", " Exercice ")).toEqual({ structure_id: "s1", label: "Exercice" });
    expect(typePayload("s1", "Leçon", 7)).toEqual({ id: 7, structure_id: "s1", label: "Leçon" });
  });
  it("trie par rang", () => {
    expect(sortTypes([{ id: 1, structure_id: "s", label: "B", rank: 2 }, { id: 2, structure_id: "s", label: "A", rank: 1 }]).map((t) => t.id)).toEqual([2, 1]);
  });
  it("lit l'état d'initialisation", () => {
    expect(isInitialized({ initialized: true })).toBe(true);
    expect(isInitialized({ initialized: false })).toBe(false);
    expect(isInitialized({})).toBe(false);
    expect(isInitialized(undefined)).toBe(false);
  });
  it("formate les enseignants et bascule une classe", () => {
    const a = { id: "c1", name: "6A", enabled: true, teacherNames: ["Durand", "Martin"] };
    expect(teachersLabel(a)).toBe("Durand, Martin");
    expect(teachersLabel({ ...a, teacherNames: [] })).toBeNull();
    const list = withEnabled([a, { ...a, id: "c2" }], "c1", false);
    expect(list.map((x) => x.enabled)).toEqual([false, true]);
  });
  it("écarte une réponse non liste", () => {
    expect(asList({ error: "x" })).toEqual([]);
    expect(asList([1])).toEqual([1]);
  });
});
