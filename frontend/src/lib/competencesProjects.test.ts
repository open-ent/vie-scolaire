import { describe, expect, it } from "vitest";
import {
  addEnsMat, belongsTo, deleteElementsQuery, distinctSubjects, draftOf, Draft, Element, elementPayload, emptyDraft, freeSubjects, isDraftIncomplete,
  labelExists, matchesSearch, mergeClasses, nextSort, sortElements, themeExists, themesOf,
} from "./competencesProjects";

const prof = (id: string) => ({ id, displayName: `Prof ${id}` });
const mat = (id: string) => ({ id, name: `Mat ${id}` });
const el = (id: number, libelle: string | null, theme?: string): Element => ({
  id, libelle, theme: theme ? { id: id * 10, libelle: theme } : null, groupes: [{ id: "g1", name: "6A" }], intervenantsMatieres: [{ intervenant: prof("p1"), matiere: mat("m1") }],
});

describe("EPI, AP et parcours", () => {
  it("range chaque élément dans son onglet", () => {
    const epi = el(1, "Mon EPI", "Sciences");
    const ap = el(2, "Mon AP");
    const parcours = el(3, null, "Avenir");
    expect([epi, ap, parcours].map((e) => [belongsTo("EPI", e), belongsTo("AP", e), belongsTo("parcours", e)])).toEqual([
      [true, false, false],
      [false, true, false],
      [false, false, true],
    ]);
  });
  it("cherche dans le libellé, le thème, les intervenants et les classes", () => {
    const e = el(1, "Mon EPI", "Sciences");
    expect(matchesSearch(e, "sci")).toBe(true);
    expect(matchesSearch(e, "prof p1")).toBe(true);
    expect(matchesSearch(e, "6a")).toBe(true);
    expect(matchesSearch(e, "zzz")).toBe(false);
    expect(matchesSearch(e, " ")).toBe(true);
  });
  it("trie et inverse", () => {
    const l = [el(1, "B"), el(2, "A"), el(3, "C")];
    expect(sortElements(l, "libelle", false).map((e) => e.id)).toEqual([2, 1, 3]);
    expect(sortElements(l, "libelle", true).map((e) => e.id)).toEqual([3, 1, 2]);
    expect(nextSort({ prop: "theme.libelle", reverse: true }, "theme.libelle")).toEqual({ prop: "theme.libelle", reverse: false });
    expect(nextSort({ prop: "theme.libelle", reverse: true }, "libelle")).toEqual({ prop: "libelle", reverse: false });
  });
  it("compte les matières distinctes", () => {
    const a = { intervenant: prof("1"), matiere: mat("m1") };
    const b = { intervenant: prof("2"), matiere: mat("m2") };
    const c = { intervenant: prof("3"), matiere: mat("m1") };
    expect(distinctSubjects([a, b])).toEqual({ ids: ["m1", "m2"], size: 2, hasTwoTimes: false });
    expect(distinctSubjects([a, c]).hasTwoTimes).toBe(true);
  });
  it("applique les règles d'un EPI", () => {
    const d: Draft = { ...emptyDraft("s1"), theme: { id: 1, libelle: "T" }, libelle: "EPI", classes: [{ id: "g1", name: "6A" }], ens_mat: [{ intervenant: prof("1"), matiere: mat("m1") }, { intervenant: prof("2"), matiere: mat("m2") }] };
    expect(isDraftIncomplete("EPI", d, [])).toBe(false);
    expect(isDraftIncomplete("EPI", { ...d, ens_mat: d.ens_mat.slice(0, 1) }, [])).toBe(true);
    expect(isDraftIncomplete("EPI", { ...d, ens_mat: [d.ens_mat[0], { intervenant: prof("3"), matiere: mat("m1") }] }, [])).toBe(true);
    expect(isDraftIncomplete("EPI", { ...d, theme: undefined }, [])).toBe(true);
    expect(isDraftIncomplete("EPI", { ...d, classes: [] }, [])).toBe(true);
    expect(isDraftIncomplete("EPI", { ...d, classes: [] }, [{ id: "g2", name: "6B" }])).toBe(false);
  });
  it("applique les règles d'un AP et d'un parcours", () => {
    const d: Draft = { ...emptyDraft("s1"), libelle: "AP", classes: [{ id: "g1", name: "6A" }], ens_mat: [{ intervenant: prof("1"), matiere: mat("m1") }] };
    expect(isDraftIncomplete("AP", d, [])).toBe(false);
    expect(isDraftIncomplete("AP", { ...d, ens_mat: [] }, [])).toBe(true);
    expect(isDraftIncomplete("parcours", { ...d, theme: { id: 1, libelle: "Avenir" } }, [])).toBe(false);
    expect(isDraftIncomplete("parcours", d, [])).toBe(true);
  });
  it("détecte un libellé déjà pris, sauf par l'élément modifié", () => {
    const l = [el(1, "Mon EPI", "Sciences"), el(2, "Mon AP")];
    expect(labelExists(l, { libelle: "Mon EPI", theme: { id: 1, libelle: "Sciences" } })).toBe(true);
    expect(labelExists(l, { libelle: "Mon EPI", theme: { id: 2, libelle: "Arts" } })).toBe(false);
    expect(labelExists(l, { libelle: "Mon EPI", theme: { id: 1, libelle: "Sciences" } }, 1)).toBe(false);
    expect(labelExists(l, { libelle: "Mon AP" })).toBe(true);
    expect(labelExists(l, { libelle: "Autre" })).toBe(false);
  });
  it("ajoute un intervenant sans doublon et propose les matières libres", () => {
    const l = addEnsMat([], prof("1"), mat("m1"));
    expect(addEnsMat(l, prof("1"), mat("m1"))).toHaveLength(1);
    expect(addEnsMat(l, prof("2"), mat("m2"))).toHaveLength(2);
    expect(freeSubjects([mat("m1"), mat("m2")], l).map((m) => m.id)).toEqual(["m2"]);
  });
  it("fusionne les classes en modification", () => {
    expect(mergeClasses([{ id: "a", name: "A" }], [{ id: "a", name: "A" }, { id: "b", name: "B" }]).map((c) => c.id)).toEqual(["a", "b"]);
  });
  it("compose les corps de création et de modification", () => {
    const d: Draft = { ...emptyDraft("s1"), theme: { id: 7, libelle: "T" }, libelle: "EPI", description: "", ens_mat: [] };
    const created = elementPayload("EPI", d, [{ id: "g1", name: "6A" }], false);
    expect(created).toMatchObject({ idEtablissement: "s1", type: 1, id_theme: 7, classes: [{ id: "g1", name: "6A" }], description: "" });
    const edited = elementPayload("EPI", { ...d, id: 4, classes: [{ id: "g0", name: "5A" }] }, [{ id: "g1", name: "6A" }], true);
    expect(edited).toMatchObject({ id: 4, classes: [{ id: "g0", name: "5A" }, { id: "g1", name: "6A" }] });
    expect("description" in edited).toBe(false);
    expect(elementPayload("AP", emptyDraft("s1"), [], false)).not.toHaveProperty("theme");
  });
  it("reprend un élément existant pour le modifier", () => {
    expect(draftOf(el(1, "Mon EPI", "Sciences"), "s1")).toMatchObject({ id: 1, libelle: "Mon EPI", description: "", theme: { libelle: "Sciences" } });
  });
  it("compose la suppression groupée", () => {
    expect(deleteElementsQuery("s1", [1, 2])).toBe("idEtablissement=s1&idElement=1&idElement=2");
  });
  it("sépare thèmes standard et personnalisés", () => {
    const t = [{ id: 1, libelle: "B" }, { id: 2, libelle: "A", personnalise: true }, { id: 3, libelle: "C", personnalise: false }];
    expect(themesOf(t, false).map((x) => x.id)).toEqual([1, 3]);
    expect(themesOf(t, true).map((x) => x.id)).toEqual([2]);
    expect(themeExists(t, "A")).toBe(true);
    expect(themeExists(t, "A", 2)).toBe(false);
  });
});
