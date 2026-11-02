import { describe, expect, it } from "vitest";
import { buildDrafts, byClass, checkDrafts, classesDiffer, currentPeriod, Draft, filterClasses, hasError, periodFamilies, periodName, periodsPayload, Periode, sortDrafts } from "./periods";

const p = (id_classe: string, dt: string, fn: string, over: Partial<Periode> = {}): Periode => ({ id_classe, timestamp_dt: dt, timestamp_fn: fn, date_fin_saisie: fn, ...over });
const d = (dt: string, fn: string, fs = fn): Draft => ({ timestamp_dt: dt, timestamp_fn: fn, date_fin_saisie: fs, date_conseil_classe: fn, publication_bulletin: false });

describe("périodes par classe", () => {
  it("regroupe par classe, triées par début", () => {
    const m = byClass([p("a", "2026-01-01", "2026-03-31"), p("a", "2025-09-01", "2025-12-31"), p("b", "2025-09-01", "2026-06-30")]);
    expect(m.get("a")?.map((x) => x.timestamp_dt)).toEqual(["2025-09-01", "2026-01-01"]);
    expect(m.get("b")).toHaveLength(1);
  });
  it("choisit la période qui contient aujourd'hui, sinon la plus proche", () => {
    const ps = [p("a", "2025-09-01", "2025-11-30"), p("a", "2025-12-02", "2026-03-31")];
    expect(currentPeriod(ps, new Date("2025-10-10T10:00:00Z"))?.timestamp_dt).toBe("2025-09-01");
    expect(currentPeriod(ps, new Date("2025-12-01T10:00:00Z"))?.timestamp_dt).toBe("2025-09-01");
    expect(currentPeriod(ps, new Date("2026-02-01T10:00:00Z"))?.timestamp_dt).toBe("2025-12-02");
    expect(currentPeriod([], new Date())).toBeUndefined();
  });
  it("nomme la période par son type et liste les familles", () => {
    const types = [{ id: 5, type: 3, ordre: 2 }, { id: 1, type: 1, ordre: 1 }, { id: 4, type: 3, ordre: 1 }];
    expect(periodName({ ...p("a", "x", "y"), id_type: 5 }, types)).toEqual({ type: 3, ordre: 2 });
    expect(periodName(undefined, types)).toBeUndefined();
    expect(periodFamilies(types)).toEqual([1, 3]);
  });
  it("filtre les classes par nombre de périodes et par début de nom", () => {
    const classes = [{ id: "a", name: "6A" }, { id: "b", name: "5B" }, { id: "c", name: "6C" }];
    const periods = byClass([p("a", "2025-09-01", "2026-06-30"), p("b", "2025-09-01", "2025-12-31"), p("b", "2026-01-01", "2026-06-30")]);
    expect(filterClasses(classes, periods, 2, "").map((c) => c.name)).toEqual(["5B"]);
    expect(filterClasses(classes, periods, 0, "").map((c) => c.name)).toEqual(["6C"]);
    expect(filterClasses(classes, periods, null, "6").map((c) => c.name)).toEqual(["6A", "6C"]);
    expect(filterClasses(classes, periods, null, "*")).toHaveLength(3);
  });
});

describe("contrôle des périodes saisies", () => {
  it("accepte des périodes valides et contiguës", () => {
    const e = checkDrafts([d("2025-09-01", "2025-12-31", "2026-01-05"), d("2026-01-01", "2026-03-31", "2026-04-05")]);
    expect(hasError(e)).toBe(false);
  });
  it("refuse une fin qui n'est pas après le début", () => {
    expect(checkDrafts([d("2025-09-01", "2025-09-01")]).fn).toBe(true);
    expect(checkDrafts([d("2025-09-01", "2025-08-01")]).fn).toBe(true);
  });
  it("refuse une fin de saisie qui n'est pas après le début", () => {
    expect(checkDrafts([d("2025-09-01", "2025-12-31", "2025-09-01")]).fnS).toBe(true);
  });
  it("détecte le chevauchement et le trou entre deux périodes", () => {
    expect(checkDrafts([d("2025-09-01", "2025-12-31"), d("2025-12-15", "2026-03-31")]).over).toBe(true);
    expect(checkDrafts([d("2025-09-01", "2025-11-30"), d("2025-12-15", "2026-03-31")]).contig).toBe(true);
    expect(checkDrafts([d("2025-09-01", "2025-11-30"), d("2025-12-01", "2026-03-31")]).contig).toBe(false);
  });
  it("trie les brouillons par début", () => {
    expect(sortDrafts([d("2026-01-01", "2026-03-01"), d("2025-09-01", "2025-12-31")]).map((x) => x.timestamp_dt)).toEqual(["2025-09-01", "2026-01-01"]);
  });
  it("construit des brouillons vierges", () => {
    expect(buildDrafts(3, "2026-11-02")).toHaveLength(3);
    expect(buildDrafts(1, "2026-11-02")[0].publication_bulletin).toBe(false);
  });
  it("avertit quand les classes choisies n'ont pas les mêmes dates", () => {
    const classes = [{ id: "a", name: "6A" }];
    const same = byClass([p("a", "2025-09-01", "2025-12-31")]);
    expect(classesDiffer(classes, same, [d("2025-09-01", "2025-12-31")])).toBe(false);
    expect(classesDiffer(classes, same, [d("2025-09-02", "2025-12-31")])).toBe(true);
    expect(classesDiffer(classes, new Map(), [d("2025-09-01", "2025-12-31")])).toBe(true);
  });
  it("construit le corps de la sauvegarde", () => {
    expect(periodsPayload("s1", ["a", "b"], [d("2025-09-01", "2025-12-31")])).toEqual({
      idEtablissement: "s1",
      idClasses: ["a", "b"],
      periodes: [{ timestamp_dt: "2025-09-01", timestamp_fn: "2025-12-31", date_fin_saisie: "2025-12-31", date_conseil_classe: "2025-12-31", publication_bulletin: false }],
    });
  });
});
