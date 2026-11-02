import { Button, Modal } from "@open-ent/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { canSaveOpinion, isReadOnlyOpinion, MAX_OPINION, Opinion, opinionsOfType, opinionUpdatePath } from "../../lib/competencesMisc";
import { opinionService } from "../../services/competences.service";
import { SectionProps, useCompT } from "./shared";

/** Avis du conseil de classe et d'orientation : afficher/masquer, renommer, ajouter, supprimer. */
export const Opinions = ({ structureId, notify }: SectionProps) => {
  const tr = useCompT();
  const qc = useQueryClient();
  const key = ["comp-opinions", structureId];
  const list = useQuery({ queryKey: key, queryFn: () => opinionService.list(structureId) });
  // copie locale : la saisie est enregistrée à la perte du focus
  const [local, setLocal] = useState<Opinion[]>([]);
  const [creating, setCreating] = useState<1 | 2 | null>(null);
  const [text, setText] = useState("");
  useEffect(() => setLocal(list.data ?? []), [list.data]);
  const reload = () => qc.invalidateQueries({ queryKey: key });

  const update = async (o: Opinion) => {
    // libellé vide : rien n'est enregistré et l'ancien texte revient
    if (!canSaveOpinion(o.libelle)) return reload();
    const before = (list.data ?? []).find((x) => x.id === o.id);
    if (before && before.libelle === o.libelle && before.active === o.active) return;
    try {
      await opinionService.update(opinionUpdatePath(o));
      await reload();
    } catch {
      notify(false, tr("viescolaire.conference.opinions.service.save.error", "Un problème a eu lieu durant l'enregistrement de l'avis"));
      await reload();
    }
  };

  const remove = async (o: Opinion) => {
    try {
      await opinionService.remove(o.id);
    } catch {
      notify(false, tr("viescolaire.conference.opinions.service.delete.error", "Un problème a eu lieu durant la suppression de l'avis"));
    }
    await reload();
  };

  const add = async () => {
    if (!creating) return;
    if (!canSaveOpinion(text)) return notify(false, tr("viescolaire.conference.opinions.service.not.empty", "Vous ne pouvez pas saisir d'avis vide"));
    try {
      await opinionService.create({ libelle: text, type_avis: creating, id_etablissement: structureId });
    } catch {
      notify(false, tr("evaluations.avis.conseil.bilan.periodique.save.error", "Une erreur est survenue lors de l'enregistrement de l'avis"));
    }
    setCreating(null);
    setText("");
    await reload();
  };

  const block = (type: 1 | 2, title: string, addLabel: string) => (
    <section className="mb-24" data-vsco-comp-opinions-type={type}>
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-8 mb-8">
        <h3 className="h5 mb-0">{title}</h3>
        <Button type="button" color="primary" onClick={() => setCreating(type)} data-vsco-comp-opinion-add={type}>
          {addLabel}
        </Button>
      </div>
      <ul className="list-unstyled">
        {opinionsOfType(local, type).map((o) => {
          const ro = isReadOnlyOpinion(o);
          return (
            <li key={o.id} className="d-flex align-items-center gap-8 mb-8" data-vsco-comp-opinion={o.libelle}>
              {!ro && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  aria-pressed={o.active}
                  title={o.active ? tr("evaluations.show.avis", "Avis affiché") : tr("evaluations.hide.avis", "Avis masqué")}
                  onClick={() => update({ ...o, active: !o.active })}
                  data-vsco-comp-opinion-eye
                >
                  {o.active ? "👁" : "🚫"}
                </button>
              )}
              <input
                className="form-control"
                aria-label={`${title} : ${o.libelle}`}
                value={o.libelle}
                disabled={ro}
                onChange={(e) => setLocal(local.map((x) => (x.id === o.id ? { ...x, libelle: e.target.value } : x)))}
                onBlur={() => update(o)}
                data-vsco-comp-opinion-input
              />
              {!ro && (
                <button type="button" className="btn btn-sm btn-outline-danger" title={tr("evaluations.remplacement.delete", "Supprimer")} aria-label={`${tr("evaluations.remplacement.delete", "Supprimer")} ${o.libelle}`} onClick={() => remove(o)} data-vsco-comp-opinion-delete>
                  🗑
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );

  return (
    <div data-vsco-comp-opinions>
      {list.isLoading && <p className="text-muted">{tr("viescolaire.loading", "Chargement…")}</p>}
      {list.isError && (
        <p className="text-danger" role="alert">
          {tr("evaluations.elements.get.error", "Une erreur est survenue lors de la récupération des éléments")}
        </p>
      )}
      {block(1, tr("evaluations.evaluation.avis.conseil", "Avis conseil"), tr("viescolaire.conference.opinions.class.create", "Créer un avis conseil"))}
      {block(2, tr("evaluations.evaluation.avis.orientation", "Avis orientation"), tr("viescolaire.conference.opinions.orientation.create", "Créer un avis orientation"))}

      <Modal id="vsco-comp-opinion-create" isOpen={!!creating} onModalClose={() => { setCreating(null); setText(""); }} size="md">
        <Modal.Header onModalClose={() => { setCreating(null); setText(""); }}>{tr("viescolaire.utils.avis", "Avis")}</Modal.Header>
        <Modal.Body>
          <input
            autoFocus
            className="form-control"
            maxLength={MAX_OPINION}
            aria-label={tr("evaluations.evaluation.avis.personalize", "Personnaliser un avis")}
            placeholder={tr("evaluations.evaluation.avis.personalize", "Personnaliser un avis")}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            data-vsco-comp-opinion-text
          />
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" color="tertiary" variant="ghost" onClick={() => { setCreating(null); setText(""); }}>
            {tr("competences.cancel", "Annuler")}
          </Button>
          <Button type="button" color="primary" onClick={add} data-vsco-comp-opinion-save>
            {tr("viescolaire.utils.save", "Enregistrer")}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};
