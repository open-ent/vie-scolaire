import { describe, expect, it } from "vitest";
import { COMP_RIGHTS, currentCompSection, visibleCompSections } from "./competencesAccess";

describe("menu de l'onglet Compétences", () => {
  it("sans droit, seules les entrées libres sont proposées", () => {
    expect(visibleCompSections([]).map((s) => s.id)).toEqual(["levels", "subjects", "absences", "opinions", "program"]);
  });
  it("ajoute les entrées selon les droits, dans l'ordre d'origine", () => {
    const actions = [{ name: COMP_RIGHTS.setVisibilityAverageBfc }, { name: COMP_RIGHTS.paramCompetences }, { displayName: "viescolaire.paramServices" }];
    expect(visibleCompSections(actions).map((s) => s.id)).toEqual(["levels", "visibilityAverage", "visibilityDnb", "items", "services", "subjects", "absences", "opinions", "program", "order"]);
  });
  it("revient au premier écran si la section demandée n'est pas visible", () => {
    const v = visibleCompSections([]);
    expect(currentCompSection(v, "items")).toBe("levels");
    expect(currentCompSection(v, "opinions")).toBe("opinions");
  });
});
