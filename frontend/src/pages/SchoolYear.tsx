import { Button, Modal } from "@open-ent/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useStructure } from "../components/StructureContext";
import { isValidSchoolYear, schoolYearPayload, toInputDate } from "../lib/schoolYear";
import { settingsService } from "../services/settings.service";

/** Année scolaire de l'établissement : date de début et de fin, avec confirmation avant modification. */
export const SchoolYear = () => {
  const { t } = useTranslation("viescolaire");
  const structure = useStructure();
  const qc = useQueryClient();
  const year = useQuery({ queryKey: ["schoolYear", structure.id], queryFn: () => settingsService.schoolYear(structure.id) });
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const exists = year.data?.id !== undefined;

  useEffect(() => {
    setStart(toInputDate(year.data?.start_date));
    setEnd(toInputDate(year.data?.end_date));
  }, [year.data]);

  const valid = isValidSchoolYear(start, end);
  const save = async () => {
    setConfirm(false);
    try {
      const body = schoolYearPayload(structure.id, start, end, year.data?.id);
      if (exists) await settingsService.updateSchoolYear(year.data?.id as number, body);
      else await settingsService.createSchoolYear(body);
      await qc.invalidateQueries({ queryKey: ["schoolYear", structure.id] });
      setMessage({
        ok: true,
        text: exists
          ? t("viescolaire.modification.periode.annee.scolaire", { defaultValue: "La période de l'année scolaire a bien été modifiée" })
          : t("viescolaire.creation.periode.annee.scolaire", { defaultValue: "La période de l'année scolaire a bien été sauvegardée" }),
      });
    } catch {
      setMessage({ ok: false, text: t("viescolaire.error.sauvegarde", { defaultValue: "Une erreur est survenue lors de la sauvegarde." }) });
    }
  };

  return (
    <section data-vsco-school-year>
      <h2 className="h4 mb-16">{t("viescolaire.utils.annee.scolaire", { defaultValue: "Année scolaire" })}</h2>
      {year.isError && (
        <p className="text-danger" role="alert">
          {t("viescolaire.error.sync", { defaultValue: "Une erreur est survenue lors de la récupération des dates." })}
        </p>
      )}
      {message && (
        <p className={message.ok ? "text-success" : "text-danger"} role={message.ok ? "status" : "alert"} data-vsco-message>
          {message.text}
        </p>
      )}
      <div className="d-flex gap-16 flex-wrap align-items-end mb-16">
        <div>
          <label htmlFor="vsco-year-start" className="form-label">
            {t("viescolaire.utils.datedebut", { defaultValue: "Date de début" })}
          </label>
          <input id="vsco-year-start" type="date" className="form-control" value={start} onChange={(e) => setStart(e.target.value)} data-vsco-year-start />
        </div>
        <div>
          <label htmlFor="vsco-year-end" className="form-label">
            {t("viescolaire.utils.datefin", { defaultValue: "Date de fin" })}
          </label>
          <input id="vsco-year-end" type="date" className="form-control" value={end} onChange={(e) => setEnd(e.target.value)} data-vsco-year-end />
        </div>
        <Button type="button" color="primary" disabled={!valid} onClick={() => (exists ? setConfirm(true) : save())} data-vsco-year-save>
          {exists ? t("item.modify", { defaultValue: "Modifier" }) : t("viescolaire.save", { defaultValue: "Sauvegarder" })}
        </Button>
      </div>
      {!valid && start && end && (
        <p className="text-muted" data-vsco-year-hint>
          {t("viescolaire.year.invalid", { defaultValue: "La date de fin doit suivre la date de début et ne pas être déjà passée." })}
        </p>
      )}
      <Modal id="vsco-year-confirm" isOpen={confirm} onModalClose={() => setConfirm(false)}>
        <Modal.Header onModalClose={() => setConfirm(false)}>{t("viescolaire.year.set", { defaultValue: "Année scolaire" })}</Modal.Header>
        <Modal.Body>
          <p>
            {t("viescolaire.confirmation.updateSchoolYear", {
              defaultValue: "Vous allez changer les dates de l'année scolaire. Des applications pourraient être impactées par ce changement. Voulez-vous continuer ?",
            })}
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" color="tertiary" variant="ghost" onClick={() => setConfirm(false)}>
            {t("viescolaire.utils.cancel", { defaultValue: "Annuler" })}
          </Button>
          <Button type="button" color="primary" onClick={save} data-vsco-year-confirm>
            {t("viescolaire.utils.confirm", { defaultValue: "Confirmer" })}
          </Button>
        </Modal.Footer>
      </Modal>
    </section>
  );
};
