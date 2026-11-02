import { Button, Modal } from "@open-ent/react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { addableMatieres, defaultSubTopic, initialSelection, keepLabel, needsConfirmation, relationsPayload } from "../lib/subtopics";
import { Matiere, SubTopic } from "../lib/services";
import { subTopicService } from "../services/settings.service";

/** Rattache des sous-matières (latin, grec…) à une ou plusieurs matières ; permet d'en créer et de renommer. */
export const SubTopicsModal = ({
  matiereId, matieres, subTopics, structureId, onClose, onDone,
}: {
  matiereId: string | null;
  matieres: Matiere[];
  subTopics: SubTopic[];
  structureId: string;
  onClose: () => void;
  onDone: (ok: boolean, text: string) => void;
}) => {
  const { t } = useTranslation("viescolaire");
  const tr = (k: string, d: string) => t(k, { defaultValue: d });
  const [list, setList] = useState<SubTopic[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [current, setCurrent] = useState<string[]>([]);
  const [checked, setChecked] = useState<string[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<{ id: number; label: string; previous: string } | null>(null);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (!matiereId) return;
    const m = matieres.find((x) => x.id === matiereId);
    setList(subTopics);
    setSelected(initialSelection(m, subTopics));
    setCurrent([matiereId]);
    setChecked([matiereId]);
    setCreating(false);
    setNewLabel("");
    setEditing(null);
    setConfirm(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matiereId]);

  if (!matiereId) return null;
  const byId = new Map(matieres.map((m) => [m.id, m]));
  const toConfirm = needsConfirmation(matieres, checked, selected);

  const commitEdit = async () => {
    if (!editing) return;
    const label = keepLabel(editing.label, editing.previous);
    setEditing(null);
    setList(list.map((s) => (s.id === editing.id ? { ...s, libelle: label } : s)));
    if (label !== editing.previous) await subTopicService.update(editing.id, structureId, label).catch(() => undefined);
  };
  const createOne = async () => {
    const label = newLabel.trim();
    setCreating(false);
    setNewLabel("");
    if (!label) return;
    try {
      const res = await subTopicService.create(structureId, label);
      const created = { id: res.id, libelle: label, id_structure: structureId };
      setList([...list, created]);
      setSelected([...selected, created.id]);
    } catch {
      onDone(false, tr("viesco.subTopic.creation.error", "Une erreur est survenue lors de la création de la sous-matière"));
    }
  };
  const save = async () => {
    try {
      await subTopicService.relations(relationsPayload(checked, selected));
      onDone(true, tr("viesco.subTopic.creation.confirm", "Les sous-matières ont bien été enregistrées"));
    } catch {
      onDone(false, tr("viesco.subTopic.relation.creation.error", "Une erreur est survenue lors de l'enregistrement des sous-matières"));
    }
  };

  return (
    <>
      <Modal id="vsco-subtopics" isOpen={!confirm} onModalClose={onClose} size="lg" scrollable>
        <Modal.Header onModalClose={onClose}>{tr("evaluation.service.lightboxes.subEducation.create", "Sous-enseignements")}</Modal.Header>
        <Modal.Body>
          <h3 className="h6">{tr("evaluation.service.lightboxes.subEducation.select", "Sous-matières à rattacher")}</h3>
          <ul className="list-unstyled" data-vsco-sub-list>
            {list.map((s) => (
              <li key={s.id} className="d-flex align-items-center gap-8 mb-4">
                <input type="checkbox" checked={selected.includes(s.id)} onChange={() => setSelected(selected.includes(s.id) ? selected.filter((x) => x !== s.id) : [...selected, s.id])} aria-label={s.libelle} data-vsco-sub-check={s.libelle} />
                {editing?.id === s.id ? (
                  <input className="form-control" style={{ maxWidth: 260 }} value={editing.label} autoFocus onChange={(e) => setEditing({ ...editing, label: e.target.value })} onBlur={commitEdit} onKeyDown={(e) => e.key === "Enter" && commitEdit()} data-vsco-sub-edit-input />
                ) : (
                  <>
                    <span>{s.libelle}</span>
                    <button type="button" className="btn btn-link p-0" aria-label={`Renommer ${s.libelle}`} onClick={() => setEditing({ id: s.id, label: s.libelle, previous: s.libelle })} data-vsco-sub-rename>
                      ✎
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
          {creating ? (
            <div className="d-flex gap-8 mb-16">
              <input className="form-control" style={{ maxWidth: 260 }} placeholder={tr("evaluation.service.lightboxes.subEducation.placeholder", "Nom de la sous-matière")} value={newLabel} onChange={(e) => setNewLabel(e.target.value)} data-vsco-sub-new-input />
              <Button type="button" color="primary" onClick={createOne} data-vsco-sub-new-save>
                {tr("viescolaire.utils.save", "Enregistrer")}
              </Button>
            </div>
          ) : (
            <Button type="button" color="secondary" onClick={() => setCreating(true)} data-vsco-sub-new>
              {tr("evaluation.service.lightboxes.subEducation.class.sub.create", "Créer une sous-matière")}
            </Button>
          )}
          <h3 className="h6 mt-16">{tr("evaluation.service.lightboxes.subEducation.choice", "Matières concernées")}</h3>
          <ul className="list-unstyled">
            {current.map((id) => (
              <li key={id}>
                <label>
                  <input type="checkbox" checked={checked.includes(id)} onChange={() => setChecked(checked.includes(id) ? checked.filter((x) => x !== id) : [...checked, id])} data-vsco-sub-matiere={byId.get(id)?.name} /> {byId.get(id)?.name}
                </label>
              </li>
            ))}
          </ul>
          <label htmlFor="vsco-sub-add" className="form-label">
            {tr("evaluation.service.lightboxes.subEducation.add.matiere", "Ajouter une matière")}
          </label>
          <select id="vsco-sub-add" className="form-select" style={{ maxWidth: 360 }} value="" onChange={(e) => e.target.value && (setCurrent([...current, e.target.value]), setChecked([...checked, e.target.value]))} data-vsco-sub-add-matiere>
            <option value="" />
            {addableMatieres(matieres, current).map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" color="tertiary" variant="ghost" onClick={onClose}>
            {tr("viescolaire.utils.cancel", "Annuler")}
          </Button>
          <Button type="button" color="primary" onClick={() => (toConfirm.length > 0 ? setConfirm(true) : save())} data-vsco-sub-save>
            {tr("viescolaire.utils.save", "Enregistrer")}
          </Button>
        </Modal.Footer>
      </Modal>
      <Modal id="vsco-subtopics-confirm" isOpen={confirm} onModalClose={() => setConfirm(false)}>
        <Modal.Header onModalClose={() => setConfirm(false)}>{tr("evaluation.service.lightboxes.subEducation.create", "Sous-enseignements")}</Modal.Header>
        <Modal.Body>
          <p>{tr("viesco.switchEvealuation.message1", "Les matières suivantes n'ont pas encore de sous-matière :")}</p>
          <ul>
            {toConfirm.map((m) => (
              <li key={m.id}>{m.name}</li>
            ))}
          </ul>
          <p>
            {tr("viesco.switchEvealuation.message2", "Leurs évaluations seront rattachées à la sous-matière")} <b>« {defaultSubTopic(list, selected)?.libelle} »</b>
          </p>
          <p>{tr("viesco.switchEvealuation.message3", "Voulez-vous continuer ?")}</p>
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" color="tertiary" variant="ghost" onClick={() => setConfirm(false)} data-vsco-sub-confirm-no>
            {tr("viescolaire.utils.no", "Non")}
          </Button>
          <Button type="button" color="primary" onClick={save} data-vsco-sub-confirm-yes>
            {tr("viescolaire.utils.yes", "Oui")}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};
