import { describe, expect, it } from "vitest";
import { alreadyExists, createPayload, deletePath, enrich, filterServices, RawService, sortServices, typeFilterQuery } from "./services";

const matieres = [{ id: "m1", name: "Maths", externalId: "0098", source: "AAF", sous_matieres: [{ id_type_sousmatiere: 6 }] }, { id: "m2", name: "Anglais", externalId: "0100", source: "AAF" }];
const teachers = [{ id: "t1", displayName: "DUPONT Anne" }, { id: "t2", displayName: "MARTIN Paul" }];
const groups = [{ id: "g1", name: "6A" }, { id: "g2", name: "5B" }];
const subs = [{ id: 6, libelle: "Latin" }];
const raw = (over: Partial<RawService> = {}): RawService => ({ id_groupe: "g1", id_enseignant: "t1", id_matiere: "m1", ...over });

describe("services d'enseignement", () => {
  it("résout les noms, la matière portant son code et sa source", () => {
    const [s] = enrich([raw()], matieres, teachers, groups, subs);
    expect(s.topicName).toBe("Maths (0098 - AAF)");
    expect(s.teacherName).toBe("DUPONT Anne");
    expect(s.groupName).toBe("6A");
    expect(s.subTopics.map((x) => x.libelle)).toEqual(["Latin"]);
  });
  it("écarte un service dont la matière, l'enseignant ou la classe est inconnu", () => {
    expect(enrich([raw({ id_matiere: "x" }), raw({ id_enseignant: "x" }), raw({ id_groupe: "x" })], matieres, teachers, groups, subs)).toHaveLength(0);
  });
  it("regroupe les classes d'un service, triées, sans doublon", () => {
    const [s] = enrich([raw({ id_groups: ["g1", "g2", "g1"] })], matieres, teachers, groups, subs);
    expect(s.groupName).toBe("5B, 6A");
  });
  it("nomme les co-enseignants et garde les inconnus sans nom", () => {
    const [s] = enrich([raw({ coTeachers: [{ second_teacher_id: "t2" }, { second_teacher_id: "zz" }] })], matieres, teachers, groups, subs);
    expect(s.coTeachers.map((c) => c.displayName)).toEqual(["MARTIN Paul", ""]);
  });
  it("trie et filtre", () => {
    const list = enrich([raw(), raw({ id_matiere: "m2", id_enseignant: "t2", id_groupe: "g2" })], matieres, teachers, groups, subs);
    expect(sortServices(list, "topicName", true).map((s) => s.teacherName)).toEqual(["MARTIN Paul", "DUPONT Anne"]);
    expect(sortServices(list, "topicName", false).map((s) => s.teacherName)).toEqual(["DUPONT Anne", "MARTIN Paul"]);
    expect(filterServices(list, ["martin"], [])).toHaveLength(1);
    expect(filterServices(list, ["martin", "anglais"], [])).toHaveLength(1);
    expect(filterServices(list, ["martin", "maths"], [])).toHaveLength(0);
    expect(filterServices(list, [], ["6A"]).map((s) => s.teacherName)).toEqual(["DUPONT Anne"]);
  });
  it("compose la requête de filtre par type de groupe", () => {
    expect(typeFilterQuery({ classes: true, groups: false, manualGroups: true })).toBe("classes=true&groups=false&manualGroups=true");
  });
  it("détecte un service déjà existant", () => {
    expect(alreadyExists([raw()], "m1", "t1", ["g1"])).toBe(true);
    expect(alreadyExists([raw()], "m1", "t1", ["g2"])).toBe(false);
    expect(alreadyExists([raw({ id_groups: ["g2"] })], "m1", "t1", ["g2"])).toBe(true);
    expect(alreadyExists([raw()], "", "t1", ["g1"])).toBe(false);
  });
  it("construit les corps de création et de suppression", () => {
    expect(createPayload("s1", "t1", "m1", ["g1", "g2"], true)).toMatchObject({ id_etablissement: "s1", id_groupes: ["g1", "g2"], evaluable: true, modalite: "S", coefficient: 1 });
    expect(deletePath(raw({ id_groups: ["g1", "g2"] }))).toBe("/viescolaire/service?id_matiere=m1&id_groups=g1,g2&id_enseignant=t1");
    expect(deletePath(raw())).toBe("/viescolaire/service?id_matiere=m1&id_groups=g1&id_enseignant=t1");
  });
});
