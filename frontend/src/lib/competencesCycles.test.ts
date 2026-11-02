import { describe, expect, it } from "vitest";
import { allTypes, checkPayload, cycleLabel, filterGroupes, Groupe, initialChoice, isUnlinked, parseChoice, savePayload, toggleAll, toUpdate } from "./competencesCycles";

const g = (id: string, name: string, type_groupe: number, id_cycle: number | null): Groupe => ({ id, name, type_groupe, id_cycle });
const list = [g("1", "6B", 0, 1), g("2", "6A", 0, null), g("3", "Latin", 1, 2), g("4", "5A", 0, 0)];

describe("rattachement des classes aux cycles", () => {
  it("trie par type puis par nom", () => {
    expect(filterGroupes(list, { types: allTypes(), idCycle: undefined, name: "" }).map((x) => x.name)).toEqual(["5A", "6A", "6B", "Latin"]);
  });
  it("filtre par type, cycle et début du nom", () => {
    expect(filterGroupes(list, { types: { 0: true, 1: false, 2: true }, idCycle: undefined, name: "" }).map((x) => x.id)).toEqual(["4", "2", "1"]);
    expect(filterGroupes(list, { types: allTypes(), idCycle: 1, name: "" }).map((x) => x.id)).toEqual(["1"]);
    expect(filterGroupes(list, { types: allTypes(), idCycle: null, name: "" }).map((x) => x.id)).toEqual(["4", "2"]);
    expect(filterGroupes(list, { types: allTypes(), idCycle: undefined, name: "6" }).map((x) => x.id)).toEqual(["2", "1"]);
    expect(filterGroupes(list, { types: allTypes(), idCycle: undefined, name: "*" })).toHaveLength(4);
  });
  it("considère 0 et null comme non rattaché", () => {
    expect(isUnlinked(g("x", "A", 0, 0))).toBe(true);
    expect(isUnlinked(g("x", "A", 0, null))).toBe(true);
    expect(isUnlinked(g("x", "A", 0, 3))).toBe(false);
  });
  it("propose le cycle de la première classe cochée", () => {
    expect(initialChoice([list[0]])).toBe("1");
    expect(initialChoice([list[1]])).toBe("0");
    expect(initialChoice([])).toBe("");
  });
  it("ne met à jour que les classes qui changent de cycle", () => {
    expect(toUpdate([list[0], list[1], list[3]], 1).map((x) => x.id)).toEqual(["2", "4"]);
    expect(toUpdate([list[1], list[3]], 0)).toEqual([]);
  });
  it("lit le choix et compose les corps", () => {
    expect(parseChoice("")).toBeNull();
    expect(parseChoice("0")).toBe(0);
    expect(parseChoice("2")).toBe(2);
    expect(checkPayload([list[0]], 2)).toEqual({ idClasses: ["1"], id_cycle: 2 });
    expect(savePayload([list[0], list[2]], 2)).toEqual({ idClasses: ["1", "3"], id_cycle: 2, typesGroupes: [0, 1] });
  });
  it("libelle le cycle", () => {
    const cycles = [{ id_cycle: 1, libelle: "Cycle 3" }];
    expect(cycleLabel(cycles, 1)).toBe("Cycle 3");
    expect(cycleLabel(cycles, 0)).toBeNull();
    expect(cycleLabel(cycles, 9)).toBeNull();
  });
  it("coche et décoche toute la liste affichée", () => {
    expect([...toggleAll(new Set(["9"]), list.slice(0, 2), true)].sort()).toEqual(["1", "2", "9"]);
    expect([...toggleAll(new Set(["1", "2", "9"]), list.slice(0, 2), false)]).toEqual(["9"]);
  });
});
