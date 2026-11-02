import { Button, Modal } from "@open-ent/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  addEnsMat, belongsTo, deleteElementsQuery, distinctSubjects, Draft, draftOf, Element, elementPayload, emptyDraft, freeSubjects, GroupeRef, isDraftIncomplete, KIND_TYPE, labelExists,
  matchesSearch, MAX_DESCRIPTION, MAX_LIBELLE, nextSort, ProjectKind, SortProp, sortElements, themeExists, themesOf,
} from "../../lib/competencesProjects";
import { projectService } from "../../services/competences.service";
import { SectionProps, Tr, useCompT } from "./shared";

const KINDS: ProjectKind[] = ["EPI", "AP", "parcours"];
const TAB_LABEL: Record<ProjectKind, [string, string]> = {
  EPI: ["evaluations.enseignements.pratiques.interdisciplinaires", "EPI"],
  AP: ["evaluations.accompagnement.personnalise", "AP"],
  parcours: ["evaluations.parcours.educatifs", "Parcours"],
};
const ADD_LABEL: Record<ProjectKind, [string, string]> = { EPI: ["evaluations.add.EPI", "Créer EPI"], AP: ["evaluations.add.AP", "Créer AP"], parcours: ["evaluations.add.parcours", "Créer Parcours"] };
const SEARCH_LABEL: Record<ProjectKind, string> = { EPI: "Rechercher un EPI", AP: "Rechercher un AP", parcours: "Rechercher un parcours" };

type ConfirmKind = "supprElem" | "supprElemAppr" | "supprEnseignant" | "supprClasse" | "modifElemSupprClasse" | "themeInUse" | "themeDup" | "labelDup";
interface Confirm {
  kind: ConfirmKind;
  /** Pour la suppression d'un intervenant ou d'une classe : ce qu'il faut retirer. */
  index?: number;
}

interface Form {
  draft: Draft;
  editing: boolean;
  /** Classes ajoutées dans la fenêtre (en modification, en plus de celles déjà liées). */
  added: GroupeRef[];
  themeOpen: boolean;
  /** Thème en cours de création ou de modification. */
  themeForm: { id?: number; libelle: string; code?: string | null } | null;
  teacherId: string;
  classFilter: string;
}

/** Messages de la fenêtre de confirmation, selon la situation et l'onglet. */
const confirmText = (c: Confirm, kind: ProjectKind, tr: Tr): string[] => {
  const k = kind;
  switch (c.kind) {
    case "supprElem":
      return [tr(`evaluation.bilan.periodique.confirmsupp.${k}`, "Voulez-vous vraiment supprimer cet élément ?")];
    case "supprElemAppr":
      return [tr(`evaluation.bilan.periodique.suppression.${k}`, "Des appréciations sont liées à cet élément."), tr("evaluations.devoir.recaputilatif.suppression.confirmation", "Confirmez-vous la suppression ?")];
    case "supprEnseignant":
      return [tr("evaluations.devoir.confirmation.question.enseignant", "Souhaitez vous supprimer cet enseignant ?")];
    case "supprClasse":
      return [tr("evaluations.devoir.confirmation.question.classe", "Souhaitez vous supprimer cette classe ?")];
    case "modifElemSupprClasse":
      return [tr(`evaluation.bilan.periodique.modification.${k}`, "Des appréciations sont liées à cette classe."), tr("evaluations.devoir.recaputilatif.modification.confirmation", "Confirmez-vous cette modification ?")];
    case "themeInUse":
      return [tr("evaluation.bilan.periodique.supp.impossible", "Suppression impossible, le thème sélectionné est déjà utilisé par un EPI.")];
    case "themeDup":
      return [tr("evaluation.bilan.periodique.creation.impossible", "Création impossible, ce thème personnalisé existe déjà.")];
    default:
      return [tr("evaluation.bilan.periodique.already.exist", "Création impossible, un projet avec le même intitulé a déjà été saisi pour cet établissement et ce type de projet.")];
  }
};

/** Projets éducatifs : EPI, accompagnement personnalisé et parcours éducatifs du bilan périodique. */
export const Projects = ({ structureId, notify }: SectionProps) => {
  const tr = useCompT();
  const qc = useQueryClient();
  const [kind, setKind] = useState<ProjectKind>("EPI");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ prop: SortProp; reverse: boolean }>({ prop: "theme.libelle", reverse: true });
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [form, setForm] = useState<Form | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  const elementsKey = ["comp-elements", structureId];
  const elements = useQuery({ queryKey: elementsKey, queryFn: () => projectService.elements(structureId) });
  const themesKey = ["comp-themes", structureId, KIND_TYPE[kind]];
  const themes = useQuery({ queryKey: themesKey, queryFn: () => projectService.themes(KIND_TYPE[kind], structureId), enabled: !!form });
  const teachers = useQuery({ queryKey: ["comp-teachers", structureId], queryFn: () => projectService.teachers(structureId), enabled: !!form, staleTime: 5 * 60_000 });
  const matieres = useQuery({ queryKey: ["comp-matieres", structureId], queryFn: () => projectService.matieres(structureId), enabled: !!form, staleTime: 5 * 60_000 });
  const classes = useQuery({ queryKey: ["comp-classes-bp", structureId], queryFn: () => projectService.classes(structureId), enabled: !!form, staleTime: 5 * 60_000 });

  const rows = useMemo(
    () => sortElements((elements.data ?? []).filter((e) => belongsTo(kind, e) && matchesSearch(e, search)), sort.prop, sort.reverse),
    [elements.data, kind, search, sort],
  );
  const selectedElements = (elements.data ?? []).filter((e) => selected.has(e.id));
  const reloadElements = () => qc.invalidateQueries({ queryKey: elementsKey });
  const reloadThemes = () => qc.invalidateQueries({ queryKey: themesKey });
  const patch = (p: Partial<Form>) => setForm((f) => (f ? { ...f, ...p } : f));
  const patchDraft = (p: Partial<Draft>) => setForm((f) => (f ? { ...f, draft: { ...f.draft, ...p } } : f));

  const openForm = (edit?: Element) =>
    setForm({ draft: edit ? draftOf(edit, structureId) : emptyDraft(structureId), editing: !!edit, added: [], themeOpen: false, themeForm: null, teacherId: "", classFilter: "" });

  // --- suppression d'éléments -------------------------------------------------------------------------------
  const tryDeleteElements = async () => {
    try {
      const appreciations = await projectService.appreciations(deleteElementsQuery(structureId, selectedElements.map((e) => e.id)));
      setConfirm({ kind: appreciations.length > 0 ? "supprElemAppr" : "supprElem" });
    } catch {
      notify(false, tr("evaluations.appreciations.get.error", "Une erreur est survenue lors de la récupération des appréciations"));
    }
  };
  const deleteElements = async () => {
    try {
      await projectService.remove(deleteElementsQuery(structureId, selectedElements.map((e) => e.id)));
      setSelected(new Set());
    } catch {
      notify(false, tr("evaluations.elements.delete.error", "Erreur lors de la suppression des éléments"));
    }
    setConfirm(null);
    await reloadElements();
  };

  // --- enregistrement d'un élément --------------------------------------------------------------------------
  const submit = async () => {
    if (!form) return;
    const { draft, editing, added } = form;
    if (labelExists(elements.data ?? [], draft, editing ? draft.id : undefined)) return setConfirm({ kind: "labelDup" });
    const body = elementPayload(kind, draft, added, editing);
    try {
      if (editing && draft.id !== undefined) await projectService.update(draft.id, KIND_TYPE[kind], body);
      else await projectService.create(KIND_TYPE[kind], body);
      setForm(null);
      await reloadElements();
    } catch {
      notify(false, editing ? tr("evaluations.elements.update.error", "Erreur lors de la modification de l'élément") : tr("evaluations.elements.create.error", "Problème lors de la création de l'élément du bilan périodique"));
    }
  };

  // --- thèmes personnalisés ---------------------------------------------------------------------------------
  const saveTheme = async () => {
    if (!form?.themeForm) return;
    const t = form.themeForm;
    try {
      if (t.id === undefined) {
        if (themeExists(themes.data ?? [], t.libelle)) return setConfirm({ kind: "themeDup" });
        await projectService.createTheme({ libelle: t.libelle, type: KIND_TYPE[kind], idEtablissement: structureId });
        patch({ themeForm: null });
      } else {
        await projectService.updateTheme(t.id, { code: t.code, libelle: t.libelle, type: KIND_TYPE[kind] });
        patchDraft({ theme: { id: t.id, libelle: t.libelle, code: t.code, personnalise: true } });
        patch({ themeForm: null });
        await reloadElements();
      }
      await reloadThemes();
    } catch {
      notify(false, t.id === undefined ? tr("evaluations.thematique.create.error", "Problème lors de la création de la thématique") : tr("evaluations.thematique.update.error", "Erreur lors de la modification du thème"));
    }
  };
  const removeTheme = async (id: number) => {
    try {
      if ((await projectService.elementsOfTheme(id)).length > 0) return setConfirm({ kind: "themeInUse" });
      await projectService.removeTheme(id);
      if (form?.draft.theme?.id === id) patchDraft({ theme: undefined });
      await reloadThemes();
    } catch {
      notify(false, tr("evaluations.thematique.delete.error", "Erreur lors de la suppression du thème"));
    }
  };

  // --- retrait d'une classe déjà liée -----------------------------------------------------------------------
  const tryRemoveClass = async (index: number) => {
    if (!form?.draft.id) return;
    try {
      const appreciations = await projectService.appreciations(`idClasse=${form.draft.classes[index].id}&idElement=${form.draft.id}`);
      setConfirm({ kind: appreciations.length > 0 ? "modifElemSupprClasse" : "supprClasse", index });
    } catch {
      notify(false, tr("evaluations.appreciations.get.error", "Une erreur est survenue lors de la récupération des appréciations"));
    }
  };

  /** Valide la fenêtre de confirmation. */
  const accept = async () => {
    const c = confirm;
    if (!c) return;
    if (c.kind === "supprElem" || c.kind === "supprElemAppr") return deleteElements();
    if (c.kind === "supprEnseignant" && form && c.index !== undefined) patchDraft({ ens_mat: form.draft.ens_mat.filter((_, i) => i !== c.index) });
    if ((c.kind === "supprClasse" || c.kind === "modifElemSupprClasse") && form && c.index !== undefined) patchDraft({ classes: form.draft.classes.filter((_, i) => i !== c.index) });
    setConfirm(null);
  };
  const cancelConfirm = () => setConfirm(null);
  const isQuestion = confirm && ["supprElem", "supprElemAppr", "supprEnseignant", "supprClasse", "modifElemSupprClasse"].includes(confirm.kind);

  const incomplete = form ? isDraftIncomplete(kind, form.draft, form.added) : true;
  const sub = form ? distinctSubjects(form.draft.ens_mat) : { hasTwoTimes: false };
  const titleKey = form ? `evaluations.${form.editing ? "modify" : "create"}.${kind}` : "";
  const classOptions = (classes.data ?? []).filter((c) => !form?.draft.classes.some((x) => x.id === c.id) && !form?.added.some((x) => x.id === c.id) && c.name.toLowerCase().includes((form?.classFilter ?? "").toLowerCase()));
  const teacher = (teachers.data ?? []).find((t) => t.id === form?.teacherId);

  const header = (prop: SortProp, label: string) => (
    <th aria-sort={sort.prop === prop ? (sort.reverse ? "descending" : "ascending") : "none"}>
      <button type="button" className="border-0 bg-transparent p-0 fw-bold" onClick={() => setSort((s) => nextSort(s, prop))} data-vsco-comp-project-sort={prop}>
        {label} {sort.prop === prop ? (sort.reverse ? "▼" : "▲") : ""}
      </button>
    </th>
  );

  return (
    <div data-vsco-comp-projects>
      <h3 className="h5 mb-12">{tr("evaluations.educatif.project", "Projets éducatifs")}</h3>
      <ul className="nav nav-tabs mb-12" role="tablist" aria-label={tr("evaluations.educatif.project", "Projets éducatifs")}>
        {KINDS.map((k) => (
          <li className="nav-item" role="presentation" key={k}>
            <button
              type="button"
              role="tab"
              aria-selected={kind === k}
              className={`nav-link${kind === k ? " active" : ""}`}
              onClick={() => {
                setKind(k);
                setSelected(new Set());
              }}
              data-vsco-comp-project-tab={k}
            >
              {tr(TAB_LABEL[k][0], TAB_LABEL[k][1])}
            </button>
          </li>
        ))}
      </ul>
      <div className="d-flex gap-8 flex-wrap align-items-center mb-12">
        <input className="form-control" style={{ maxWidth: 420 }} type="search" placeholder={SEARCH_LABEL[kind]} aria-label={SEARCH_LABEL[kind]} value={search} onChange={(e) => setSearch(e.target.value)} data-vsco-comp-project-search />
        <Button type="button" color="primary" onClick={() => openForm()} data-vsco-comp-project-add>
          {tr(ADD_LABEL[kind][0], ADD_LABEL[kind][1])}
        </Button>
      </div>
      {elements.isLoading && <p className="text-muted">{tr("viescolaire.loading", "Chargement…")}</p>}
      {elements.isError && (
        <p className="text-danger" role="alert">
          {tr("evaluations.elements.get.error", "Une erreur est survenue lors de la récupération des éléments")}
        </p>
      )}
      <div className="table-responsive">
        <table className="table" data-vsco-comp-project-table>
          <thead>
            <tr>
              <th scope="col">
                <input
                  type="checkbox"
                  className="form-check-input"
                  aria-label={tr("viescolaire.select.all", "Tout sélectionner")}
                  checked={rows.length > 0 && rows.every((e) => selected.has(e.id))}
                  onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())}
                  data-vsco-comp-project-all
                />
              </th>
              {kind !== "AP" && header("theme.libelle", tr("viescolaire.competences.theme", "Thème"))}
              {kind !== "parcours" && header("libelle", tr("viescolaire.libelle", "Libellé"))}
              {kind !== "parcours" && <th scope="col">{tr("viescolaire.competences.intervenant", "Intervenants")}</th>}
              <th scope="col">{tr("viescolaire.competences.classe.groupe", "Classes / Groupes")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id} data-vsco-comp-project-row={e.libelle ?? e.theme?.libelle}>
                <td>
                  <input
                    type="checkbox"
                    className="form-check-input"
                    aria-label={e.libelle ?? e.theme?.libelle ?? ""}
                    checked={selected.has(e.id)}
                    onChange={(ev) =>
                      setSelected((s) => {
                        const n = new Set(s);
                        ev.target.checked ? n.add(e.id) : n.delete(e.id);
                        return n;
                      })
                    }
                    data-vsco-comp-project-check
                  />
                </td>
                {kind !== "AP" && <td>{e.theme?.libelle}</td>}
                {kind !== "parcours" && <td>{e.libelle}</td>}
                {kind !== "parcours" && <td>{[...e.intervenantsMatieres].sort((a, b) => a.intervenant.displayName.localeCompare(b.intervenant.displayName)).map((x) => x.intervenant.displayName).join(" - ")}</td>}
                <td>{[...e.groupes].sort((a, b) => a.name.localeCompare(b.name)).map((g) => g.name).join(" - ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selectedElements.length > 0 && (
        <div className="d-flex gap-8 position-sticky bottom-0 bg-white border-top py-8" data-vsco-comp-project-bar>
          {selectedElements.length === 1 && (
            <Button type="button" color="primary" onClick={() => openForm(selectedElements[0])} data-vsco-comp-project-edit>
              {tr("item.modify", "Modifier")}
            </Button>
          )}
          <Button type="button" color="danger" onClick={tryDeleteElements} data-vsco-comp-project-delete>
            {tr("item.delete", "Supprimer")}
          </Button>
        </div>
      )}

      <Modal id="vsco-comp-project-form" isOpen={!!form && !confirm} onModalClose={() => setForm(null)} size="lg">
        <Modal.Header onModalClose={() => setForm(null)}>{tr(titleKey, form?.editing ? "Modifier" : "Créer")}</Modal.Header>
        <Modal.Body>
          {form && (
            <div data-vsco-comp-project-form>
              {kind !== "AP" && (
                <div className="mb-12">
                  <p className="fw-bold mb-4">{tr("viescolaire.utils.themes", "Thèmes")} *</p>
                  <button type="button" className="form-select text-start" aria-expanded={form.themeOpen} onClick={() => patch({ themeOpen: !form.themeOpen })} data-vsco-comp-theme-toggle>
                    {form.draft.theme ? form.draft.theme.libelle : tr("viescolaire.utils.choix.theme", "Choix du thème")}
                  </button>
                  {form.themeOpen && (
                    <div className="card p-8 mt-4" data-vsco-comp-theme-list>
                      {kind === "EPI" && (
                        <div className="mb-8">
                          {form.themeForm ? (
                            <div className="d-flex gap-8">
                              <input autoFocus className="form-control" maxLength={150} placeholder={tr("viescolaire.comp.theme.label", "Intitulé")} aria-label={tr("viescolaire.comp.theme.label", "Intitulé")} value={form.themeForm.libelle} onChange={(e) => patch({ themeForm: { ...form.themeForm!, libelle: e.target.value } })} data-vsco-comp-theme-input />
                              <Button type="button" color="primary" disabled={form.themeForm.libelle.trim() === ""} onClick={saveTheme} data-vsco-comp-theme-save>
                                {form.themeForm.id === undefined ? tr("evaluations.add", "Ajouter") : tr("item.modify", "Modifier")}
                              </Button>
                            </div>
                          ) : (
                            <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => patch({ themeForm: { libelle: "" } })} data-vsco-comp-theme-new>
                              + {tr("evaluations.add", "Ajouter")}
                            </button>
                          )}
                        </div>
                      )}
                      <ul className="list-unstyled m-0">
                        {themesOf(themes.data ?? [], false).map((t) => (
                          <li key={t.id}>
                            <button type="button" className="btn btn-link p-0 text-start" onClick={() => { patchDraft({ theme: t }); patch({ themeOpen: false }); }} data-vsco-comp-theme-pick={t.libelle}>
                              {t.libelle}
                            </button>
                          </li>
                        ))}
                        {kind === "EPI" &&
                          themesOf(themes.data ?? [], true).map((t) => (
                            <li key={t.id} className="d-flex align-items-center gap-8">
                              <button type="button" className="btn btn-link p-0 text-start" onClick={() => { patchDraft({ theme: t }); patch({ themeOpen: false }); }} data-vsco-comp-theme-pick={t.libelle}>
                                {t.libelle}
                              </button>
                              <button type="button" className="btn btn-sm btn-outline-secondary ms-auto" onClick={() => patch({ themeForm: { id: t.id, libelle: t.libelle, code: t.code } })} data-vsco-comp-theme-edit>
                                {tr("item.modify", "Modifier")}
                              </button>
                              <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => removeTheme(t.id)} data-vsco-comp-theme-delete>
                                {tr("item.delete", "Supprimer")}
                              </button>
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              {kind !== "parcours" && (
                <>
                  <div className="mb-12">
                    <label htmlFor="vsco-comp-project-libelle" className="form-label fw-bold">
                      {tr("viescolaire.libelle", "Libellé")} *
                    </label>
                    <textarea id="vsco-comp-project-libelle" className="form-control" rows={1} maxLength={MAX_LIBELLE} placeholder={tr("viescolaire.comp.libelle.placeholder", "Saisir le libellé")} value={form.draft.libelle} onChange={(e) => patchDraft({ libelle: e.target.value })} data-vsco-comp-project-libelle />
                  </div>
                  <div className="mb-12">
                    <label htmlFor="vsco-comp-project-description" className="form-label fw-bold">
                      {tr("viescolaire.utils.description", "Description")}
                    </label>
                    <textarea id="vsco-comp-project-description" className="form-control" rows={5} maxLength={MAX_DESCRIPTION} placeholder={tr("viescolaire.comp.description.placeholder", "Saisir la description")} value={form.draft.description} onChange={(e) => patchDraft({ description: e.target.value })} data-vsco-comp-project-description />
                  </div>
                  <div className="mb-12">
                    <p className="fw-bold mb-4">
                      {tr("viescolaire.competences.intervenant.matiere", "Intervenants / Matières")} *{" "}
                      {kind === "EPI" && <em className="fw-normal">{tr("evaluations.nb.intervenant.requis", "(Deux intervenants minimum)")}</em>}
                    </p>
                    {sub.hasTwoTimes && (
                      <p className="text-warning" role="alert">
                        {tr("evaluations.elements.subject.appear.two.times", "Attention, vous avez rajouté deux intervenants sur une même matière")}
                      </p>
                    )}
                    <div className="d-flex gap-8 flex-wrap mb-8">
                      <select className="form-select" style={{ maxWidth: 260 }} aria-label={tr("viescolaire.utils.teacher", "Enseignant")} value={form.teacherId} onChange={(e) => patch({ teacherId: e.target.value })} data-vsco-comp-project-teacher>
                        <option value="">{tr("viescolaire.utils.teacher", "Enseignant")}</option>
                        {(teachers.data ?? []).map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.displayName}
                          </option>
                        ))}
                      </select>
                      <select
                        className="form-select"
                        style={{ maxWidth: 320 }}
                        aria-label={tr("viescolaire.utils.subject", "Matière")}
                        disabled={!teacher}
                        value=""
                        onChange={(e) => {
                          const m = (matieres.data ?? []).find((x) => x.id === e.target.value);
                          if (teacher && m) patchDraft({ ens_mat: addEnsMat(form.draft.ens_mat, teacher, m) });
                        }}
                        data-vsco-comp-project-subject
                      >
                        <option value="">{tr("viescolaire.utils.subject", "Matière")}</option>
                        {freeSubjects(matieres.data ?? [], form.draft.ens_mat).map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.externalId} - {m.source})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="d-flex gap-8 flex-wrap" data-vsco-comp-project-chips>
                      {form.draft.ens_mat.map((x, i) => (
                        <button key={`${x.intervenant.id}-${x.matiere.id}`} type="button" className="badge text-bg-secondary border-0" title={tr("item.delete", "Supprimer")} onClick={() => setConfirm({ kind: "supprEnseignant", index: i })} data-vsco-comp-project-chip>
                          {x.intervenant.displayName} / {x.matiere.name} ×
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
              <div className="mb-12">
                <p className="fw-bold mb-4">{tr("viescolaire.competences.classe.groupe", "Classes / Groupes")} *</p>
                <div className="d-flex gap-8 flex-wrap mb-8" data-vsco-comp-project-classes>
                  {form.editing &&
                    form.draft.classes.map((c, i) => (
                      <button key={c.id} type="button" className="badge text-bg-secondary border-0" title={tr("item.delete", "Supprimer")} onClick={() => tryRemoveClass(i)} data-vsco-comp-project-class>
                        {c.name} ×
                      </button>
                    ))}
                  {form.added.map((c) => (
                    <button key={c.id} type="button" className="badge text-bg-primary border-0" title={tr("item.delete", "Supprimer")} onClick={() => patch({ added: form.added.filter((x) => x.id !== c.id) })} data-vsco-comp-project-class-added>
                      {c.name} ×
                    </button>
                  ))}
                </div>
                {form.editing && <p className="mb-4 fw-bold">{tr("add", "Ajouter")} {tr("viescolaire.competences.classe.groupe", "Classes / Groupes")}</p>}
                <input className="form-control mb-4" style={{ maxWidth: 320 }} type="search" aria-label={tr("viescolaire.utils.class.groupe", "Classe / Groupe")} placeholder={tr("viescolaire.utils.class.groupe", "Classe / Groupe")} value={form.classFilter} onChange={(e) => patch({ classFilter: e.target.value })} data-vsco-comp-project-class-filter />
                <ul className="list-unstyled border rounded p-8 mb-0" style={{ maxHeight: 160, overflow: "auto" }} data-vsco-comp-project-class-options>
                  {classOptions.map((c) => (
                    <li key={c.id}>
                      <label className="d-flex gap-8 align-items-center m-0">
                        <input type="checkbox" className="form-check-input m-0" checked={false} onChange={() => patch({ added: [...form.added, c] })} data-vsco-comp-project-class-pick={c.name} />
                        {c.name}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" color="tertiary" variant="ghost" onClick={() => setForm(null)}>
            {tr("competences.cancel", "Annuler")}
          </Button>
          <Button type="button" color="primary" disabled={incomplete} onClick={submit} data-vsco-comp-project-save>
            {form?.editing ? tr("item.modify", "Modifier") : tr("evaluations.add", "Ajouter")}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal id="vsco-comp-project-confirm" isOpen={!!confirm} onModalClose={cancelConfirm} size="md">
        <Modal.Header onModalClose={cancelConfirm}>{tr("evaluations.educatif.project", "Projets éducatifs")}</Modal.Header>
        <Modal.Body>
          {confirm && confirmText(confirm, kind, tr).map((m, i) => (
            <p key={i} className="m-0 mb-4" data-vsco-comp-project-confirm-text>
              {m}
            </p>
          ))}
        </Modal.Body>
        <Modal.Footer>
          {isQuestion && (
            <Button type="button" color="tertiary" variant="ghost" onClick={cancelConfirm}>
              {tr("competences.cancel", "Annuler")}
            </Button>
          )}
          <Button type="button" color={isQuestion ? "danger" : "primary"} onClick={accept} data-vsco-comp-project-confirm-ok>
            {tr("evaluations.perso.ok", "Ok")}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};
