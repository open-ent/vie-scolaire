import { describe, expect, it } from "vitest";
import { addableClasses, classesOf, sortGroupings, validGroupingName } from "./groupings";

const g = (id: string, name: string, classes: string[] = []) => ({ id, name, student_divisions: classes.map((c) => ({ id: c, name: c.toUpperCase() })) });

describe("regroupements", () => {
  it("trie par nom", () => {
    expect(sortGroupings([g("2", "Sixièmes"), g("1", "Cinquièmes")]).map((x) => x.id)).toEqual(["1", "2"]);
  });
  it("refuse un nom vide", () => {
    expect(validGroupingName("  ")).toBe(false);
    expect(validGroupingName("Niveau 6")).toBe(true);
  });
  it("ne propose que les classes absentes du regroupement", () => {
    const all = [{ id: "a", name: "6A" }, { id: "b", name: "6B" }, { id: "c", name: "5A" }];
    expect(addableClasses(all, g("1", "Niveau", ["a"])).map((c) => c.name)).toEqual(["5A", "6B"]);
  });
  it("trie les classes d'un regroupement", () => {
    expect(classesOf(g("1", "N", ["b", "a"])).map((c) => c.id)).toEqual(["a", "b"]);
  });
});
