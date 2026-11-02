import { Button, Modal } from "@open-ent/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Finder } from "../components/Finder";
import { useStructure } from "../components/StructureContext";
import { Failure, Found, foundLabel, groupByClass, reportTitle, Student, studentsQuery, useEntAvatars, visibleReports } from "../lib/trombinoscope";
import { trombinoscopeService } from "../services/settings.service";

const NO_AVATAR = "/assets/themes/edifice-bootstrap/img/illustrations/no-avatar.svg";

/** Photo d'un élève : aperçu, remplacement par un fichier image, suppression avec confirmation. */
const StudentCard = ({ student, structureId, onRemove, onChanged }: { student: Student; structureId: string; onRemove: () => void; onChanged: () => void }) => {
  const { t } = useTranslation("viescolaire");
  const input = useRef<HTMLInputElement>(null);
  const [stamp, setStamp] = useState(0);
  const src = `/viescolaire/structures/${structureId}/students/${student.id}/picture${stamp ? `?timestamp=${stamp}` : ""}`;
  return (
    <div className="card p-8 text-center" style={{ width: 150 }} data-vsco-student={student.displayName}>
      <img src={src} alt="" width={110} height={110} style={{ objectFit: "cover", borderRadius: 8 }} onError={(e) => { (e.target as HTMLImageElement).src = NO_AVATAR; }} data-vsco-student-img />
      <div className="small mt-4" style={{ minHeight: 40 }}>
        {student.displayName}
      </div>
      <div className="d-flex gap-4 justify-content-center">
        <button type="button" className="btn btn-sm btn-secondary" onClick={() => input.current?.click()} data-vsco-student-edit>
          {t("viescolaire.trombinoscope.param.student.list.edit", { defaultValue: "Modifier" })}
        </button>
        <button type="button" className="btn btn-sm btn-outline-danger" aria-label={`Supprimer la photo de ${student.displayName}`} onClick={onRemove} data-vsco-student-remove>
          ×
        </button>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          await trombinoscopeService.replacePicture(structureId, student.id, f).catch(() => undefined);
          setStamp(Date.now());
          e.target.value = "";
          onChanged();
        }}
        data-vsco-student-file
      />
    </div>
  );
};

/** Trombinoscope : réglage des avatars, import d'une archive de photos, rapports, photos à rapprocher et liste des élèves. */
export const Trombinoscope = () => {
  const { t } = useTranslation("viescolaire");
  const structure = useStructure();
  const qc = useQueryClient();
  const id = structure.id;
  const tr = (k: string, d: string) => t(k, { defaultValue: d });
  const [view, setView] = useState<"import" | "students">("import");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  // ----- réglage et import
  const settings = useQuery({ queryKey: ["trombiSettings", id], queryFn: () => trombinoscopeService.settings(id) });
  const reports = useQuery({ queryKey: ["trombiReports", id], queryFn: () => trombinoscopeService.reports(id) });
  const failures = useQuery({ queryKey: ["trombiFailures", id], queryFn: () => trombinoscopeService.failures(id) });
  const [allReports, setAllReports] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const zip = useRef<HTMLInputElement>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const entAvatars = useEntAvatars(settings.data ?? false);

  const upload = async () => {
    if (!zipFile) return;
    try {
      const res = await trombinoscopeService.importZip(id, zipFile);
      if (res.ok) setMessage({ ok: true, text: tr("viescolaire.trombinoscope.import.zip.confirm", "L'import du fichier .zip s'est déroulé avec succès.") });
      else if (res.status === 413) setMessage({ ok: false, text: tr("viescolaire.trombinoscope.import.zip.memory.issue", "Le fichier que vous tentez de télécharger est trop volumineux") });
      else if (res.status === 401) setMessage({ ok: false, text: tr("evaluation.error.unautorize", "Vous n'avez pas les droits nécessaires") });
      else setMessage({ ok: false, text: tr("viescolaire.trombinoscope.import.zip.error", "Une erreur a été rencontrée lors de l'import du fichier .zip. Plus d'informations dans le rapport généré.") });
    } catch {
      setMessage({ ok: false, text: tr("viescolaire.trombinoscope.import.zip.error", "Une erreur a été rencontrée lors de l'import du fichier .zip.") });
    }
    setZipFile(null);
    await Promise.all([qc.invalidateQueries({ queryKey: ["trombiReports", id] }), qc.invalidateQueries({ queryKey: ["trombiFailures", id] })]);
  };
  const linkFailure = async (f: Failure, s: Found) => {
    try {
      await trombinoscopeService.link(id, s.id, f.pictureId);
      setMessage({ ok: true, text: tr("viescolaire.trombinoscope.student.picture.link.confirm", "Photo liée à l'élève sélectionné avec succès.") });
    } catch {
      setMessage({ ok: false, text: tr("viescolaire.trombinoscope.student.picture.link.error", "Erreur lors de la liaison de la photo.") });
    }
    await qc.invalidateQueries({ queryKey: ["trombiFailures", id] });
  };

  // ----- liste des élèves
  const [pickedStudents, setPickedStudents] = useState<Found[]>([]);
  const [pickedGroups, setPickedGroups] = useState<Found[]>([]);
  const [page, setPage] = useState(0);
  const [extra, setExtra] = useState<Student[]>([]);
  const [noMore, setNoMore] = useState(false);
  const [toRemove, setToRemove] = useState<Student | null>(null);
  const filterKey = [pickedStudents.map((s) => s.id).join(","), pickedGroups.map((g) => g.name ?? g.displayName ?? "").join(",")];
  const students = useQuery({
    queryKey: ["trombiStudents", id, ...filterKey],
    enabled: view === "students",
    queryFn: () => trombinoscopeService.students(id, studentsQuery(0, pickedStudents.map((s) => s.id), pickedGroups.map((g) => g.name ?? g.displayName ?? ""))),
  });
  const all = [...(students.data ?? []), ...extra];
  const groupsShown = groupByClass(all);
  const resetList = () => { setPage(0); setExtra([]); setNoMore(false); };
  const more = async () => {
    const next = page + 1;
    const list = await trombinoscopeService.students(id, studentsQuery(next, pickedStudents.map((s) => s.id), pickedGroups.map((g) => g.name ?? g.displayName ?? "")));
    if (list.length === 0) setNoMore(true);
    else { setExtra([...extra, ...list]); setPage(next); }
  };
  const removePicture = async () => {
    const s = toRemove;
    setToRemove(null);
    if (!s) return;
    try {
      await trombinoscopeService.removePicture(id, s.id);
      setMessage({ ok: true, text: tr("viescolaire.trombinoscope.param.photo.deleted", "La photo a bien été supprimée") });
      await qc.invalidateQueries({ queryKey: ["trombiStudents", id] });
    } catch {
      setMessage({ ok: false, text: tr("viescolaire.trombinoscope.param.photo.delete.error", "Une erreur est survenue lors de la suppression de la photo") });
    }
  };

  return (
    <section data-vsco-trombinoscope>
      <h2 className="h4 mb-16">{tr("viescolaire.trombinoscope", "Trombinoscope")}</h2>
      {message && (
        <p className={message.ok ? "text-success" : "text-danger"} role={message.ok ? "status" : "alert"} data-vsco-message>
          {message.text}
        </p>
      )}

      {view === "import" && (
        <div data-vsco-trombi-import>
          <div className="d-flex align-items-center gap-16 flex-wrap mb-16">
            <label className="d-flex align-items-center gap-8 mb-0">
              <input
                type="checkbox"
                checked={entAvatars}
                onChange={async (e) => {
                  await trombinoscopeService.setSettings(id, !e.target.checked).catch(() => undefined);
                  await qc.invalidateQueries({ queryKey: ["trombiSettings", id] });
                }}
                data-vsco-trombi-avatar
              />
              {tr("viescolaire.trombinoscope.param.use.avatar", "Utiliser les avatars des élèves provenant de leur profil ENT")}
            </label>
            <Button type="button" color="primary" onClick={() => { resetList(); setView("students"); }} data-vsco-trombi-access>
              {tr("viescolaire.trombinoscope.access", "Accéder au trombinoscope")}
            </Button>
          </div>

          {!entAvatars && (
            <>
              <h3 className="h6">{tr("viescolaire.trombinoscope.param.import.rules.title", "Règles d'importation")}</h3>
              <ul>
                <li>{tr("viescolaire.trombinoscope.param.import.rule.1", "une archive comportant un dossier par classe avec la nomenclature présente dans l'ENT")}</li>
                <li>{tr("viescolaire.trombinoscope.param.import.rule.2", "des fichiers images (jpg, png, jpeg, bmp) nommés soit en NOM Prénom soit en nom.prenom (Sans accent)")}</li>
              </ul>
              <div className="d-flex gap-8 align-items-center mb-16">
                <input ref={zip} type="file" accept=".zip" className="form-control" style={{ maxWidth: 360 }} onChange={(e) => setZipFile(e.target.files?.[0] ?? null)} aria-label="Archive de photos" data-vsco-trombi-zip />
                <Button type="button" color="primary" disabled={!zipFile} onClick={upload} data-vsco-trombi-send>
                  {tr("viescolaire.trombinoscope.param.send.file", "Envoyer le fichier")}
                </Button>
              </div>

              {(reports.data ?? []).length > 0 && (
                <div className="mb-16" data-vsco-trombi-reports>
                  <h3 className="h6">{tr("viescolaire.trombinoscope.param.report.list", "Liste des rapports d'importation")}</h3>
                  <ul className="list-unstyled">
                    {visibleReports(reports.data ?? [], allReports).map((r, i) => (
                      <li key={i}>
                        <button type="button" className="btn btn-link p-0" onClick={() => setReport(r.content)} data-vsco-trombi-report>
                          {reportTitle(r, tr("viescolaire.trombinoscope.param.report.import.from", "Import du "), tr("viescolaire.trombinoscope.param.report.import.to", " à "))}
                        </button>
                      </li>
                    ))}
                  </ul>
                  {(reports.data ?? []).length > 5 && (
                    <button type="button" className="btn btn-sm btn-secondary" onClick={() => setAllReports(!allReports)}>
                      {allReports ? tr("viescolaire.trombinoscope.param.report.see.less", "Voir moins") : tr("viescolaire.trombinoscope.param.report.see.more", "Voir plus")}
                    </button>
                  )}
                </div>
              )}

              {(failures.data ?? []).length > 0 && (
                <div data-vsco-trombi-failures>
                  <h3 className="h6">
                    {tr("viescolaire.trombinoscope.param.photo.failure.list", "Photos à rapprocher d'un élève")} ({failures.data?.length})
                  </h3>
                  <Button
                    type="button"
                    color="secondary"
                    onClick={async () => {
                      try {
                        await trombinoscopeService.clearFailures(id);
                        setMessage({ ok: true, text: tr("viescolaire.trombinoscope.param.photo.failure.delete.success", "Suppression de la liste des photos effectuée avec succès") });
                      } catch {
                        setMessage({ ok: false, text: tr("viescolaire.trombinoscope.param.photo.failure.delete.error", "Une erreur est survenue lors de la suppression de la liste des photos") });
                      }
                      await qc.invalidateQueries({ queryKey: ["trombiFailures", id] });
                    }}
                    data-vsco-trombi-clear
                  >
                    {tr("viescolaire.trombinoscope.param.photo.failure.delete.button", "Supprimer la liste des erreurs")}
                  </Button>
                  {(failures.data ?? []).map((f) => (
                    <div key={f.id} className="d-flex gap-16 align-items-start my-12" data-vsco-trombi-failure>
                      <img src={`/viescolaire/structures/${f.structureId}/trombinoscope/failures/${f.id}`} alt="" width={90} height={90} style={{ objectFit: "cover" }} />
                      <div>
                        <div>
                          <strong>{tr("viescolaire.trombinoscope.param.photo.failure.name", "Nom du dossier et du fichier :")}</strong> {f.path}
                        </div>
                        <Finder label="" attr={`fail-${f.id}`} placeholder={tr("viescolaire.trombinoscope.param.search.student", "Rechercher un élève")} search={(q) => trombinoscopeService.searchStudents(id, q)} onPick={(s) => linkFailure(f, s)} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {view === "students" && (
        <div data-vsco-trombi-students>
          <div className="d-flex gap-16 flex-wrap align-items-end mb-12">
            <Button type="button" color="secondary" onClick={() => setView("import")} data-vsco-trombi-back>
              {tr("viescolaire.trombinoscope.back", "Retour au paramétrage")}
            </Button>
            <Finder label={tr("viescolaire.trombinoscope.param.search.student", "Rechercher un élève")} attr="student" placeholder="" search={(q) => trombinoscopeService.searchStudents(id, q)} onPick={(f) => { setPickedStudents([...pickedStudents.filter((x) => x.id !== f.id), f]); resetList(); }} />
            <Finder label={tr("viescolaire.trombinoscope.param.search.group", "Rechercher une classe")} attr="group" placeholder="" search={(q) => trombinoscopeService.searchGroups(id, q)} onPick={(f) => { setPickedGroups([...pickedGroups.filter((x) => x.id !== f.id), f]); resetList(); }} />
          </div>
          <div className="d-flex gap-8 flex-wrap mb-12" data-vsco-trombi-chips>
            {[...pickedStudents.map((f) => ({ f, kind: "s" as const })), ...pickedGroups.map((f) => ({ f, kind: "g" as const }))].map(({ f, kind }) => (
              <button key={`${kind}${f.id}`} type="button" className="btn btn-sm btn-secondary" onClick={() => { if (kind === "s") setPickedStudents(pickedStudents.filter((x) => x.id !== f.id)); else setPickedGroups(pickedGroups.filter((x) => x.id !== f.id)); resetList(); }} aria-label={`Retirer ${foundLabel(f)}`}>
                {foundLabel(f)} ×
              </button>
            ))}
          </div>
          <h3 className="h5">
            {tr("viescolaire.trombinoscope.param.student.list.title", "Trombinoscope des élèves de ")} {structure.name}
          </h3>
          {students.isLoading && <p>{tr("viescolaire.loading", "Chargement…")}</p>}
          {groupsShown.map((g) => (
            <div key={g.name} className="mb-16" data-vsco-trombi-group={g.name}>
              <h4 className="h6">{g.name}</h4>
              <div className="d-flex gap-12 flex-wrap">
                {g.students.map((s) => (
                  <StudentCard key={s.id} student={s} structureId={id} onRemove={() => setToRemove(s)} onChanged={() => undefined} />
                ))}
              </div>
            </div>
          ))}
          {!students.isLoading && all.length === 0 && <p className="text-muted">{tr("viescolaire.trombinoscope.none", "Aucun élève.")}</p>}
          {all.length > 0 && !noMore && (
            <Button type="button" color="secondary" onClick={more} data-vsco-trombi-more>
              {tr("viescolaire.trombinoscope.param.report.see.more", "Voir plus")}
            </Button>
          )}
        </div>
      )}

      <Modal id="vsco-trombi-report" isOpen={report !== null} onModalClose={() => setReport(null)} size="lg" scrollable>
        <Modal.Header onModalClose={() => setReport(null)}>{tr("viescolaire.trombinoscope.param.report.list", "Rapport d'importation")}</Modal.Header>
        <Modal.Body>
          <pre style={{ whiteSpace: "pre-wrap" }}>{report}</pre>
        </Modal.Body>
      </Modal>

      <Modal id="vsco-trombi-remove" isOpen={!!toRemove} onModalClose={() => setToRemove(null)}>
        <Modal.Header onModalClose={() => setToRemove(null)}>{toRemove?.displayName}</Modal.Header>
        <Modal.Body>
          <p>{tr("viescolaire.trombinoscope.student.picture.delete.warning", "Êtes-vous sûr de bien vouloir supprimer l'image ? En la supprimant, elle sera remplacée par l'image par défaut.")}</p>
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" color="tertiary" variant="ghost" onClick={() => setToRemove(null)}>
            {tr("viescolaire.utils.cancel", "Annuler")}
          </Button>
          <Button type="button" color="danger" onClick={removePicture} data-vsco-student-remove-confirm>
            {tr("viescolaire.utils.delete", "Supprimer")}
          </Button>
        </Modal.Footer>
      </Modal>
    </section>
  );
};
