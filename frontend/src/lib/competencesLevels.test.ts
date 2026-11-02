import { describe, expect, it } from "vitest";
import { buildCycles, isValidLettre, isValidLibelle, niveauPayload, normalizeNiveau, Niveau, pickCycle, readableText, sameNiveau, toColorInput } from "./competencesLevels";

const n = (id_niveau: number, id_cycle: number, ordre: number, over: Partial<Niveau> = {}): Niveau => ({
  id: null,
  id_niveau,
  id_cycle,
  cycle: id_cycle === 1 ? "Cycle 3" : "Cycle 4",
  ordre,
  default: "red",
  default_lib: `Défaut ${ordre}`,
  libelle: null,
  lettre: null,
  couleur: null,
  ...over,
});

describe("niveaux de maîtrise", () => {
  it("complète les valeurs par défaut", () => {
    const x = normalizeNiveau(n(1, 1, 1), "s1");
    expect(x).toMatchObject({ couleur: "#e13a3a", lettre: " ", libelle: "Défaut 1", id_etablissement: "s1" });
    expect(normalizeNiveau(n(1, 1, 1, { couleur: "#000000", lettre: "A", libelle: "Acquis" }), "s1")).toMatchObject({ couleur: "#000000", lettre: "A", libelle: "Acquis" });
  });
  it("groupe par cycle et classe les niveaux du plus haut au plus bas", () => {
    const cycles = buildCycles([n(5, 2, 1), n(1, 1, 1), n(2, 1, 2), n(3, 1, 3), n(4, 1, 4)], "s1");
    expect(cycles.map((c) => c.id_cycle)).toEqual([1, 2]);
    expect(cycles[0].libelle).toBe("Cycle 3");
    expect(cycles[0].niveaux.map((x) => x.ordre)).toEqual([4, 3, 2, 1]);
    expect(buildCycles([], "s1")).toEqual([]);
  });
  it("valide les longueurs", () => {
    expect(isValidLettre("AB")).toBe(true);
    expect(isValidLettre("ABC")).toBe(false);
    expect(isValidLibelle("x".repeat(36))).toBe(true);
    expect(isValidLibelle("x".repeat(37))).toBe(false);
  });
  it("omet l'identifiant à la création", () => {
    expect(niveauPayload({ ...n(1, 1, 1), id: null, libelle: "A", lettre: "A", couleur: "#fff000", id_etablissement: "s1" })).toEqual({ lettre: "A", couleur: "#fff000", libelle: "A", id_niveau: 1, id_etablissement: "s1" });
    expect(niveauPayload({ ...n(1, 1, 1), id: 7, libelle: "A", lettre: "A", couleur: "#fff000", id_etablissement: "s1" })).toMatchObject({ id: 7 });
  });
  it("détecte l'absence de changement", () => {
    expect(sameNiveau(n(1, 1, 1, { libelle: "A", lettre: "a", couleur: "#fff" }), n(1, 1, 1, { libelle: "A", lettre: "a", couleur: "#fff" }))).toBe(true);
    expect(sameNiveau(n(1, 1, 1, { libelle: "A" }), n(1, 1, 1, { libelle: "B" }))).toBe(false);
  });
  it("prépare la couleur et le texte lisible", () => {
    expect(toColorInput("#97BBCD")).toBe("#97bbcd");
    expect(toColorInput("rouge")).toBe("#000000");
    expect(toColorInput(null)).toBe("#000000");
    expect(readableText("#ecbe30")).toBe("#000000");
    expect(readableText("#e13a3a")).toBe("#ffffff");
  });
  it("garde le cycle choisi, sinon le premier", () => {
    const cycles = buildCycles([n(1, 1, 1), n(5, 2, 1)], "s1");
    expect(pickCycle(cycles, 2)).toBe(2);
    expect(pickCycle(cycles, 9)).toBe(1);
    expect(pickCycle([], 1)).toBeNull();
  });
});
