import { Button, Modal } from "@open-ent/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { canSaveModel, filterModels, modelPayload, newModel, SubjectModel, sortedSubjects } from "../../lib/competencesMisc";
import { subjectModelService } from "../../services/competences.service";
import { SectionProps, useCompT } from "./shared";

/** Modification des libellés des matières : modèles de libellés à créer, modifier, supprimer. */
export const SubjectModels = ({ structureId, notify }: SectionProps) => {
  const tr = useCompT();
  const qc = useQueryClient();
  const key = ["comp-models", structureId];
  const list = useQuery({ queryKey: key, queryFn: () => subjectModelService.list(structureId) });
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [form, setForm] = useState<SubjectModel | null>(null);
  const [toDelete, setToDelete] = useState<SubjectModel | null>(null);
  const shown = useMemo(() => filterModels(list.data ?? [], search), [list.data, search]);
  const modelKey = (m: SubjectModel) => String(m.id ?? m.title);

  const save = async () => {
    if (!form || !canSaveModel(form)) return;
    const body = modelPayload(form, structureId);
    setForm(null);
    try {
      await subjectModelService.save(structureId, body);
      notify(true, tr("evaluations.rename.subject.success.save.model", "Modèle sauvegardé"));
    } catch {
      notify(false, tr("evaluations.rename.subject.error.save.model", "Erreur lors de la sauvegarde du modèle"));
    }
    await qc.invalidateQueries({ queryKey: key });
  };

  const remove = async () => {
    if (toDelete?.id === undefined) return;
    try {
      await subjectModelService.remove(toDelete.id, structureId);
      notify(true, tr("evaluations.rename.subject.success.delete.model", "Modèle supprimé"));
    } catch {
      notify(false, tr("evaluations.rename.subject.error.delete.model", "Erreur lors de la suppression du modèle"));
    }
    setToDelete(null);
    await qc.invalidateQueries({ queryKey: key });
  };

  return (
    <div data-vsco-comp-models>
      <h3 className="h5 mb-12">
        {tr("evaluations.rename.subject.title", "Modification des libellés des matières")} {tr("evaluations.rename.subject.title.precision", " (sur le bulletin) ")}
      </h3>
      <div className="d-flex gap-8 flex-wrap align-items-center mb-12">
        <input className="form-control" style={{ maxWidth: 420 }} type="search" placeholder={tr("evaluations.rename.subject.search.model", "Rechercher un modèle")} aria-label={tr("evaluations.rename.subject.search.model", "Rechercher un modèle")} value={search} onChange={(e) => setSearch(e.target.value)} data-vsco-comp-model-search />
        <Button type="button" color="primary" disabled={!list.data} onClick={() => setForm(newModel(list.data ?? []))} data-vsco-comp-model-add>
          {tr("evaluations.rename.subject.create.model", "Créer un modèle")}
        </Button>
      </div>
      {list.isLoading && <p className="text-muted">{tr("viescolaire.loading", "Chargement…")}</p>}
      {list.isError && (
        <p className="text-danger" role="alert">
          {tr("evaluations.rename.subject.error.get.subjects", "Erreur lors de la récupération des libelles des matières")}
        </p>
      )}
      {shown.map((m) => {
        const k = modelKey(m);
        const isOpen = open.has(k);
        return (
          <section key={k} className="card mb-12" data-vsco-comp-model={m.title}>
            <div className="d-flex align-items-center gap-8 p-12">
              <button
                type="button"
                className="btn btn-link p-0 fw-bold text-start"
                aria-expanded={isOpen}
                onClick={() =>
                  setOpen((s) => {
                    const n = new Set(s);
                    n.has(k) ? n.delete(k) : n.add(k);
                    return n;
                  })
                }
                data-vsco-comp-model-toggle
              >
                {tr("evaluations.model", "Modèle ")} : {m.title}
              </button>
              {m.id !== undefined && (
                <span className="ms-auto d-flex gap-4">
                  <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setForm({ ...m, subjects: m.subjects.map((s) => ({ ...s })) })} data-vsco-comp-model-edit>
                    {tr("item.modify", "Modifier")}
                  </button>
                  <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setToDelete(m)} data-vsco-comp-model-delete>
                    {tr("item.delete", "Supprimer")}
                  </button>
                </span>
              )}
            </div>
            {isOpen && (
              <table className="table mb-0">
                <thead>
                  <tr>
                    <th scope="col">{tr("viescolaire.utils.subject", "Matière")}</th>
                    <th scope="col">{tr("evaluations.libelle", "Libellé")}</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSubjects(m).map((s, i) => (
                    <tr key={`${s.id ?? s.name}-${i}`}>
                      <td>{s.name}</td>
                      <td>{s.libelle}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        );
      })}

      <Modal id="vsco-comp-model-form" isOpen={!!form} onModalClose={() => setForm(null)} size="lg">
        <Modal.Header onModalClose={() => setForm(null)}>
          {form?.id === undefined ? tr("evaluations.rename.subject.create.model.title", "Création d'un modèle") : tr("evaluations.rename.subject.modify.model.title", "Modification d'un modèle")}
        </Modal.Header>
        <Modal.Body>
          {form && (
            <>
              <div className="mb-12">
                <label htmlFor="vsco-comp-model-title" className="form-label fw-bold">
                  {tr("evaluations.model.name", "Nom du modèle ")} *
                </label>
                <input id="vsco-comp-model-title" className="form-control" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} data-vsco-comp-model-title />
              </div>
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">{tr("viescolaire.utils.subject", "Matière")}</th>
                    <th scope="col">{tr("evaluations.libelle", "Libellé")}</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSubjects(form).map((s) => (
                    <tr key={`${s.id ?? s.name}`}>
                      <td>{s.name}</td>
                      <td>
                        <input
                          className="form-control form-control-sm"
                          aria-label={`${tr("evaluations.libelle", "Libellé")} ${s.name}`}
                          value={s.libelle ?? ""}
                          onChange={(e) => setForm({ ...form, subjects: form.subjects.map((x) => (x === s ? { ...x, libelle: e.target.value } : x)) })}
                          data-vsco-comp-model-subject
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" color="tertiary" variant="ghost" onClick={() => setForm(null)}>
            {tr("cancel", "Annuler")}
          </Button>
          <Button type="button" color="primary" disabled={!form || !canSaveModel(form)} onClick={save} data-vsco-comp-model-save>
            {tr("viescolaire.utils.save", "Enregistrer")}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal id="vsco-comp-model-delete" isOpen={!!toDelete} onModalClose={() => setToDelete(null)} size="md">
        <Modal.Header onModalClose={() => setToDelete(null)}>{tr("item.delete", "Supprimer")}</Modal.Header>
        <Modal.Body>
          <p className="m-0">{toDelete?.title}</p>
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" color="tertiary" variant="ghost" onClick={() => setToDelete(null)}>
            {tr("cancel", "Annuler")}
          </Button>
          <Button type="button" color="danger" onClick={remove} data-vsco-comp-model-delete-confirm>
            {tr("item.delete", "Supprimer")}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};
