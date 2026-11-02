import { describe, expect, it } from "vitest";
import {
  canSaveModel, canSaveOpinion, dropRange, filterModels, formatSize, importOutcome, isReadOnlyOpinion, isStructureActive, moveRange, newModel, opinionsOfType, opinionUpdatePath,
  prepareSubjects, reshuffleOk, reshufflePayload, sortedSubjects, sortPeriodTypes, syncCheckboxHidden, syncChecked,
} from "./competencesMisc";

describe("avis du conseil", () => {
  const list = [
    { id: 1, libelle: "Félicitations", type_avis: 1, id_etablissement: null, active: true },
    { id: 2, libelle: "Passage", type_avis: 2, id_etablissement: "s1", active: false },
  ];
  it("sépare les types et repère les avis de la plateforme", () => {
    expect(opinionsOfType(list, 1).map((o) => o.id)).toEqual([1]);
    expect(opinionsOfType(list, 2).map((o) => o.id)).toEqual([2]);
    expect(isReadOnlyOpinion(list[0])).toBe(true);
    expect(isReadOnlyOpinion(list[1])).toBe(false);
  });
  it("refuse un libellé vide et encode l'adresse", () => {
    expect(canSaveOpinion("")).toBe(false);
    expect(canSaveOpinion("Très bien")).toBe(true);
    expect(opinionUpdatePath({ id: 4, active: true, libelle: "Très bien & +" })).toBe("/competences/avis/bilan/periodique?id_avis=4&active=true&libelle=Tr%C3%A8s%20bien%20%26%20%2B");
  });
});

describe("libellés des matières", () => {
  const models = [{ title: "Modèle par défaut", subjects: [{ name: "Maths", libelle: "Maths" }, { name: "Art", libelle: "Arts" }] }, { id: 3, title: "Collège", subjects: [] }];
  it("cherche par début de titre, trié", () => {
    expect(filterModels(models, "").map((m) => m.title)).toEqual(["Collège", "Modèle par défaut"]);
    expect(filterModels(models, "mod").map((m) => m.title)).toEqual(["Modèle par défaut"]);
    expect(filterModels(models, "*")).toHaveLength(2);
  });
  it("crée un modèle à partir du premier, sans le modifier", () => {
    const m = newModel(models);
    expect(m.title).toBe("");
    expect(m.subjects).toEqual(models[0].subjects);
    m.subjects[0].libelle = "X";
    expect(models[0].subjects[0].libelle).toBe("Maths");
    expect(canSaveModel(m)).toBe(false);
    expect(canSaveModel({ ...m, title: "Lycée" })).toBe(true);
    expect(sortedSubjects(models[0]).map((s) => s.name)).toEqual(["Art", "Maths"]);
  });
});

describe("ordre des matières", () => {
  it("calcule les bornes d'un déplacement", () => {
    expect(moveRange(3, "up")).toEqual({ indexStart: 2, indexEnd: -1 });
    expect(moveRange(3, "down")).toEqual({ indexStart: 3, indexEnd: 4 });
  });
  it("calcule les bornes d'un glisser-déposer", () => {
    expect(dropRange(2, 2)).toBeNull();
    expect(dropRange(4, 1)).toEqual({ indexStart: 2, indexEnd: -1 });
    expect(dropRange(4, undefined)).toEqual({ indexStart: 0, indexEnd: -1 });
    expect(dropRange(1, 3)).toEqual({ indexStart: 1, indexEnd: 3 });
  });
  it("prépare les données et le corps", () => {
    expect(prepareSubjects([{ id: "a", name: "Maths", rank: 0, externalId: "009800", source: "AAF" }])).toEqual([{ id: "a", name: "Maths", rank: 0, code: "009800", source: "AAF" }]);
    expect(reshufflePayload("s1", "a", { indexStart: 1, indexEnd: -1 })).toEqual({ idStructure: "s1", id: "a", indexStart: 1, indexEnd: -1 });
    expect(reshuffleOk({ ids: [] })).toBe(true);
    expect(reshuffleOk({})).toBe(false);
    expect(reshuffleOk(null)).toBe(false);
  });
});

describe("import des retards et absences", () => {
  it("trie les périodes", () => {
    expect(sortPeriodTypes([{ id: 1, type: 2, ordre: 2 }, { id: 2, type: 1, ordre: 3 }, { id: 3, type: 2, ordre: 1 }]).map((p) => p.id)).toEqual([2, 3, 1]);
  });
  it("gère la case Présences", () => {
    expect(syncCheckboxHidden({ installed: true, activate: true })).toBe(false);
    expect(syncCheckboxHidden({ installed: true, activate: false })).toBe(true);
    expect(syncChecked({ installed: true, activate: true, presences_sync: true })).toBe(true);
    expect(syncChecked({ installed: false, activate: true, presences_sync: true })).toBe(false);
  });
  it("interprète le résultat d'un fichier", () => {
    expect(importOutcome({ error: true }).kind).toBe("error");
    expect(importOutcome({ isValid: false }).kind).toBe("invalid");
    expect(importOutcome({ isValid: true, nbInsert: 40, nbLines: 52 })).toEqual({ kind: "success", inserted: 40, skipped: 10 });
    expect(importOutcome({ isValid: true, nbInsert: 40, nbLines: 42 }).skipped).toBe(0);
  });
  it("formate une taille", () => {
    expect(formatSize(500)).toBe("500 o");
    expect(formatSize(2048)).toBe("2 Ko");
    expect(formatSize(3145728)).toBe("3 Mo");
  });
});

describe("activation du module", () => {
  it("est actif si l'établissement figure dans la liste", () => {
    expect(isStructureActive([{ id_etablissement: "s1" }], "s1")).toBe(true);
    expect(isStructureActive([{ id_etablissement: "s2" }], "s1")).toBe(false);
    expect(isStructureActive(null, "s1")).toBe(false);
  });
});
