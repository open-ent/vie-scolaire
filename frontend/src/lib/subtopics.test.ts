import { describe, expect, it } from "vitest";
import { addableMatieres, defaultSubTopic, initialSelection, keepLabel, needsConfirmation, relationsPayload } from "./subtopics";

const subs = [{ id: 6, libelle: "Latin" }, { id: 7, libelle: "Grec" }];
const m = (id: string, name: string, ids: number[] = []) => ({ id, name, sous_matieres: ids.map((i) => ({ id_type_sousmatiere: i })) });

describe("sous-matières", () => {
  it("coche au départ celles déjà rattachées à la matière", () => {
    expect(initialSelection(m("a", "Français", [7]), subs)).toEqual([7]);
    expect(initialSelection(undefined, subs)).toEqual([]);
  });
  it("propose les matières pas encore dans la liste, triées", () => {
    expect(addableMatieres([m("b", "Latin"), m("a", "Arts")], ["b"]).map((x) => x.name)).toEqual(["Arts"]);
  });
  it("demande confirmation pour les matières cochées sans sous-matière, seulement si on en rattache", () => {
    const list = [m("a", "Français"), m("b", "Maths", [6])];
    expect(needsConfirmation(list, ["a", "b"], [6]).map((x) => x.id)).toEqual(["a"]);
    expect(needsConfirmation(list, ["a", "b"], [])).toEqual([]);
    expect(needsConfirmation(list, ["b"], [6])).toEqual([]);
  });
  it("cite la première sous-matière cochée", () => {
    expect(defaultSubTopic(subs, [7, 6])?.libelle).toBe("Latin");
    expect(defaultSubTopic(subs, [])).toBeUndefined();
  });
  it("construit le corps des relations", () => {
    expect(relationsPayload(["a"], [6, 7])).toEqual({ topics: ["a"], subTopics: [6, 7] });
  });
  it("un libellé vidé reprend l'ancien", () => {
    expect(keepLabel("  ", "Latin")).toBe("Latin");
    expect(keepLabel(" Grec ", "Latin")).toBe("Grec");
  });
});
