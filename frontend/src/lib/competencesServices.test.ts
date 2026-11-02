import { describe, expect, it } from "vitest";
import {
  applyWords, classifyWord, Context, enrich, evaluableState, filtersQuery, DEFAULT_FILTERS, homeworkMessage, homeworkQuery, isCurrentSubstitute, mainEyeLocked, mergedValues,
  movedServicePayload, multiEyeLocked, MULTIPLES, nextSortState, paramsPayload, RawService, sortRows, switchedOff, validCoefficient, withEvaluable,
} from "./competencesServices";

const ctx: Context = {
  structureId: "s1",
  classes: [{ id: "g1", name: "6A" }, { id: "g2", name: "6B" }, { id: "g3", name: "5A" }],
  matieres: [{ id: "m1", name: "Maths", externalId: "009", source: "AAF", sous_matieres: [{ id_type_sousmatiere: 6 }] }, { id: "m2", name: "Latin", externalId: "010", source: "AAF" }],
  teachers: [{ id: "t1", displayName: "DUPONT Anne" }, { id: "t2", displayName: "MARTIN Paul" }],
  subTopicTypes: [{ id: 6, libelle: "Algèbre" }],
  subTopicStored: [{ id_teacher: "t1", id_topic: "m1", id_group: "g1", id_subtopic: 6, coefficient: "2.5" }],
};
const raw = (over: Partial<RawService> = {}): RawService => ({
  id_groupe: "g1", id_groups: ["g1", "g2"], id_enseignant: "t1", id_matiere: "m1", modalite: "S", evaluable: true, coefficient: 1, is_visible: true,
  competencesParams: [{ id_groupe: "g1", modalite: "S", evaluable: true, coefficient: 1 }, { id_groupe: "g2", modalite: "S", evaluable: true, coefficient: 1 }],
  ...over,
});

describe("services (paramétrage Compétences)", () => {
  it("résout les noms et ignore un service incomplet", () => {
    const rows = enrich([raw(), raw({ id_enseignant: "inconnu" }), raw({ id_groupe: "zz" })], ctx);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ topicName: "Maths (009 - AAF)", nom_enseignant: "DUPONT Anne", nom_groupe: "6A", groupsName: "6A, 6B" });
    expect(rows[0].subTopics).toEqual([expect.objectContaining({ libelle: "Algèbre", coefficient: 2.5, id_group: "g1" })]);
  });
  it("sans paramètres par classe, le groupe principal fait foi ; sous-matière sans réglage = coefficient 1", () => {
    const [r] = enrich([raw({ competencesParams: [], id_matiere: "m1", id_groupe: "g2" })], ctx);
    expect(r.groupsName).toBe("6B");
    expect(r.subTopics[0].coefficient).toBe(1);
  });
  it("affiche « multiples » quand les classes divergent", () => {
    expect(mergedValues(raw())).toEqual({ modalite: "S", coefficient: 1, multipleCoefficient: false });
    const diff = raw({ competencesParams: [{ id_groupe: "g1", modalite: "S", evaluable: true, coefficient: 1 }, { id_groupe: "g2", modalite: "O", evaluable: true, coefficient: 2 }] });
    expect(mergedValues(diff)).toEqual({ modalite: MULTIPLES, coefficient: undefined, multipleCoefficient: true });
    expect(mergedValues(raw({ coefficient: null, competencesParams: [] })).coefficient).toBe(1);
  });
  it("calcule l'état de la case évaluable", () => {
    const [r] = enrich([raw()], ctx);
    expect(evaluableState(r)).toBe("all");
    expect(evaluableState({ ...r, params: withEvaluable(r.params, false) })).toBe("none");
    expect(evaluableState({ ...r, params: [{ ...r.params[0], evaluable: false }, r.params[1]] })).toBe("various");
    expect(evaluableState({ ...r, params: [], evaluable: false })).toBe("none");
  });
  it("reconnaît un remplaçant en cours", () => {
    const m = { second_teacher_id: "t2", start_date: "2026-10-01T00:00:00", entered_end_date: "2026-10-31T00:00:00" };
    expect(isCurrentSubstitute(m, "2026-10-12")).toBe(true);
    expect(isCurrentSubstitute(m, "2026-10-31")).toBe(true);
    expect(isCurrentSubstitute(m, "2026-11-01")).toBe(false);
  });
  it("garde toujours au moins un enseignant visible", () => {
    const base = { is_visible: true, coTeachers: [{ second_teacher_id: "t2", is_visible: true }], substituteTeachers: [] };
    expect(mainEyeLocked(base, "2026-10-12")).toBe(false);
    expect(mainEyeLocked({ ...base, coTeachers: [{ second_teacher_id: "t2", is_visible: false }] }, "2026-10-12")).toBe(true);
    expect(mainEyeLocked({ ...base, is_visible: false }, "2026-10-12")).toBe(false);
    expect(multiEyeLocked(base, base.coTeachers[0], "2026-10-12")).toBe(false);
    expect(multiEyeLocked({ ...base, is_visible: false }, base.coTeachers[0], "2026-10-12")).toBe(true);
    expect(multiEyeLocked({ ...base, is_visible: false }, { second_teacher_id: "t2", is_visible: false }, "2026-10-12")).toBe(false);
  });
  it("trie et inverse", () => {
    const rows = enrich([raw({ id_enseignant: "t2" }), raw()], ctx);
    expect(sortRows(rows, "nom_enseignant", true).map((r) => r.nom_enseignant)).toEqual(["DUPONT Anne", "MARTIN Paul"]);
    expect(sortRows(rows, "nom_enseignant", false)[0].nom_enseignant).toBe("MARTIN Paul");
    expect(nextSortState({ key: "topicName", asc: true }, "topicName")).toEqual({ key: "topicName", asc: false });
    expect(nextSortState({ key: "topicName", asc: false }, "coefficient")).toEqual({ key: "coefficient", asc: true });
  });
  it("range les mots saisis en mots libres ou en classes", () => {
    const rows = enrich([raw()], ctx);
    expect(classifyWord("6b", rows, [], [])).toEqual({ kind: "class", value: "6B" });
    expect(classifyWord("dupont", rows, [], [])).toEqual({ kind: "word", value: "DUPONT" });
    expect(classifyWord("dupont", rows, ["DUPONT"], [])).toBeNull();
    expect(classifyWord("  ", rows, [], [])).toBeNull();
  });
  it("filtre par mots et restreint aux classes cherchées", () => {
    const rows = enrich([raw(), raw({ id_enseignant: "t2", id_groupe: "g3", id_groups: ["g3"], competencesParams: [{ id_groupe: "g3", modalite: "S", evaluable: true, coefficient: 1 }] })], ctx);
    expect(applyWords(rows, ["DUPONT"], [])).toHaveLength(1);
    expect(applyWords(rows, ["DUPONT", "MARTIN"], [])).toHaveLength(0);
    const narrowed = applyWords(rows, [], ["6B"]);
    expect(narrowed).toHaveLength(1);
    expect(narrowed[0]).toMatchObject({ groupsName: "6B", id_groups: ["g2"] });
    expect(narrowed[0].params.map((p) => p.id_groupe)).toEqual(["g2"]);
  });
  it("compose la requête de filtres", () => {
    expect(filtersQuery(DEFAULT_FILTERS)).toBe("classes=true&groups=true&manualGroups=true&evaluable=true&notEvaluable=false");
  });
  it("compose les corps d'enregistrement", () => {
    const [r] = enrich([raw()], ctx);
    expect(paramsPayload(r, r.params, { coefficient: 3 }).services.map((s) => [s.id_groupes, s.coefficient])).toEqual([[["g1"], 3], [["g2"], 3]]);
    expect(paramsPayload(r, r.params, { modalite: "O" }).services[0].modalite).toBe("O");
    expect(movedServicePayload(r, "m2")).toMatchObject({ id_matiere: "m2", evaluable: true, id_groupes: ["g1", "g2"] });
  });
  it("valide un coefficient", () => {
    expect(validCoefficient("2.5")).toBe(2.5);
    expect(validCoefficient("0")).toBe(0);
    expect(validCoefficient("")).toBeNull();
    expect(validCoefficient("-1")).toBeNull();
    expect(validCoefficient("abc")).toBeNull();
  });
  it("cherche les devoirs et décrit l'avertissement", () => {
    const [r] = enrich([raw()], ctx);
    expect(homeworkQuery(r)).toBe("idEtablissement=s1&id_matiere=m1&id_enseignant=t1&id_groups=g1,g2");
    expect(homeworkQuery(r, ["g2"])).toContain("id_groups=g2");
    expect(homeworkMessage("[nbDevoir] devoirs liés", 3)).toBe("3 devoirs liés");
  });
  it("repère les classes qui deviennent non évaluables", () => {
    const [r] = enrich([raw()], ctx);
    const after = [{ ...r.params[0], evaluable: false }, r.params[1]];
    expect(switchedOff(r.params, after).map((p) => p.id_groupe)).toEqual(["g1"]);
    expect(switchedOff(after, r.params)).toEqual([]);
  });
});
