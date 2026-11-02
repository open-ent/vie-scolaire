import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StructureContext } from "../StructureContext";

const { lv, ens, dom } = vi.hoisted(() => { const lv = (id_niveau: number, id_cycle: number, ordre: number) => ({ id: null, id_niveau, id_cycle, cycle: "Cycle 3", ordre, default: "red", default_lib: `Niv ${ordre}`, libelle: null, lettre: null, couleur: null });
  const ens = [{ id: 10, nom: "Français", competences_1: [{ id: 1, nom: "Lire", id_cycle: 1, id_enseignement: 10, ids_domaine_int: [3], competences_2: [{ id: 2, nom: "Lire un texte", id_cycle: 1, id_enseignement: 10, ismanuelle: true }] }] }];
  const dom = [{ id: 3, niveau: 1, libelle: "Langages", codification: "D1", id_cycle: 1, competences: [{ id: 2, nom: "Lire un texte", id_cycle: 1, id_enseignement: 10 }] }];
  return { lv, ens, dom }; });
vi.mock("../../services/competences.service", () => {
  const ok = <T,>(v: T) => vi.fn(async () => v);
  return {
    activationService: { actives: ok([{ id_etablissement: "s1" }]), activate: ok(null), deactivate: ok(null) },
    levelService: { list: ok([lv(1, 1, 1), lv(2, 1, 2)]), create: ok(5), update: ok(null), reset: ok(null), isSkillAverage: ok(true), setSkillAverage: ok(null) },
    visibilityService: { get: ok(1), set: ok(null) },
    itemService: { domaines: ok(dom), enseignements: ok(ens), create: ok(null), update: ok({}), remove: ok({}), resetAll: ok(null) },
    cycleLinkService: { groupes: ok([{ id: "g1", name: "6A", type_groupe: 0, id_cycle: 1 }]), check: ok([]), save: ok(null) },
    projectService: { elements: ok([]), themes: ok([{ id: 1, libelle: "Sciences" }]), teachers: ok([{ id: "t1", displayName: "DUPONT" }]), matieres: ok([{ id: "m1", name: "Maths" }]), classes: ok([{ id: "g1", name: "6A" }]), appreciations: ok([]), create: ok(null), update: ok(null), remove: ok(null), createTheme: ok(null), updateTheme: ok(null), removeTheme: ok(null), elementsOfTheme: ok([]) },
    competenceServiceService: {
      list: ok([{ id_groupe: "g1", id_groups: ["g1"], id_enseignant: "t1", id_matiere: "m1", modalite: "S", evaluable: true, coefficient: 1, is_visible: true, coTeachers: [], substituteTeachers: [], competencesParams: [{ id_groupe: "g1", modalite: "S", evaluable: true, coefficient: 1 }] }]),
      classes: ok([{ id: "g1", name: "6A" }]), matieres: ok([{ id: "m1", name: "Maths", externalId: "1", source: "AAF" }]), teachers: ok([{ id: "t1", displayName: "DUPONT" }]), modalites: ok([{ id: "S", libelle: "Tronc" }]),
      subTopicTypes: ok([]), subTopicStored: ok([]), saveSubTopic: ok(null), update: ok(null), updateMany: ok(null), create: ok(null), updateMultiVisibility: ok(null), homework: ok([]), moveHomework: ok(null), deleteHomework: ok(null),
    },
    opinionService: { list: ok([{ id: 1, libelle: "Félicitations", type_avis: 1, id_etablissement: null, active: true }, { id: 2, libelle: "Passage", type_avis: 2, id_etablissement: "s1", active: true }]), create: ok(null), update: ok(null), remove: ok(null) },
    programService: { domaines: ok([{ id: 1, libelle: "Français" }]), sousDomaines: ok([{ id: 1, libelle: "Lire" }]), propositions: ok([{ id: 1, libelle: "Roman", id_etablissement: "s1" }]), create: ok(null), update: ok(null), remove: ok(null) },
    subjectModelService: { list: ok([{ title: "Modèle par défaut", subjects: [{ name: "Maths", libelle: "Maths" }] }]), save: ok(null), remove: ok(null) },
    subjectRankService: { list: ok([{ id: "a", name: "Maths", rank: 0, externalId: "1", source: "AAF" }, { id: "b", name: "Latin", rank: 1, externalId: "2", source: "AAF" }]), reshuffle: ok({ ids: [] }), reset: ok({ ids: [] }) },
    absenceImportService: { periodTypes: ok([{ id: 1, type: 2, ordre: 1 }]), state: ok({ installed: true, activate: true, presences_sync: false }), setSync: ok(null), upload: ok({ isValid: true, nbInsert: 3, nbLines: 6 }) },
  };
});
vi.mock("@open-ent/react", () => {
  const Modal: any = ({ isOpen, children }: any) => (isOpen ? <div role="dialog">{children}</div> : null);
  Modal.Header = ({ children }: any) => <div>{children}</div>;
  Modal.Body = ({ children }: any) => <div>{children}</div>;
  Modal.Footer = ({ children }: any) => <div>{children}</div>;
  return { Modal, Button: ({ children, color, variant, ...p }: any) => <button {...p}>{children}</button> };
});
vi.mock("../../services/queries", () => ({ useMe: () => ({ data: { actions: [{ name: "fr.openent.competences.controllers.BFCController|setVisibility" }, { name: "fr.openent.competences.controllers.CompetenceController|createCompetence" }, { name: "fr.openent.competences.controllers.UtilsController|updateLinkGroupesCycles" }, { name: "fr.openent.competences.controllers.ElementBilanPeriodiqueController|createElementBilanPeriodique" }, { displayName: "viescolaire.paramServices" }] } }) }));

import { CompetencesSettings } from "../../pages/CompetencesSettings";
import { activationService, levelService } from "../../services/competences.service";

const mount = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <StructureContext.Provider value={{ id: "s1", name: "Collège" }}>
        <CompetencesSettings />
      </StructureContext.Provider>
    </QueryClientProvider>,
  );

describe("fumée : onglet Compétences", () => {
  it("affiche chaque rubrique sans erreur", async () => {
    const { container } = mount();
    await waitFor(() => expect(container.querySelector("[data-vsco-comp-panel]")).toBeTruthy());
    await waitFor(() => expect(container.querySelector("[data-vsco-comp-levels-table]")).toBeTruthy());
    const ids = ["visibilityAverage", "visibilityDnb", "items", "links", "projects", "services", "subjects", "absences", "opinions", "program", "order", "levels"];
    const marks: Record<string, string> = { visibilityAverage: "[data-vsco-comp-visibility]", visibilityDnb: "[data-vsco-comp-visibility]", items: "[data-vsco-comp-enseignement]", links: "[data-vsco-comp-link-row]", projects: "[data-vsco-comp-project-table]", services: "[data-vsco-comp-service-row]", subjects: "[data-vsco-comp-model]", absences: "[data-vsco-comp-import-form]", opinions: "[data-vsco-comp-opinion]", program: "[data-vsco-comp-program-cycle]", order: "[data-vsco-comp-order-row]", levels: "[data-vsco-comp-levels-table]" };
    for (const id of ids) {
      fireEvent.click(container.querySelector(`[data-vsco-comp-section-link="${id}"]`)!);
      await waitFor(() => expect(container.querySelector(marks[id]), id).toBeTruthy());
    }
  });
  it("ouvre les fenêtres de création", async () => {
    const { container } = mount();
    await waitFor(() => expect(container.querySelector("[data-vsco-comp-panel]")).toBeTruthy());
    fireEvent.click(container.querySelector('[data-vsco-comp-section-link="projects"]')!);
    await waitFor(() => expect(container.querySelector("[data-vsco-comp-project-add]")).toBeTruthy());
    fireEvent.click(container.querySelector("[data-vsco-comp-project-add]")!);
    await waitFor(() => expect(document.querySelector("[data-vsco-comp-project-form]")).toBeTruthy());
    fireEvent.click(container.querySelector('[data-vsco-comp-section-link="items"]')!);
    await waitFor(() => expect(screen.getAllByText("Français").length).toBeGreaterThan(0));
    fireEvent.click(screen.getAllByText("Français")[0]);
    fireEvent.click(await screen.findByText("Lire"));
    expect(await screen.findByText("Lire un texte")).toBeTruthy();
  });
  it("enregistre un niveau modifié (création tant qu'il n'est pas personnalisé)", async () => {
    const { container } = mount();
    await waitFor(() => expect(container.querySelector("[data-vsco-comp-level-lettre]")).toBeTruthy());
    const input = container.querySelector('[data-vsco-comp-level-lettre="2"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: "A" } });
    fireEvent.blur(input);
    await waitFor(() => expect(levelService.create).toHaveBeenCalled());
    expect((levelService.create as any).mock.calls[0][1]).toMatchObject({ lettre: "A", id_niveau: 2, id_etablissement: "s1" });
  });
  it("n'enregistre pas une lettre de plus de 2 caractères", async () => {
    const { container } = mount();
    await waitFor(() => expect(container.querySelector("[data-vsco-comp-level-lettre]")).toBeTruthy());
    const input = container.querySelector('[data-vsco-comp-level-lettre="1"]') as HTMLInputElement;
    (levelService.create as any).mockClear();
    fireEvent.change(input, { target: { value: "ABC" } });
    fireEvent.blur(input);
    expect(container.querySelector("[data-vsco-comp-level-warning]")).toBeTruthy();
    expect(levelService.create).not.toHaveBeenCalled();
  });
  it("masque les rubriques quand le module est désactivé", async () => {
    const { container } = mount();
    await waitFor(() => expect(container.querySelector("[data-vsco-comp-panel]")).toBeTruthy());
    fireEvent.click(container.querySelector("[data-vsco-comp-active]")!);
    await waitFor(() => expect(container.querySelector("[data-vsco-comp-panel]")).toBeNull());
    expect(activationService.deactivate).toHaveBeenCalledWith("notes", "s1");
  });
});
