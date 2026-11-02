import { describe, expect, it } from "vitest";
import {
  buildEnseignements, canSaveItem, containsIgnoreCase, createItemPayload, deleteOutcome, domaineHasMatch, enseignementsOfCycle, hasMatch, highlightParts,
  maskOutcome, matchesCompetence, moveItem, newItemFor, orderedItems, orderPayload, toggleDomaine, Competence,
} from "./competencesItems";

const c = (id: number, nom: string, over: Partial<Competence> = {}): Competence => ({ id, nom, id_cycle: 1, id_enseignement: 10, ...over });

describe("items de compétences", () => {
  it("aplatit les connaissances et leurs items", () => {
    const e = buildEnseignements([{ id: 10, nom: "Français", competences_1: [{ ...c(1, "Lire"), competences_2: [c(2, "Lire un texte")] }, c(3, "Écrire")] }]);
    expect(e[0].competences.map((x) => x.nom)).toEqual(["Lire", "Écrire"]);
    expect(e[0].competences[0].competences?.map((x) => x.nom)).toEqual(["Lire un texte"]);
    expect(e[0].competences[1].competences).toEqual([]);
  });
  it("ne garde que les connaissances du cycle et masque les enseignements vides", () => {
    const e = buildEnseignements([
      { id: 10, nom: "Français", competences_1: [c(1, "Lire", { id_cycle: 1 }), c(2, "Écrire", { id_cycle: 2 })] },
      { id: 11, nom: "Maths", competences_1: [c(3, "Calculer", { id_cycle: 2 })] },
    ]);
    const c1 = enseignementsOfCycle(e, 1);
    expect(c1.map((x) => x.nom)).toEqual(["Français"]);
    expect(c1[0].competences.map((x) => x.nom)).toEqual(["Lire"]);
    expect(enseignementsOfCycle(e, 3)).toEqual([]);
  });
  it("recherche sans casse ; un mot vide ne trouve rien", () => {
    expect(containsIgnoreCase("Lire un texte", "TEXTE")).toBe(true);
    expect(containsIgnoreCase("Lire", "  ")).toBe(false);
    expect(matchesCompetence(c(1, "Lire", { code_domaine: "D1.2" }), "d1")).toBe(true);
  });
  it("surligne toutes les occurrences", () => {
    expect(highlightParts("Lire un texte lire", "lire")).toEqual([{ text: "Lire", hit: true }, { text: " un texte ", hit: false }, { text: "lire", hit: true }]);
    expect(highlightParts("abc", "")).toEqual([{ text: "abc", hit: false }]);
  });
  it("déplie les sections qui contiennent un résultat", () => {
    const e = buildEnseignements([{ id: 10, nom: "Français", competences_1: [{ ...c(1, "Lire"), competences_2: [c(2, "Lire un texte")] }] }])[0];
    expect(hasMatch(e, "texte")).toBe(true);
    expect(hasMatch(e, "calcul")).toBe(false);
    expect(hasMatch(e, "")).toBe(false);
    expect(domaineHasMatch({ id: 1, niveau: 1, libelle: "D", codification: "1", id_cycle: 1, domaines: [{ id: 2, niveau: 2, libelle: "S", codification: "1.1", id_cycle: 1, competences: [c(1, "Lire")] }] }, "lire")).toBe(true);
  });
  it("ordonne par rang puis déplace d'un cran", () => {
    const items = [c(1, "A"), c(2, "B"), c(3, "C")];
    expect(orderedItems(items).map((x) => x.id)).toEqual([1, 2, 3]);
    expect(orderedItems([c(1, "A", { index: 2 }), c(2, "B", { index: 0 })]).map((x) => x.id)).toEqual([2, 1]);
    const moved = moveItem(items, 2, -1);
    expect(moved?.map((x) => x.id)).toEqual([2, 1, 3]);
    expect(moved?.map((x) => x.index)).toEqual([0, 1, 2]);
    expect(moveItem(items, 1, -1)).toBeNull();
    expect(moveItem(items, 3, 1)).toBeNull();
    expect(orderPayload(moved!, "s1").index[0]).toEqual({ id: 2, id_etablissement: "s1", id_enseignement: 10, index: 0 });
  });
  it("prépare et valide la création d'un item", () => {
    const item = newItemFor(c(5, "Lire", { ids_domaine_int: [3, 4] }), "s1");
    expect(item).toMatchObject({ id_parent: 5, id_type: 2, ids_domaine: [3, 4], id_etablissement: "s1", nom: "" });
    expect(canSaveItem(item)).toBe(false);
    expect(canSaveItem({ ...item, nom: " Lire à voix haute " })).toBe(true);
    expect(canSaveItem({ ...item, nom: "X", ids_domaine: [] })).toBe(false);
    expect(createItemPayload({ ...item, nom: "X" })).toEqual({ nom: "X", id_etablissement: "s1", id_parent: 5, id_type: 2, id_cycle: 1, id_enseignement: 10, ids_domaine: [3, 4] });
    expect(newItemFor(c(6, "Sans domaine"), "s1").ids_domaine).toEqual([]);
  });
  it("coche et décoche un domaine", () => {
    expect(toggleDomaine([1], 2, true)).toEqual([1, 2]);
    expect(toggleDomaine([1, 2], 2, true)).toEqual([1, 2]);
    expect(toggleDomaine([1, 2], 1, false)).toEqual([2]);
  });
  it("interprète les retours du serveur", () => {
    expect(deleteOutcome({ deletecompetence: "MASQUAGE" })).toBe("mask");
    expect(deleteOutcome({})).toBe("deleted");
    expect(maskOutcome(true, { masquecompetence: "use" })).toBe("used");
    expect(maskOutcome(false, { masquecompetence: "use" })).toBe("done");
  });
});
