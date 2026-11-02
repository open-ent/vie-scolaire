import { describe, expect, it } from "vitest";
import { foundLabel, groupByClass, reportTitle, studentsQuery, useEntAvatars, visibleReports } from "./trombinoscope";

describe("trombinoscope", () => {
  it("libelle un élève avec sa classe, ou une classe seule", () => {
    expect(foundLabel({ id: "1", displayName: "DUPONT Anne", idClasse: ["707249$6A"] })).toBe("DUPONT Anne - 6A");
    expect(foundLabel({ id: "2", name: "6A" })).toBe("6A");
    expect(foundLabel({ id: "3", displayName: "X", idClasse: ["a$1", "a$2"] })).toBe("X - 1,2");
  });
  it("groupe par classe, triées, élèves par nom", () => {
    const g = groupByClass([{ id: "1", displayName: "B", audienceName: "6B" }, { id: "2", displayName: "C", audienceName: "6A" }, { id: "3", displayName: "A", audienceName: "6A" }]);
    expect(g.map((x) => x.name)).toEqual(["6A", "6B"]);
    expect(g[0].students.map((s) => s.displayName)).toEqual(["A", "C"]);
  });
  it("compose la requête de la liste", () => {
    expect(studentsQuery(0, [], [])).toBe("?crossFilter=true&page=0");
    expect(studentsQuery(2, ["a", "b"], ["6A"])).toBe("?crossFilter=true&page=2&studentId=a%2Cb&groupName=6A");
  });
  it("titre un rapport avec la date et l'heure", () => {
    expect(reportTitle({ content: "", createdAt: "2026-10-12T14:30:00" })).toBe("Import du 12/10/2026 à 14:30");
    expect(reportTitle({ content: "", createdAt: "?" })).toBe("Import du");
  });
  it("limite à cinq rapports sauf demande contraire", () => {
    const r = Array.from({ length: 8 }, (_, i) => ({ content: String(i), createdAt: "2026-01-01T00:00:00" }));
    expect(visibleReports(r, false)).toHaveLength(5);
    expect(visibleReports(r, true)).toHaveLength(8);
  });
  it("lit la case des avatars comme le contraire du réglage serveur", () => {
    expect(useEntAvatars(false)).toBe(true);
    expect(useEntAvatars(true)).toBe(false);
  });
});
