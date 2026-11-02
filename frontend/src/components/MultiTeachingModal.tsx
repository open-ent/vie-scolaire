import { Button, Modal } from "@open-ent/react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { canSave, coTeachingPayload, dateErrors, deleteIds, normalizeDates, substitutePayload } from "../lib/multiteaching";
import { MultiTeaching, Service, Teacher } from "../lib/services";
import { multiTeachingService } from "../services/settings.service";

/** Ajout de co-enseignants ou d'un remplaçant (avec dates) à un service ; modification ou retrait d'un remplaçant existant. */
export const MultiTeachingModal = ({
  service, isCo, existing, structureId, teachers, onClose, onDone,
}: {
  service: Service | null;
  isCo: boolean;
  existing?: MultiTeaching;
  structureId: string;
  teachers: Teacher[];
  onClose: () => void;
  onDone: (ok: boolean, text: string) => void;
}) => {
  const { t } = useTranslation("viescolaire");
  const tr = (k: string, d: string) => t(k, { defaultValue: d });
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const [picked, setPicked] = useState<string[]>([]);
  const [classIds, setClassIds] = useState<string[]>([]);
  const [dates, setDates] = useState({ start: today, end: tomorrow, entered: tomorrow });

  useEffect(() => {
    if (!service) return;
    if (existing) {
      setPicked([existing.second_teacher_id]);
      setClassIds(service.groups.map((g) => g.id));
      setDates({ start: (existing.start_date ?? today).slice(0, 10), end: (existing.end_date ?? tomorrow).slice(0, 10), entered: (existing.entered_end_date ?? tomorrow).slice(0, 10) });
    } else {
      setPicked([]);
      setClassIds([]);
      setDates({ start: today, end: tomorrow, entered: tomorrow });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service, existing]);

  if (!service) return null;
  const candidates = teachers.filter((x) => x.id !== service.id_enseignant && (!isCo || !service.coTeachers.some((c) => c.second_teacher_id === x.id)));
  const name = (id: string) => teachers.find((x) => x.id === id)?.displayName ?? id;
  const valid = canSave(isCo, picked, classIds, dates);
  const errors = dateErrors(dates);
  const setDate = (key: "start" | "end" | "entered", v: string) => setDates(normalizeDates({ ...dates, [key]: v }));

  const save = async () => {
    try {
      if (isCo) await multiTeachingService.create(structureId, coTeachingPayload(service, structureId, picked, classIds));
      else if (existing) await multiTeachingService.update(structureId, substitutePayload(service, structureId, picked[0], classIds, dates, existing));
      else await multiTeachingService.create(structureId, substitutePayload(service, structureId, picked[0], classIds, dates));
      onDone(true, isCo ? tr("evaluation.coteaching.create", "Le co-enseignement a bien été créé") : tr("evaluation.substitute.save", "Le remplacement a bien été enregistré"));
    } catch {
      onDone(false, tr("evaluation.coteaching.create.error", "Une erreur est survenue lors de l'enregistrement"));
    }
  };
  const remove = async () => {
    if (!existing) return;
    try {
      await multiTeachingService.remove(structureId, deleteIds(existing));
      onDone(true, tr("evaluation.coteaching.delete", "Le remplacement a bien été supprimé"));
    } catch {
      onDone(false, tr("evaluation.coteaching.delete.error", "Une erreur est survenue lors de la suppression"));
    }
  };

  return (
    <Modal id="vsco-multiteaching" isOpen onModalClose={onClose} size="lg" scrollable>
      <Modal.Header onModalClose={onClose}>
        {isCo ? tr("evaluation.service.coenseignants", "Co-enseignants") : tr("evaluations.remplacement.remplacant", "Remplaçant")} — {service.topicName}
      </Modal.Header>
      <Modal.Body>
        <p className="mb-8">
          <strong>{tr("evaluations.remplacement.titulaire", "Titulaire")} :</strong> {service.teacherName}
        </p>
        <div className="mb-12">
          <label htmlFor="vsco-mt-teacher" className="form-label">
            {isCo ? tr("evaluation.service.coenseignants", "Co-enseignants") : tr("evaluations.remplacement.remplacant", "Remplaçant")}
          </label>
          <div className="d-flex gap-8 flex-wrap mb-8">
            {isCo && picked.map((id) => (
              <button key={id} type="button" className="btn btn-sm btn-secondary" onClick={() => setPicked(picked.filter((x) => x !== id))} aria-label={`Retirer ${name(id)}`} data-vsco-mt-chip>
                {name(id)} ×
              </button>
            ))}
          </div>
          <select
            id="vsco-mt-teacher"
            className="form-select"
            value={isCo ? "" : (picked[0] ?? "")}
            onChange={(e) => e.target.value && setPicked(isCo ? [...new Set([...picked, e.target.value])] : [e.target.value])}
            data-vsco-mt-teacher
          >
            <option value="">{tr("evaluation.service.columns.teacher", "Enseignant")}</option>
            {[...candidates].sort((a, b) => a.displayName.localeCompare(b.displayName)).map((x) => (
              <option key={x.id} value={x.id}>{x.displayName}</option>
            ))}
          </select>
        </div>
        <div className="mb-12">
          <span className="form-label d-block">{tr("viescolaire.competences.classe.groupe", "Classe / groupe")}</span>
          <div className="d-flex gap-12 flex-wrap">
            {service.groups.map((g) => (
              <label key={g.id}>
                <input type="checkbox" checked={classIds.includes(g.id)} onChange={() => setClassIds(classIds.includes(g.id) ? classIds.filter((x) => x !== g.id) : [...classIds, g.id])} data-vsco-mt-class={g.name} /> {g.name}
              </label>
            ))}
          </div>
        </div>
        {!isCo && (
          <div className="d-flex gap-12 flex-wrap mb-12" data-vsco-mt-dates>
            {(
              [["start", "viescolaire.utils.datedebut", "Date de début"], ["end", "viescolaire.utils.datefin", "Date de fin"], ["entered", "viescolaire.utils.datefinsaisie", "Date de fin de saisie"]] as const
            ).map(([key, i18n, fallback]) => (
              <div key={key}>
                <label className="form-label" htmlFor={`vsco-mt-${key}`}>{tr(i18n, fallback)}</label>
                <input id={`vsco-mt-${key}`} type="date" className="form-control" value={dates[key]} onChange={(e) => setDate(key, e.target.value)} data-vsco-mt-date={key} />
              </div>
            ))}
          </div>
        )}
        {!isCo && errors.startAfterEnd && (
          <p className="text-danger" role="alert" data-vsco-mt-error>
            {tr("viescolaire.dateFin.anterieure.dateDebut", "La date de fin ne peut être antérieure à la date de début.")}
          </p>
        )}
      </Modal.Body>
      <Modal.Footer>
        {existing && !isCo && (
          <Button type="button" color="danger" variant="outline" onClick={remove} data-vsco-mt-delete>
            {tr("viescolaire.utils.delete", "Supprimer")}
          </Button>
        )}
        <Button type="button" color="tertiary" variant="ghost" onClick={onClose}>
          {tr("viescolaire.utils.cancel", "Annuler")}
        </Button>
        <Button type="button" color="primary" disabled={!valid} onClick={save} data-vsco-mt-save>
          {tr("viescolaire.utils.save", "Enregistrer")}
        </Button>
      </Modal.Footer>
    </Modal>
  );
};
