import { describe, expect, it } from "vitest";
import { canSubmit, createBody, emptyTemplate, limitSms, SMS_MAX_LENGTH, sortTemplates, stripHtml } from "./massmailing";

describe("modèles de publipostage", () => {
  it("n'autorise l'ajout que si le nom ou le contenu est renseigné", () => {
    expect(canSubmit(emptyTemplate("MAIL"))).toBe(false);
    expect(canSubmit({ ...emptyTemplate("MAIL"), name: "Modèle 1" })).toBe(true);
    expect(canSubmit({ ...emptyTemplate("SMS"), content: "Bonjour" })).toBe(true);
    expect(canSubmit({ ...emptyTemplate("PDF"), content: "   " })).toBe(false);
  });
  it("réduit un contenu HTML à son texte", () => {
    expect(stripHtml("<p>Bonjour&nbsp;<b>Anne</b></p>")).toBe("Bonjour Anne");
  });
  it("limite un SMS à 160 caractères", () => {
    expect(limitSms("a".repeat(200))).toHaveLength(SMS_MAX_LENGTH);
    expect(limitSms("court")).toBe("court");
  });
  it("trie par nom et construit le corps de création", () => {
    expect(sortTemplates([{ ...emptyTemplate("MAIL"), name: "B" }, { ...emptyTemplate("MAIL"), name: "A" }]).map((t) => t.name)).toEqual(["A", "B"]);
    expect(createBody({ ...emptyTemplate("SMS"), name: "x" }, "s1")).toMatchObject({ structure_id: "s1", type: "SMS", name: "x", category: "ALL" });
  });
});
