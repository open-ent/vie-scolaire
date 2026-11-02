import { describe, expect, it } from "vitest";
import {
  absenceAlertBell,
  canCreate,
  catalogCreateBody,
  catalogToggleBody,
  catalogUpdateBody,
  draftOfReason,
  emptyCatalogForm,
  emptyReasonDraft,
  initButtons,
  isModuleActive,
  isValidLabel,
  latenessAlertBell,
  nextThreshold,
  parseThreshold,
  reasonCreateBody,
  reasonToggleBody,
  recoveryMethodOf,
  resetCatalogForm,
  resetReasonDraft,
  sortReasons,
  splitPunishments,
  visibilityState,
  visibleReasons,
  withDefaults,
  Reason,
} from "./presences";

const reason = (id: number, label: string, proving: boolean, compliance: boolean, rules: string[] = []): Reason => ({
  id,
  label,
  structure_id: "S1",
  proving,
  absence_compliance: compliance,
  hidden: false,
  reason_alert_rules: rules,
});

describe("initialisation et activation", () => {
  it("propose le bon bouton selon les droits", () => {
    expect(initButtons(true, true, true)).toEqual([]);
    expect(initButtons(false, true, false)).toEqual(["ONE_D"]);
    expect(initButtons(false, true, true)).toEqual(["TWO_D"]);
    expect(initButtons(false, false, true)).toEqual(["TWO_D"]);
    expect(initButtons(false, false, false)).toEqual([]);
  });
  it("lit l'activation du module dans la liste des structures actives", () => {
    expect(isModuleActive([{ id_etablissement: "S1" }], "S1")).toBe(true);
    expect(isModuleActive([{ id_etablissement: "S2" }], "S1")).toBe(false);
    expect(isModuleActive(null, "S1")).toBe(false);
  });
});

describe("motifs", () => {
  it("formulaire vierge : absence à régulariser, retard justifié", () => {
    expect(emptyReasonDraft("absence")).toMatchObject({ proving: false, absenceCompliance: true });
    expect(emptyReasonDraft("lateness")).toMatchObject({ proving: true, absenceCompliance: true });
  });
  it("après un ajout, vide le libellé mais garde les cases d'alerte", () => {
    const d = { ...emptyReasonDraft("absence"), label: "Maladie", proving: true, absenceCompliance: false, excludeAlertRegularised: true };
    expect(resetReasonDraft("absence", d)).toMatchObject({ label: "", proving: false, absenceCompliance: true, excludeAlertRegularised: true });
  });
  it("exige un libellé non vide", () => {
    expect(isValidLabel("Maladie")).toBe(true);
    expect(isValidLabel("  ")).toBe(false);
    expect(isValidLabel("")).toBe(false);
  });
  it("masque le motif -1", () => {
    expect(visibleReasons([reason(-1, "x", true, true), reason(2, "y", true, true)]).map((r) => r.id)).toEqual([2]);
  });
  it("trie justifiés d'abord, puis hors bulletin, puis libellé", () => {
    const list = [reason(1, "Zèbre", false, false), reason(2, "Bravo", true, true), reason(3, "alpha", true, true), reason(4, "Délai", true, false)];
    expect(sortReasons(list).map((r) => r.id)).toEqual([4, 3, 2, 1]);
  });
  it("formulaire d'édition : alertes selon le type de motif", () => {
    const r = reason(5, "Maladie", true, true, ["REGULARIZED", "LATENESS"]);
    expect(draftOfReason("absence", r)).toMatchObject({ id: 5, excludeAlertRegularised: true, excludeAlertNoRegularised: false, excludeAlertLateness: false });
    expect(draftOfReason("lateness", r)).toMatchObject({ excludeAlertRegularised: false, excludeAlertLateness: true });
  });
  it("corps de création et de basculement", () => {
    expect(reasonCreateBody("S1", { ...emptyReasonDraft("absence"), label: " Maladie " })).toEqual({
      label: "Maladie",
      absenceCompliance: true,
      proving: false,
      excludeAlertRegularised: false,
      excludeAlertNoRegularised: false,
      excludeAlertLateness: false,
      structureId: "S1",
    });
    const t = reasonToggleBody(reason(5, "M", true, false, ["UNREGULARIZED"]));
    expect(t).toMatchObject({ id: 5, hidden: true, excludeAlertNoRegularised: true, excludeAlertRegularised: false, structureId: "S1" });
  });
  it("cloche d'alerte des motifs d'absence et de retard", () => {
    expect(absenceAlertBell(reason(1, "a", true, true, []))?.color).toBe("#ffb600");
    expect(absenceAlertBell(reason(1, "a", true, true, ["UNREGULARIZED"]))?.color).toBe("#72bb53");
    expect(absenceAlertBell(reason(1, "a", true, true, ["REGULARIZED"]))?.color).toBe("#ff8a84");
    expect(absenceAlertBell(reason(1, "a", true, true, ["REGULARIZED", "UNREGULARIZED"]))).toBeNull();
    expect(latenessAlertBell(reason(1, "a", true, true, ["LATENESS"]))).toBeNull();
    expect(latenessAlertBell(reason(1, "a", true, true, []))?.color).toBe("#9c29b7");
  });
  it("état de visibilité : seuls les motifs utilisés se masquent", () => {
    expect(visibilityState({ used: false })).toBe("deletable");
    expect(visibilityState({ used: null, hidden: true })).toBe("deletable");
    expect(visibilityState({ used: true, hidden: false })).toBe("visible");
    expect(visibilityState({ used: true, hidden: true })).toBe("hidden");
  });
});

describe("paramètres", () => {
  it("complète par défaut", () => {
    expect(withDefaults({ alert_absence_threshold: 4 })).toMatchObject({ alert_absence_threshold: 4, alert_lateness_threshold: 0, exclude_alert_forgotten_notebook: false });
  });
  it("seuils : jamais sous 0", () => {
    expect(nextThreshold(0, false)).toBe(0);
    expect(nextThreshold(4, true)).toBe(5);
    expect(nextThreshold(4, false)).toBe(3);
    expect(parseThreshold("-3")).toBe(0);
    expect(parseThreshold("7")).toBe(7);
    expect(parseThreshold("")).toBeNull();
  });
  it("comptage des événements : par créneau par défaut", () => {
    expect(recoveryMethodOf({})).toBe("HOUR");
    expect(recoveryMethodOf({ event_recovery_method: null })).toBe("HOUR");
    expect(recoveryMethodOf({ event_recovery_method: "DAY" })).toBe("DAY");
  });
});

describe("catalogues", () => {
  const form = { ...emptyCatalogForm(), label: " Infirmerie " };
  it("corps de création selon le catalogue", () => {
    expect(catalogCreateBody("discipline", "S1", form)).toEqual({ label: "Infirmerie", structureId: "S1" });
    expect(catalogCreateBody("action", "S1", { ...form, abbreviation: "AP" })).toEqual({ label: "Infirmerie", abbreviation: "AP", structureId: "S1" });
    expect(catalogCreateBody("seriousness", "S1", { ...form, level: 3, excludeAlertSeriousness: true })).toEqual({ label: "Infirmerie", level: 3, excludeAlertSeriousness: true, structureId: "S1" });
    expect(catalogCreateBody("punishmentType", "S1", { ...form, type: "SANCTION", categoryId: 2 })).toEqual({ label: "Infirmerie", type: "SANCTION", punishment_category_id: 2, structure_id: "S1" });
  });
  it("création : modèle, type et libellé requis pour les punitions", () => {
    expect(canCreate("punishmentType", { ...form, type: "PUNISHMENT", categoryId: null })).toBe(false);
    expect(canCreate("punishmentType", { ...form, type: "PUNISHMENT", categoryId: 1 })).toBe(true);
    expect(canCreate("place", emptyCatalogForm())).toBe(false);
    expect(canCreate("place", form)).toBe(true);
  });
  it("modification et basculement", () => {
    const item = { id: 8, label: "Grave", level: 4, hidden: false, used: true, exclude_alert_seriousness: false };
    expect(catalogToggleBody("seriousness", item)).toEqual({ id: 8, label: "Grave", hidden: true, level: 4, excludeAlertSeriousness: false });
    expect(catalogUpdateBody("place", { id: 1, label: "A" }, { ...form, label: "Cour" }, false)).toEqual({ id: 1, label: "Cour", hidden: false });
    expect(catalogToggleBody("action", { id: 9, label: "Appel", abbreviation: "AP", hidden: true })).toEqual({ id: 9, label: "Appel", hidden: false, abbreviation: "AP" });
  });
  it("sépare punitions et sanctions", () => {
    const r = splitPunishments([
      { id: 9, label: "Avertissement", type: "SANCTION" },
      { id: 7, label: "Devoir", type: "PUNISHMENT" },
      { id: 8, label: "Retenue", type: "PUNISHMENT" },
    ]);
    expect(r.punishments.map((p) => p.id)).toEqual([7, 8]);
    expect(r.sanctions.map((p) => p.id)).toEqual([9]);
  });
  it("réinitialise le formulaire après ajout", () => {
    expect(resetCatalogForm("action", { ...emptyCatalogForm(), label: "a", abbreviation: "b" })).toMatchObject({ label: "", abbreviation: "" });
    expect(resetCatalogForm("punishmentType", { ...emptyCatalogForm(), label: "a", type: "SANCTION", categoryId: 2 })).toMatchObject({ label: "", type: "", categoryId: 2 });
    expect(resetCatalogForm("seriousness", { ...emptyCatalogForm(), label: "a", level: 5, excludeAlertSeriousness: true })).toMatchObject({ level: 0, excludeAlertSeriousness: true });
  });
});
