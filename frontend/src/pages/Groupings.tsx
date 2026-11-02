import { Button, Modal } from "@open-ent/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useStructure } from "../components/StructureContext";
import { addableClasses, classesOf, Grouping, sortGroupings, validGroupingName } from "../lib/groupings";
import { groupingService, timeSlotService } from "../services/settings.service";

/** Regroupements et niveaux : créer, renommer, supprimer, et leur associer des classes. */
export const Groupings = () => {
  const { t } = useTranslation("viescolaire");
  const structure = useStructure();
  const qc = useQueryClient();
  const key = ["groupings", structure.id];
  const list = useQuery({ queryKey: key, queryFn: () => groupingService.list(structure.id) });
  const classes = useQuery({ queryKey: ["classes", structure.id], queryFn: () => timeSlotService.classes(structure.id) });
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<Grouping | null>(null);
  const [renameTo, setRenameTo] = useState("");
  const [toDelete, setToDelete] = useState<Grouping | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const tr = (k: string, d: string) => t(k, { defaultValue: d });

  const run = async (action: () => Promise<unknown>, ok: string, ko: string) => {
    try {
      await action();
      setMessage({ ok: true, text: ok });
    } catch {
      setMessage({ ok: false, text: ko });
    }
    await qc.invalidateQueries({ queryKey: key });
  };

  return (
    <section data-vsco-groupings>
      <h2 className="h4 mb-8">{tr("viescolaire.grouping.set", "Regroupements, niveaux")}</h2>
      <p className="text-muted">{tr("viescolaire.presentation", "Association de classes et groupes à un regroupement ou un niveau : cela vous permettra de chercher des informations par regroupement ou niveau plutôt que par classe et groupe.")}</p>
      {message && (
        <p className={message.ok ? "text-success" : "text-danger"} role={message.ok ? "status" : "alert"} data-vsco-message>
          {message.text}
        </p>
      )}
      {list.isError && (
        <p className="text-danger" role="alert">
          {tr("viescolaire.get.fail", "Erreur lors de la récupération")}
        </p>
      )}

      <form
        className="d-flex gap-8 align-items-end flex-wrap mb-16"
        onSubmit={(e) => {
          e.preventDefault();
          if (!validGroupingName(newName)) return;
          run(() => groupingService.create(structure.id, newName.trim()), tr("viescolaire.create.done", "Regroupement créé"), tr("viescolaire.create.fail", "Erreur lors de la création"));
          setNewName("");
        }}
      >
        <div>
          <label htmlFor="vsco-group-new" className="form-label">
            {tr("viescolaire.grouping.title", "Nom du regroupement")}
          </label>
          <input id="vsco-group-new" className="form-control" value={newName} onChange={(e) => setNewName(e.target.value)} data-vsco-group-name />
        </div>
        <Button type="submit" color="primary" disabled={!validGroupingName(newName)} data-vsco-group-create>
          {tr("viescolaire.grouping.create", "Créer un regroupement")}
        </Button>
      </form>

      {sortGroupings(list.data ?? []).map((g) => (
        <div key={g.id} className="card p-16 mb-8" data-vsco-group={g.name}>
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-8 mb-8">
            <strong>{g.name}</strong>
            <div className="d-flex gap-8">
              <button type="button" className="btn btn-sm btn-secondary" onClick={() => { setRenaming(g); setRenameTo(g.name); }} data-vsco-group-rename>
                {tr("viescolaire.grouping.buttonRename", "Renommer")}
              </button>
              <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setToDelete(g)} data-vsco-group-delete>
                {tr("viescolaire.utils.delete", "Supprimer")}
              </button>
            </div>
          </div>
          <ul className="list-inline mb-8">
            {classesOf(g).map((c) => (
              <li key={c.id} className="list-inline-item me-16">
                {c.name}{" "}
                <button
                  type="button"
                  className="btn btn-link p-0"
                  aria-label={`${tr("viescolaire.utils.delete", "Retirer")} ${c.name}`}
                  onClick={() => run(() => groupingService.removeClass(g.id, c.id), tr("viescolaire.update.done", "Regroupement modifié"), tr("viescolaire.grouping.delete.audience.fail", "Erreur lors de la suppression de la classe"))}
                  data-vsco-group-remove-class={c.name}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          {addableClasses(classes.data ?? [], g).length > 0 && (
            <select
              className="form-select"
              style={{ maxWidth: 320 }}
              value=""
              aria-label={tr("viescolaire.select.classes", "Sélectionner des classes")}
              onChange={(e) => e.target.value && run(() => groupingService.addClass(g.id, e.target.value), tr("viescolaire.update.done", "Regroupement modifié"), tr("viescolaire.grouping.add.audience.fail", "Erreur lors de l'ajout de la classe"))}
              data-vsco-group-add-class
            >
              <option value="">{tr("viescolaire.select.classes", "Sélectionner des classes")}</option>
              {addableClasses(classes.data ?? [], g).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>
      ))}

      <Modal id="vsco-group-rename" isOpen={!!renaming} onModalClose={() => setRenaming(null)}>
        <Modal.Header onModalClose={() => setRenaming(null)}>{tr("viescolaire.grouping.rename", "Renommer un regroupement")}</Modal.Header>
        <Modal.Body>
          <label htmlFor="vsco-group-rename-input" className="form-label">
            {tr("viescolaire.grouping.title", "Nom du regroupement")}
          </label>
          <input id="vsco-group-rename-input" className="form-control" value={renameTo} onChange={(e) => setRenameTo(e.target.value)} data-vsco-group-rename-input />
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" color="tertiary" variant="ghost" onClick={() => setRenaming(null)}>
            {tr("viescolaire.grouping.buttonCancel", "Annuler")}
          </Button>
          <Button
            type="button"
            color="primary"
            disabled={!validGroupingName(renameTo)}
            onClick={() => {
              const g = renaming;
              setRenaming(null);
              if (g) run(() => groupingService.rename(g.id, renameTo.trim()), tr("viescolaire.update.done", "Regroupement modifié"), tr("viescolaire.update.fail", "Erreur lors de la modification"));
            }}
            data-vsco-group-rename-save
          >
            {tr("viescolaire.grouping.buttonRename", "Renommer")}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal id="vsco-group-delete" isOpen={!!toDelete} onModalClose={() => setToDelete(null)}>
        <Modal.Header onModalClose={() => setToDelete(null)}>{tr("viescolaire.utils.delete", "Supprimer")}</Modal.Header>
        <Modal.Body>
          <p className="m-0">« {toDelete?.name} »</p>
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" color="tertiary" variant="ghost" onClick={() => setToDelete(null)}>
            {tr("viescolaire.grouping.buttonCancel", "Annuler")}
          </Button>
          <Button
            type="button"
            color="danger"
            onClick={() => {
              const g = toDelete;
              setToDelete(null);
              if (g) run(() => groupingService.remove(g.id), tr("viescolaire.delete.done", "Regroupement supprimé"), tr("viescolaire.delete.fail", "Erreur lors de la suppression"));
            }}
            data-vsco-group-delete-confirm
          >
            {tr("viescolaire.utils.delete", "Supprimer")}
          </Button>
        </Modal.Footer>
      </Modal>
    </section>
  );
};
