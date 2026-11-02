import { describe, expect, it } from "vitest";
import { isValidSchoolYear, schoolYearPayload, toInputDate } from "./schoolYear";

const NOW = new Date("2026-11-02T10:00:00");

describe("année scolaire", () => {
  it("garde la partie date d'une valeur horodatée", () => {
    expect(toInputDate("2026-09-01 00:00:00")).toBe("2026-09-01");
    expect(toInputDate("2026-09-01T00:00:00.000Z")).toBe("2026-09-01");
    expect(toInputDate(undefined)).toBe("");
  });
  it("refuse une fin avant le début, une année passée ou un champ vide", () => {
    expect(isValidSchoolYear("2026-09-01", "2027-07-05", NOW)).toBe(true);
    expect(isValidSchoolYear("2027-07-05", "2026-09-01", NOW)).toBe(false);
    expect(isValidSchoolYear("2025-09-01", "2026-07-05", NOW)).toBe(false);
    expect(isValidSchoolYear("", "2027-07-05", NOW)).toBe(false);
  });
  it("accepte une fin le jour même (jusqu'à 23 h 59)", () => {
    expect(isValidSchoolYear("2026-11-02", "2026-11-02", NOW)).toBe(true);
  });
  it("construit le corps attendu par le serveur", () => {
    expect(schoolYearPayload("s1", "2026-09-01", "2027-07-05", 3)).toEqual({
      id: 3,
      description: "",
      start_date: "2026-09-01 00:00:00",
      end_date: "2027-07-05 23:59:59",
      id_structure: "s1",
    });
  });
});
