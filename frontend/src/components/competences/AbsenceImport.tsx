import { Button } from "@open-ent/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { formatSize, importOutcome, ImportResult, sortPeriodTypes, syncCheckboxHidden, syncChecked } from "../../lib/competencesMisc";
import { absenceImportService } from "../../services/competences.service";
import { SectionProps, useCompT } from "./shared";

const FAMILY_LABEL: Record<number, string> = { 1: "Année", 2: "Semestre", 3: "Trimestre" };

interface Homonyme {
  filename: string;
  eleves: NonNullable<ImportResult["homonymes"]>;
}

/** Import des retards et absences : fichier CSV d'une période, ou récupération automatique depuis Présences. */
export const AbsenceImport = ({ structureId, notify }: SectionProps) => {
  const tr = useCompT();
  const types = useQuery({ queryKey: ["comp-period-types"], queryFn: absenceImportService.periodTypes, staleTime: 5 * 60_000 });
  const state = useQuery({ queryKey: ["comp-import-state", structureId], queryFn: () => absenceImportService.state(structureId) });
  const [fromPresences, setFromPresences] = useState(false);
  const [period, setPeriod] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Array<{ ok: boolean; text: string }>>([]);
  const [homonymes, setHomonymes] = useState<Homonyme[]>([]);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.data) setFromPresences(syncChecked(state.data));
  }, [state.data]);

  const hidden = !state.data || syncCheckboxHidden(state.data);
  const periodLabel = (id: number) => {
    const p = (types.data ?? []).find((x) => x.id === id);
    return p ? `${tr(`viescolaire.periode.${p.type}`, FAMILY_LABEL[p.type] ?? `Période ${p.type}`)} ${p.ordre}` : "";
  };

  const changeSync = async (checked: boolean) => {
    setFromPresences(checked);
    try {
      await absenceImportService.setSync(structureId, checked);
    } catch {
      setFromPresences(!checked);
      notify(false, tr("viescolaire.import.sync.error", "Erreur lors de l'enregistrement du réglage"));
    }
  };

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    setFiles((f) => [...f, ...Array.from(list).filter((n) => !f.some((x) => x.name === n.name && x.size === n.size))]);
    if (input.current) input.current.value = "";
  };

  const run = async () => {
    if (!period) return notify(false, tr("please.set.periode", "La période est obligatoire"));
    setBusy(true);
    setHomonymes([]);
    const out: Array<{ ok: boolean; text: string }> = [];
    const homo: Homonyme[] = [];
    const done: File[] = [];
    for (const file of files) {
      try {
        const r = await absenceImportService.upload(Number(period), structureId, file);
        const name = r.filename ?? file.name;
        if (r.homonymes && r.homonymes.length > 0) homo.push({ filename: name, eleves: r.homonymes });
        const o = importOutcome(r);
        if (o.kind === "error") out.push({ ok: false, text: `${name} : ${tr("import.csv.error", "Erreur technique lors de l'import csv du fichier")}` });
        else if (o.kind === "invalid") out.push({ ok: false, text: `${name} : ${tr("import.csv.error.invalid", "Désolé, le format du fichier csv que vous avez fourni ne correspond pas au format attendu.")}` });
        else {
          out.push({ ok: true, text: `${name} : ${tr("import.csv.success", "Vous venez d'importer les retards et absences de ")}${o.inserted}${tr("import.students", " élève(s), ")}${o.skipped > 0 ? `${o.skipped}${tr("import.user.not.insert", " utilisateur(s) n'ont pas pu être inséré(s).")}` : ""}` });
          done.push(file);
        }
      } catch {
        out.push({ ok: false, text: `${file.name} : ${tr("import.csv.error", "Erreur technique lors de l'import csv du fichier")}` });
      }
    }
    setResults(out);
    setHomonymes(homo);
    setFiles((f) => f.filter((x) => !done.includes(x)));
    setBusy(false);
  };

  return (
    <div data-vsco-comp-import>
      <h3 className="h5 mb-12">{tr("viescolaire.param.absence.retard", "Imports retards et absences")}</h3>
      {busy && (
        <p role="status" data-vsco-comp-import-loader>
          {tr("importation.in.process", "Import en cours...")}
        </p>
      )}
      {!hidden && (
        <div className="form-check mb-16">
          <input id="vsco-comp-import-sync" type="checkbox" className="form-check-input" checked={fromPresences} onChange={(e) => changeSync(e.target.checked)} data-vsco-comp-import-sync />
          <label htmlFor="vsco-comp-import-sync" className="form-check-label">
            {tr("activated.data.recuperation.from.presences", "Récupérer les données de l'application Présences pour le conseil de classe et le bulletin")}
          </label>
        </div>
      )}
      {!fromPresences && (
        <article className="card p-16" data-vsco-comp-import-form>
          <div className="mb-12">
            <label htmlFor="vsco-comp-import-period" className="form-label fw-bold">
              {tr("viescolaire.utils.periode", "Période")} *
            </label>
            <select id="vsco-comp-import-period" className="form-select" style={{ maxWidth: 320 }} value={period} onChange={(e) => setPeriod(e.target.value)} data-vsco-comp-import-period>
              <option value="" disabled>
                {tr("viescolaire.utils.periode", "Période")}
              </option>
              {sortPeriodTypes(types.data ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {periodLabel(p.id)}
                </option>
              ))}
            </select>
          </div>
          <div
            className="border rounded p-16 mb-12"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              addFiles(e.dataTransfer.files);
            }}
            data-vsco-comp-import-drop
          >
            <label htmlFor="vsco-comp-import-file" className="form-label fw-bold">
              {tr("import.add.file", "Ajouter un fichier")}
            </label>
            <input id="vsco-comp-import-file" ref={input} type="file" multiple className="form-control" accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" onChange={(e) => addFiles(e.target.files)} data-vsco-comp-import-file />
            <p className="text-muted small mb-0 mt-4">
              {tr("format.attachment", "format accepté")} : .csv - {tr("taille.max.attachment", "taille maximale acceptée")} : 3 Mo
            </p>
          </div>

          {homonymes.length > 0 ? (
            <section data-vsco-comp-import-homonymes>
              <p className="fw-bold mb-4">{tr("import.homonyme.detected", "HOMONYMES DETECTÉS")}</p>
              <p>{tr("import.homonyme.message", " Les retards et absences des élèves suivants n'ont pas été insérés car des homonymes ont été détectés : ")}</p>
              {homonymes.map((h) => (
                <article key={h.filename} className="mb-8">
                  <p className="mb-4">
                    {tr("in.file", "Dans le fichier ")} <b>{h.filename}</b>
                  </p>
                  <ul>
                    {h.eleves.map((e, i) => (
                      <li key={i}>
                        {e.firstName} {e.lastName}, {tr("viescolaire.utils.classes", "classes")} {e.classesName}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
              <Button type="button" color="primary" onClick={() => setHomonymes([])} data-vsco-comp-import-homonymes-ok>
                {tr("evaluations.devoir.ok", "Ok")}
              </Button>
            </section>
          ) : (
            <>
              {files.length > 0 && (
                <section>
                  <h4 className="h6">{tr("import.list.of.files", "Liste des fichiers")}</h4>
                  <table className="table" data-vsco-comp-import-files>
                    <tbody>
                      {files.map((f) => (
                        <tr key={`${f.name}-${f.size}`}>
                          <td>{f.name}</td>
                          <td>{formatSize(f.size)}</td>
                          <td className="text-end">
                            <button type="button" className="btn btn-sm btn-outline-secondary" aria-label={`${tr("evaluations.remplacement.delete", "Supprimer")} ${f.name}`} onClick={() => setFiles(files.filter((x) => x !== f))} data-vsco-comp-import-remove>
                              ×
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              )}
              <div className="d-flex justify-content-end">
                <Button type="button" color="primary" disabled={files.length === 0 || busy} onClick={run} data-vsco-comp-import-run>
                  {tr("import.file", "Importer")}
                </Button>
              </div>
            </>
          )}
          {results.map((r, i) => (
            <p key={i} className={r.ok ? "text-success mb-0" : "text-danger mb-0"} role={r.ok ? "status" : "alert"} data-vsco-comp-import-result>
              {r.text}
            </p>
          ))}
        </article>
      )}
    </div>
  );
};
