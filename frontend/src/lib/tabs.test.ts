import { describe, expect, it } from "vitest";
import { defaultSchoolTab, visibleSchoolTabs, visibleSections } from "./tabs";

const apps = ["/competences", "/presences", "/diary", "/edt"].map((address) => ({ address }));
const services = { competences: true, presences: true, diary: true, edt: true };

describe("onglets principaux", () => {
  it("affiche École seule sans service ni application", () => {
    expect(visibleSections({})).toEqual(["ecole"]);
  });
  it("affiche chaque onglet dont le service est activé et l'application accessible", () => {
    expect(visibleSections({ apps, services })).toEqual(["ecole", "competences", "presences", "diary", "edt"]);
    expect(visibleSections({ apps: [{ address: "/diary" }], services })).toEqual(["ecole", "diary"]);
    expect(visibleSections({ apps, services: { diary: true } })).toEqual(["ecole", "diary"]);
  });
  it("masque Présences et Emploi du temps au directeur du 1er degré non super-admin", () => {
    const actions = [{ displayName: "presences.init.settings.1d" }, { displayName: "presences.init.popup" }];
    expect(visibleSections({ apps, services, actions })).toEqual(["ecole", "competences", "diary"]);
    expect(visibleSections({ apps, services, actions, superAdmin: true })).toContain("edt");
  });
});

describe("sous-onglets de l'école", () => {
  it("sans droit de gestion : périodes et regroupements seulement", () => {
    expect(visibleSchoolTabs({})).toEqual(["periodes", "regroupements"]);
  });
  it("selon les droits de gestion", () => {
    const actions = [{ displayName: "period.year.manage" }, { displayName: "time.slot.manage" }, { displayName: "viescolaire.paramServices" }, { displayName: "viescolaire.trombinoscope.manage" }];
    expect(visibleSchoolTabs({ actions })).toEqual(["annee", "periodes", "exclusions", "creneaux", "services", "regroupements", "trombinoscope"]);
  });
  it("ouvre sur les périodes", () => {
    expect(defaultSchoolTab(["annee", "periodes"])).toBe("periodes");
    expect(defaultSchoolTab(["regroupements"])).toBe("regroupements");
    expect(defaultSchoolTab([])).toBeUndefined();
  });
});
