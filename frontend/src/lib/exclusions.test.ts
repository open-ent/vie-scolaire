import { describe, expect, it } from "vitest";
import { draftOf, exclusionPayload, frDate, isValidExclusion, sortExclusions } from "./exclusions";

const ex = (id: number, description: string, s: string, e: string) => ({ id, description, start_date: `${s} 00:00:00`, end_date: `${e} 23:59:59` });

describe("exclusions de périodes", () => {
  it("valide description, dates et ordre", () => {
    expect(isValidExclusion({ description: "Vacances", start: "2027-04-17", end: "2027-05-02" })).toBe(true);
    expect(isValidExclusion({ description: "Un jour", start: "2027-04-17", end: "2027-04-17" })).toBe(true);
    expect(isValidExclusion({ description: "  ", start: "2027-04-17", end: "2027-05-02" })).toBe(false);
    expect(isValidExclusion({ description: "X", start: "2027-05-02", end: "2027-04-17" })).toBe(false);
    expect(isValidExclusion({ description: "X", start: "", end: "2027-04-17" })).toBe(false);
  });
  it("trie par colonne, dans les deux sens", () => {
    const list = [ex(1, "Printemps", "2027-04-17", "2027-05-02"), ex(2, "Automne", "2026-10-17", "2026-11-02")];
    expect(sortExclusions(list, "start_date", false).map((e) => e.id)).toEqual([2, 1]);
    expect(sortExclusions(list, "start_date", true).map((e) => e.id)).toEqual([1, 2]);
    expect(sortExclusions(list, "description", false).map((e) => e.description)).toEqual(["Automne", "Printemps"]);
  });
  it("formate la date et prépare le brouillon", () => {
    expect(frDate("2027-04-17 00:00:00")).toBe("17/04/2027");
    expect(frDate("")).toBe("");
    expect(draftOf(ex(3, "A", "2027-04-17", "2027-05-02"))).toEqual({ id: 3, description: "A", start: "2027-04-17", end: "2027-05-02" });
  });
  it("construit le corps pour journées entières", () => {
    expect(exclusionPayload("s1", { description: " Vacances ", start: "2027-04-17", end: "2027-05-02" })).toEqual({
      description: "Vacances",
      start_date: "2027-04-17 00:00:00",
      end_date: "2027-05-02 23:59:59",
      id_structure: "s1",
    });
  });
});
