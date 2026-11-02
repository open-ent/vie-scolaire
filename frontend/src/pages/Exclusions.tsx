import { Button, Modal } from "@open-ent/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useStructure } from "../components/StructureContext";
import { Draft, draftOf, Exclusion, exclusionPayload, frDate, isValidExclusion, SortKey, sortExclusions } from "../lib/exclusions";
import { exclusionService } from "../services/settings.service";

/** Périodes d'exclusion (vacances, examens…) : liste triable, ajout, modification, suppression. */
export const Exclusions = () => {
  const { t } = useTranslation(["viescolaire", "edt"]);
  const structure = useStructure();
  const qc = useQueryClient();
  const key = ["exclusions", structure.id];
  const list = useQuery({ queryKey: key, queryFn: () => exclusionService.list(structure.id) });
  const [sort, setSort] = useState<{ key: SortKey; reverse: boolean }>({ key: "start_date", reverse: false });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [toDelete, setToDelete] = useState<Exclusion | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const valid = !!draft && isValidExclusion(draft);
  const courses = useQuery({
    queryKey: ["exclusionCourses", structure.id, draft?.start, draft?.end],
    queryFn: () => exclusionService.countCourses(structure.id, draft!.start, draft!.end),
    enabled: valid,
  });
  const sorted = useMemo(() => sortExclusions(list.data ?? [], sort.key, sort.reverse), [list.data, sort]);
  const tr = (k: string, d: string, ns: "viescolaire" | "edt" = "edt") => t(k, { ns, defaultValue: d });

  const save = async () => {
    if (!draft) return;
    try {
      const body = exclusionPayload(structure.id, draft);
      if (draft.id) await exclusionService.update(draft.id, body);
      else await exclusionService.create(body);
      setNotice({ ok: true, text: draft.id ? tr("edt.admin.exclusions.updated", "Exclusion modifiée.") : tr("edt.admin.exclusions.created", "Exclusion ajoutée.") });
      setDraft(null);
    } catch {
      setNotice({ ok: false, text: draft.id ? tr("edt.notify.exclusion.update.err", "Erreur lors de la mise à jour de l'exclusion") : tr("edt.notify.exclusion.create.err", "Erreur lors de la création de l'exclusion") });
    }
    await qc.invalidateQueries({ queryKey: key });
  };

  const remove = async () => {
    if (!toDelete) return;
    try {
      await exclusionService.remove(toDelete.id);
      setNotice({ ok: true, text: tr("edt.admin.exclusions.deleted", "Exclusion supprimée.") });
    } catch {
      setNotice({ ok: false, text: tr("edt.notify.exclusion.delete.err", "Erreur lors de la suppression de l'exclusion") });
    }
    setToDelete(null);
    await qc.invalidateQueries({ queryKey: key });
  };

  const header = (k: SortKey, label: string) => (
    <th aria-sort={sort.key === k ? (sort.reverse ? "descending" : "ascending") : "none"}>
      <button type="button" className="border-0 bg-transparent p-0 fw-bold" onClick={() => setSort((s) => ({ key: k, reverse: s.key === k ? !s.reverse : false }))} data-vsco-excl-sort={k}>
        {label} {sort.key === k ? (sort.reverse ? "▼" : "▲") : ""}
      </button>
    </th>
  );

  return (
    <section data-vsco-exclusions>
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-8 mb-12">
        <h2 className="h4 mb-0">{tr("viescolaire.exclusion.set", "Périodes d'exclusion", "viescolaire")}</h2>
        {!draft && (
          <Button type="button" color="primary" onClick={() => setDraft({ description: "", start: "", end: "" })} data-vsco-excl-add>
            {tr("edt.settings.exclusion.add", "Ajouter une exclusion")}
          </Button>
        )}
      </div>
      <p className="text-muted">{tr("edt.admin.exclusions.hint", "Une période fermée (vacances, examens…) masque les cours de l'emploi du temps sur ces dates, pour tout l'établissement.")}</p>
      {notice && (
        <p className={notice.ok ? "text-success" : "text-danger"} role={notice.ok ? "status" : "alert"} data-vsco-message>
          {notice.text}
        </p>
      )}

      {draft && (
        <div className="card p-16 mb-16" data-vsco-excl-form>
          <div className="mb-12">
            <label htmlFor="vsco-excl-desc" className="form-label fw-bold">
              {tr("edt.settings.exclusion.description", "Description")} *
            </label>
            <input id="vsco-excl-desc" className="form-control" style={{ maxWidth: 420 }} placeholder={tr("edt.admin.exclusions.example", "Vacances de printemps…")} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} data-vsco-excl-desc />
          </div>
          <div className="d-flex gap-12 flex-wrap mb-12">
            <div>
              <label htmlFor="vsco-excl-start" className="form-label fw-bold">
                {tr("edt.settings.exclusion.start_date", "Date de début")} *
              </label>
              <input id="vsco-excl-start" type="date" className="form-control" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} data-vsco-excl-start />
            </div>
            <div>
              <label htmlFor="vsco-excl-end" className="form-label fw-bold">
                {tr("edt.settings.exclusion.end_date", "Date de fin")} *
              </label>
              <input id="vsco-excl-end" type="date" className="form-control" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} data-vsco-excl-end />
            </div>
          </div>
          {draft.start && draft.end && draft.end < draft.start && (
            <p className="text-warning" role="alert" data-vsco-excl-order>
              {tr("edt.admin.exclusions.order", "La date de fin doit être le même jour que la date de début ou après.")}
            </p>
          )}
          {(courses.data ?? 0) > 0 && (
            <p className="text-info" role="status" data-vsco-excl-courses>
              {tr("edt.admin.exclusions.courses", "[[0]] cours sur cette période.").replace("[[0]]", String(courses.data))} {tr("edt.info.message.there.is.courses.to.delete", "Des cours ont déjà été programmés sur cette période, ils ne seront plus pris en compte tant que la période est fermée.")}
            </p>
          )}
          <div className="d-flex gap-8">
            <Button type="button" color="tertiary" variant="ghost" onClick={() => setDraft(null)}>
              {tr("viescolaire.utils.cancel", "Annuler", "viescolaire")}
            </Button>
            <Button type="button" color="primary" disabled={!valid} onClick={save} data-vsco-excl-save>
              {tr("viescolaire.utils.save", "Enregistrer", "viescolaire")}
            </Button>
          </div>
        </div>
      )}

      {sorted.length === 0 ? (
        <p className="text-muted">{tr("edt.admin.exclusions.none", "Aucune période exclue pour l'instant.")}</p>
      ) : (
        <table className="table" data-vsco-excl-table>
          <thead>
            <tr>
              {header("description", tr("edt.settings.exclusion.description", "Description"))}
              {header("start_date", tr("edt.settings.exclusion.start_date", "Date de début"))}
              {header("end_date", tr("edt.settings.exclusion.end_date", "Date de fin"))}
              <th>{tr("edt.admin.labels.col.actions", "Actions")}</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((e) => (
              <tr key={e.id} data-vsco-excl-row={e.description}>
                <td>{e.description}</td>
                <td>{frDate(e.start_date)}</td>
                <td>{frDate(e.end_date)}</td>
                <td className="d-flex gap-8 flex-wrap">
                  <button type="button" className="btn btn-sm btn-secondary" onClick={() => setDraft(draftOf(e))} data-vsco-excl-edit>
                    {tr("edt.utils.modify", "Modifier")}
                  </button>
                  <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setToDelete(e)} data-vsco-excl-delete>
                    {tr("edt.utils.delete", "Supprimer")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Modal id="vsco-excl-delete" isOpen={!!toDelete} onModalClose={() => setToDelete(null)} size="md">
        <Modal.Header onModalClose={() => setToDelete(null)}>{tr("edt.admin.exclusions.delete.title", "Supprimer l'exclusion")}</Modal.Header>
        <Modal.Body>
          <p className="m-0">
            {tr("edt.settings.exclusion.deletion", "Êtes-vous sûr de vouloir supprimer l'exclusion")} « {toDelete?.description} » ({frDate(toDelete?.start_date ?? "")} – {frDate(toDelete?.end_date ?? "")}) ?
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" color="tertiary" variant="ghost" onClick={() => setToDelete(null)}>
            {tr("viescolaire.utils.cancel", "Annuler", "viescolaire")}
          </Button>
          <Button type="button" color="danger" onClick={remove} data-vsco-excl-delete-confirm>
            {tr("edt.utils.delete", "Supprimer")}
          </Button>
        </Modal.Footer>
      </Modal>
    </section>
  );
};
