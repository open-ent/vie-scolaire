import { describe, expect, it } from "vitest";
import { CDT_SECTIONS } from "./cdt";
import { COMP_SECTIONS } from "./competencesAccess";
import { HINTS, hintOf } from "./hints";
import { SCHOOL_TAB_IDS } from "./tabs";

describe("explications des écrans", () => {
  it("chaque sous-onglet de l'établissement est expliqué", () => {
    for (const id of SCHOOL_TAB_IDS) expect(hintOf(`school.${id}`), id).toBeDefined();
  });
  it("chaque rubrique des compétences est expliquée", () => {
    for (const s of COMP_SECTIONS) expect(hintOf(`comp.${s.id}`), s.id).toBeDefined();
  });
  it("chaque rubrique du cahier de textes est expliquée", () => {
    for (const s of CDT_SECTIONS) expect(hintOf(`cdt.${s.id}`), s.id).toBeDefined();
  });
  it("la rubrique des plages horaires dit comment créer une grille, avec un lien vers l'écran de création", () => {
    const h = hintOf("school.creneaux");
    expect(h?.steps?.join(" ")).toMatch(/Profils de créneaux horaires/);
    expect(h?.steps?.join(" ")).toMatch(/Calendrier/);
    expect(h?.link?.href).toBe("/dashboard/viescolaire-admin/creneaux");
    // lien et étapes réservés à qui gère les plages horaires ; les autres lisent à qui s'adresser
    expect(h?.needs).toBe("time.slot.manage");
    expect(h?.otherwise).toMatch(/administrateur/);
  });
  it("les textes sont des phrases complètes, sans balise", () => {
    for (const [id, h] of Object.entries(HINTS)) {
      expect(h.text.length, id).toBeGreaterThan(30);
      expect(h.text, id).not.toMatch(/[<>]/);
      expect(/[.»)]$/.test(h.text), id).toBe(true);
    }
  });
});
