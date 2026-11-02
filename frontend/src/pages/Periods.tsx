import { Button, Modal } from "@open-ent/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useStructure } from "../components/StructureContext";
import {
  buildDrafts, byClass, checkDrafts, classesDiffer, currentPeriod, Draft, filterClasses, hasError, periodFamilies, periodName, periodsPayload, sortDrafts, toDrafts,
} from "../lib/periods";
import { toInputDate } from "../lib/schoolYear";
import { periodService, timeSlotService } from "../services/settings.service";

const FAMILY_LABEL: Record<number, string> = { 1: "Année", 2: "Semestre", 3: "Trimestre" };

const fmt = (d?: string) => (d ? new Date(`${toInputDate(d)}T00:00:00`).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }) : "");

/** Périodes des classes : liste filtrable par type, sélection de classes, saisie des dates, publication des bulletins. */
export const Periods = () => {
  const { t } = useTranslation("viescolaire");
  const structure = useStructure();
  const qc = useQueryClient();
  const classesQ = useQuery({ queryKey: ["classes", structure.id], queryFn: () => timeSlotService.classes(structure.id) });
  const periodsQ = useQuery({ queryKey: ["periods", structure.id], queryFn: () => periodService.list(structure.id) });
  const typesQ = useQuery({ queryKey: ["periodTypes"], queryFn: periodService.types, staleTime: Infinity });

  const [family, setFamily] = useState<number | null>(0);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [chosenFamily, setChosenFamily] = useState<number>(0);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [failed, setFailed] = useState(false);

  const types = typesQ.data ?? [];
  const families = periodFamilies(types);
  const periods = useMemo(() => byClass(periodsQ.data ?? []), [periodsQ.data]);
  const classes = classesQ.data ?? [];
  const visible = filterClasses(classes, periods, family, name);
  const selectedClasses = classes.filter((c) => selected.includes(c.id)).sort((a, b) => a.name.localeCompare(b.name));
  const errors = checkDrafts(drafts);
  const label = (f: number) => t(`viescolaire.periode.${f}`, { defaultValue: FAMILY_LABEL[f] ?? String(f) });

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const allVisible = visible.length > 0 && visible.every((c) => selected.includes(c.id));

  const openEditor = () => {
    const first = periods.get(selectedClasses[0]?.id ?? "") ?? [];
    setDrafts(toDrafts(first));
    setChosenFamily(first.length);
    setFailed(false);
    setOpen(true);
  };

  const setField = (i: number, key: keyof Draft, value: string | boolean) => setDrafts((all) => sortDrafts(all.map((d, j) => (j === i ? { ...d, [key]: value } : d))));

  const save = async () => {
    try {
      await periodService.save(periodsPayload(structure.id, selectedClasses.map((c) => c.id), drafts));
      setOpen(false);
      setSelected([]);
      await qc.invalidateQueries({ queryKey: ["periods", structure.id] });
    } catch {
      setFailed(true);
    }
  };

  const publish = async (periodId: number | undefined, value: boolean) => {
    if (periodId === undefined) return;
    await periodService.publish(periodId, value);
    await qc.invalidateQueries({ queryKey: ["periods", structure.id] });
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <section data-vsco-periods>
      <h2 className="h4 mb-16">{t("viescolaire.periode.set", { defaultValue: "Paramétrage des périodes" })}</h2>

      <ul className="nav nav-pills mb-16" role="tablist" data-vsco-period-families>
        {families.map((f) => (
          <li key={f} className="nav-item" role="presentation">
            <button type="button" role="tab" aria-selected={family === f} className={`nav-link${family === f ? " active" : ""}`} onClick={() => { setFamily(f); setSelected([]); }} data-vsco-period-family={f}>
              {label(f)}
            </button>
          </li>
        ))}
        <li className="nav-item" role="presentation">
          <button type="button" role="tab" aria-selected={family === 0} className={`nav-link${family === 0 ? " active" : ""}`} onClick={() => { setFamily(0); setSelected([]); }} data-vsco-period-family="0">
            {t("viescolaire.periode.notset", { defaultValue: "Non initialisées" })}
          </button>
        </li>
      </ul>

      <div className="d-flex gap-16 align-items-end flex-wrap mb-16">
        <div style={{ minWidth: 260 }}>
          <label htmlFor="vsco-period-search" className="form-label">
            {t("viescolaire.viescolaire.rechercheClasse", { defaultValue: "Rechercher une classe" })}
          </label>
          <input id="vsco-period-search" className="form-control" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom de la classe" data-vsco-period-search />
        </div>
        <Button type="button" color="primary" disabled={selectedClasses.length === 0} onClick={openEditor} data-vsco-period-edit>
          {t("viescolaire.periode.edit", { defaultValue: "Modifier les périodes" })}
        </Button>
      </div>

      {(classesQ.isError || periodsQ.isError) && (
        <p className="text-danger" role="alert">
          {t("viescolaire.error.sync", { defaultValue: "Une erreur est survenue lors de la récupération des données." })}
        </p>
      )}
      {visible.length === 0 && !classesQ.isLoading && <p className="text-muted">{t("viescolaire.periode.none", { defaultValue: "Aucune classe." })}</p>}

      {visible.length > 0 && (
        <table className="table" data-vsco-period-table>
          <thead>
            <tr>
              <th>
                <input type="checkbox" checked={allVisible} onChange={() => setSelected(allVisible ? [] : visible.map((c) => c.id))} aria-label="Tout sélectionner" data-vsco-period-all />
              </th>
              <th>{t("viescolaire.utils.class", { defaultValue: "Classe" })}</th>
              <th>{t("viescolaire.utils.periode", { defaultValue: "Période" })}</th>
              <th>{t("viescolaire.utils.datedebut", { defaultValue: "Date de début" })}</th>
              <th>{t("viescolaire.utils.datefin", { defaultValue: "Date de fin" })}</th>
              <th>{t("viescolaire.utils.datefinsaisie", { defaultValue: "Date de fin de saisie" })}</th>
              <th>{t("viescolaire.utils.date.conseil.classe", { defaultValue: "Date conseil de classe" })}</th>
              <th title={t("viescolaire.utils.publication.bulletin.explication", { defaultValue: "une fois cette case cochée aucune saisie ne sera possible pour la période concernée" })}>
                {t("viescolaire.utils.publication.bulletin", { defaultValue: "Visibilité des bulletins aux parents" })}
              </th>
            </tr>
          </thead>
          <tbody>
            {visible.map((c) => {
              const current = currentPeriod(periods.get(c.id) ?? []);
              const n = periodName(current, types);
              return (
                <tr key={c.id} data-vsco-period-row={c.name}>
                  <td>
                    <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggle(c.id)} aria-label={c.name} data-vsco-period-select={c.name} />
                  </td>
                  <td>{c.name}</td>
                  <td>{n ? `${t("viescolaire.periode.encours", { defaultValue: "Actuelle" })} : ${label(n.type)} ${n.ordre}` : ""}</td>
                  <td>{fmt(current?.timestamp_dt)}</td>
                  <td>{fmt(current?.timestamp_fn)}</td>
                  <td>{fmt(current?.date_fin_saisie)}</td>
                  <td>{fmt(current?.date_conseil_classe)}</td>
                  <td>
                    {current && (
                      <input type="checkbox" checked={!!current.publication_bulletin} onChange={(e) => publish(current.id, e.target.checked)} aria-label={`${t("viescolaire.utils.publication.bulletin", { defaultValue: "Visibilité des bulletins aux parents" })} ${c.name}`} data-vsco-period-publish={c.name} />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <Modal id="vsco-period-modal" isOpen={open} onModalClose={() => setOpen(false)} size="lg" scrollable>
        <Modal.Header onModalClose={() => setOpen(false)}>
          {t("viescolaire.parametrage.classes.selected", { defaultValue: "Paramétrage des classes sélectionnées" })} ({selectedClasses.map((c) => c.name).join(", ")})
        </Modal.Header>
        <Modal.Body>
          {classesDiffer(selectedClasses, periods, drafts) && selectedClasses.length > 1 && (
            <p className="text-warning" data-vsco-period-differ>
              {t("viescolaire.differentes.periodes", { defaultValue: "Attention les classes que vous avez sélectionnées n’ont pas les mêmes dates de période." })} {t("viescolaire.dates.premiere.classe", { defaultValue: "Les dates de la première classe ont été chargées." })}
            </p>
          )}
          <fieldset className="mb-16">
            <legend className="fs-6">{t("viescolaire.type.config", { defaultValue: "Type de configuration" })}</legend>
            {families.map((f) => (
              <label key={f} className="me-16">
                <input type="radio" name="vsco-family" checked={chosenFamily === f} onChange={() => { setChosenFamily(f); setDrafts(buildDrafts(f, today)); }} data-vsco-period-type={f} /> {label(f)}
              </label>
            ))}
          </fieldset>
          {drafts.map((d, i) => (
            <div key={i} className="d-flex gap-8 flex-wrap align-items-end mb-8" data-vsco-draft={i}>
              <strong style={{ minWidth: 110 }}>
                {label(chosenFamily)} {i + 1}
              </strong>
              {(
                [["timestamp_dt", "evaluations.remplacement.debut", "Début"], ["timestamp_fn", "evaluations.remplacement.fin", "Fin"], ["date_fin_saisie", "viescolaire.fin.saisie", "Fin de saisie"], ["date_conseil_classe", "viescolaire.utils.date.conseil.classe", "Date conseil de classe"]] as const
              ).map(([key, i18nKey, fallback]) => (
                <div key={key}>
                  <label className="form-label" htmlFor={`vsco-d-${i}-${key}`}>
                    {t(i18nKey, { defaultValue: fallback })}
                  </label>
                  <input id={`vsco-d-${i}-${key}`} type="date" className="form-control" value={d[key]} onChange={(e) => setField(i, key, e.target.value)} data-vsco-draft-field={`${i}:${key}`} />
                </div>
              ))}
              <label className="mb-8">
                <input type="checkbox" checked={d.publication_bulletin} onChange={(e) => setField(i, "publication_bulletin", e.target.checked)} /> {t("viescolaire.utils.publication.bulletin", { defaultValue: "Visibilité des bulletins aux parents" })}
              </label>
            </div>
          ))}
          <div role="alert" data-vsco-period-errors>
            {errors.fn && <p className="text-danger mb-4">{t("viescolaire.dateFin.anterieure.dateDebut", { defaultValue: "La date de fin ne peut être antérieure à la date de début." })}</p>}
            {errors.fnS && <p className="text-danger mb-4">{t("viescolaire.dateFinSaisie.anterieure.dateDebut", { defaultValue: "La date de fin de saisie ne peut être antérieure à la date de début." })}</p>}
            {errors.over && <p className="text-danger mb-4">{t("viescolaire.chevauchement.periodes", { defaultValue: "Les périodes ne doivent pas se chevaucher." })}</p>}
            {errors.contig && <p className="text-danger mb-4">{t("viescolaire.periodes.contigues", { defaultValue: "Les périodes doivent être contigues." })}</p>}
            {failed && <p className="text-danger mb-4">{t("viescolaire.error.sauvegarde", { defaultValue: "Une erreur est survenue lors de la sauvegarde." })}</p>}
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" color="tertiary" variant="ghost" onClick={() => setOpen(false)}>
            {t("viescolaire.utils.cancel", { defaultValue: "Annuler" })}
          </Button>
          <Button type="button" color="primary" disabled={drafts.length === 0 || hasError(errors)} onClick={save} data-vsco-period-save>
            {t("viescolaire.utils.save", { defaultValue: "Enregistrer" })}
          </Button>
        </Modal.Footer>
      </Modal>
    </section>
  );
};
