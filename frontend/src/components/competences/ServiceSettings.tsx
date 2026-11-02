import { Button, Modal } from "@open-ent/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  applyWords, classifyWord, Context, DEFAULT_FILTERS, enrich, evaluableState, Filters, filtersQuery, homeworkMessage, homeworkQuery, mainEyeLocked, mergedValues, movedServicePayload, multiEyeLocked,
  MultiTeacher, multiVisibilityPayload, MULTIPLES, nextSortState, Param, paramsPayload, Row, servicePayload, SortKey, sortRows, subTopicPayload, SubTopicRow, switchedOff, validCoefficient,
  withEvaluable, isCurrentSubstitute,
} from "../../lib/competencesServices";
import { competenceServiceService } from "../../services/competences.service";
import { SectionProps, useCompT } from "./shared";

const rowKey = (r: Row) => [r.id_enseignant, r.id_matiere, r.id_groupe].join("|");
const fr = (v?: string) => (v ? v.slice(0, 10).split("-").reverse().join("/") : "");

/** Devoirs à traiter avant de rendre un service non évaluable, et suite à donner une fois la question réglée. */
interface HomeworkDialog {
  row: Row;
  ids: number[];
  done: () => Promise<void>;
}

/** Modalités des services : coefficient, modalité d'enseignement, évaluabilité et visibilité, par classe ou groupe. */
export const ServiceSettings = ({ structureId, notify }: SectionProps) => {
  const tr = useCompT();
  const qc = useQueryClient();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: "topicName", asc: true });
  const [words, setWords] = useState<string[]>([]);
  const [classWords, setClassWords] = useState<string[]>([]);
  const [deployed, setDeployed] = useState<string | null>(null);
  const [coefEdits, setCoefEdits] = useState<Record<string, string>>({});
  const [subEdits, setSubEdits] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<{ row: Row; params: Param[] } | null>(null);
  const [homework, setHomework] = useState<HomeworkDialog | null>(null);
  const [hwAction, setHwAction] = useState<"" | "delete" | "update">("");
  const [hwMatiere, setHwMatiere] = useState("");

  const stat = { staleTime: 60_000 };
  const classes = useQuery({ queryKey: ["comp-svc-classes", structureId], queryFn: () => competenceServiceService.classes(structureId), ...stat });
  const matieres = useQuery({ queryKey: ["comp-svc-matieres", structureId], queryFn: () => competenceServiceService.matieres(structureId), ...stat });
  const teachers = useQuery({ queryKey: ["comp-svc-teachers", structureId], queryFn: () => competenceServiceService.teachers(structureId), ...stat });
  const modalites = useQuery({ queryKey: ["comp-svc-modalites", structureId], queryFn: () => competenceServiceService.modalites(structureId), ...stat });
  const subTypes = useQuery({ queryKey: ["comp-svc-subtypes", structureId], queryFn: () => competenceServiceService.subTopicTypes(structureId), ...stat });
  const stored = useQuery({ queryKey: ["comp-svc-stored", structureId], queryFn: () => competenceServiceService.subTopicStored(structureId), ...stat });
  const servicesKey = ["comp-svc-list", structureId, filtersQuery(filters)];
  const services = useQuery({ queryKey: servicesKey, queryFn: () => competenceServiceService.list(structureId, filtersQuery(filters)) });
  const reload = () => qc.invalidateQueries({ queryKey: ["comp-svc-list", structureId] });

  const ready = [classes, matieres, teachers, modalites, subTypes, stored, services].every((q) => q.isSuccess);
  const rows = useMemo(() => {
    if (!ready) return [];
    const ctx: Context = { structureId, classes: classes.data!, matieres: matieres.data!, teachers: teachers.data!, subTopicTypes: subTypes.data!, subTopicStored: stored.data! };
    return enrich(services.data!, ctx);
  }, [ready, structureId, classes.data, matieres.data, teachers.data, subTypes.data, stored.data, services.data]);
  const shown = useMemo(() => sortRows(applyWords(rows, words, classWords), sort.key, sort.asc), [rows, words, classWords, sort]);
  const today = new Date().toISOString().slice(0, 10);
  const modaliteIds = (modalites.data ?? []).map((m) => m.id);
  const failedLoad = [classes, matieres, teachers, modalites, services].some((q) => q.isError);
  const updateError = tr("evaluation.service.error.update", "Erreur lors de la mise a jour du service.");

  /** Enregistre un service : par classe s'il en a, sinon en une seule ligne. */
  const persist = async (r: Row, params: Param[], force: { modalite?: string; coefficient?: number } = {}, single: Record<string, unknown> = {}) => {
    if (params.length > 0) await competenceServiceService.updateMany(paramsPayload(r, params, force));
    else await competenceServiceService.update({ ...servicePayload(r), ...single });
  };
  const attempt = async (action: () => Promise<void>) => {
    try {
      await action();
    } catch {
      notify(false, updateError);
    }
    await reload();
  };

  const saveCoefficient = (r: Row) => {
    const k = rowKey(r);
    const raw = coefEdits[k];
    setCoefEdits(({ [k]: _drop, ...rest }) => rest);
    const n = raw === undefined ? null : validCoefficient(raw);
    if (n === null) return;
    return attempt(() => persist(r, r.params, { coefficient: n }, { coefficient: n }));
  };
  const saveModalite = (r: Row, modalite: string) => attempt(() => persist(r, r.params, { modalite }, { modalite }));
  const saveSubTopic = (r: Row, s: SubTopicRow) => {
    const k = `${rowKey(r)}|${s.id_subtopic}`;
    const n = validCoefficient(subEdits[k] ?? "");
    setSubEdits(({ [k]: _drop, ...rest }) => rest);
    if (n === null || n === s.coefficient) return;
    return attempt(() => competenceServiceService.saveSubTopic(subTopicPayload({ ...s, coefficient: n }, r.groups)).then(() => qc.invalidateQueries({ queryKey: ["comp-svc-stored", structureId] }).then(() => undefined)));
  };
  const toggleMainEye = (r: Row) => !mainEyeLocked(r, today) && attempt(() => competenceServiceService.update(servicePayload({ ...r, is_visible: !r.is_visible })).then(() => undefined));
  const toggleMultiEye = (r: Row, m: MultiTeacher) => !multiEyeLocked(r, m, today) && attempt(() => competenceServiceService.updateMultiVisibility(structureId, multiVisibilityPayload(m)).then(() => undefined));

  /** Vérifie les devoirs liés avant de passer des classes en « non évaluable » ; `apply` fait l'enregistrement. */
  const withHomeworkCheck = async (r: Row, groupIds: string[] | undefined, apply: () => Promise<void>) => {
    try {
      const found = await competenceServiceService.homework(homeworkQuery(r, groupIds));
      if (found.length === 0) return attempt(apply);
      setHwAction("");
      setHwMatiere("");
      setHomework({ row: r, ids: found.map((d) => d.id), done: apply });
    } catch {
      notify(false, tr("evaluations.service.devoir.error", "Le service sélectionné est utilisé par [nbDevoir] devoir(s). Que souhaitez-vous faire ?"));
    }
  };

  const switchEvaluable = (r: Row) => {
    if (evaluableState(r) !== "all") return attempt(() => persist(r, withEvaluable(r.params, true), {}, { evaluable: true }));
    return withHomeworkCheck(r, undefined, () => persist(r, withEvaluable(r.params, false), {}, { evaluable: false }));
  };

  const confirmHomework = async () => {
    if (!homework) return;
    const { row, ids, done } = homework;
    try {
      if (hwAction === "update") {
        if (!hwMatiere) return notify(false, tr("evaluation.service.choose.a.subject", "Veuillez choisir une matière"));
        if (hwMatiere === row.id_matiere) return notify(false, tr("evaluation.service.choose.another.subject", "Veuillez choisir une matière différente de celle où le service est créé"));
        await competenceServiceService.moveHomework(structureId, { id_devoirs: ids, id_matiere: hwMatiere });
        notify(true, tr("service.homework.update.topic", "Les devoirs ont bien été mis à jour"));
        await competenceServiceService.create(movedServicePayload(row, hwMatiere));
      } else if (hwAction === "delete") {
        await competenceServiceService.deleteHomework(ids);
        notify(true, tr("evaluation.service.delete", "Le service a bien été supprimé"));
      } else return;
      await done();
      setHomework(null);
      setEditing(null);
    } catch {
      notify(false, hwAction === "delete" ? tr("evaluation.service.delete.error", "Erreur lors de la suppression d'un service") : tr("evaluations.service.devoir.update.error", "Erreur lors de la mise à jour des devoirs liés au service"));
    }
    await reload();
  };

  const saveEditing = async () => {
    if (!editing) return;
    const { row, params } = editing;
    const off = switchedOff(row.params, params);
    const apply = () => competenceServiceService.updateMany(paramsPayload(row, params)).then(() => undefined);
    if (off.length === 0) {
      setEditing(null);
      return attempt(apply);
    }
    await withHomeworkCheck(row, off.map((p) => p.id_groupe), apply);
    setEditing(null);
  };

  const addWord = (value: string) => {
    const w = classifyWord(value, rows, words, classWords);
    if (!w) return;
    if (w.kind === "class") setClassWords([...classWords, w.value]);
    else setWords([...words, w.value]);
  };

  const sortHeader = (key: SortKey, label: string) => (
    <th scope="col" aria-sort={sort.key === key ? (sort.asc ? "ascending" : "descending") : "none"}>
      <button type="button" className="border-0 bg-transparent p-0 fw-bold" onClick={() => setSort((s) => nextSortState(s, key))} data-vsco-comp-service-sort={key}>
        {label} {sort.key === key ? (sort.asc ? "▲" : "▼") : ""}
      </button>
    </th>
  );
  const eye = (visible: boolean | undefined, locked: boolean, label: string, onClick: () => void) => (
    <button type="button" className="btn btn-sm btn-link p-0 me-4" aria-pressed={!!visible} aria-disabled={locked} title={label} style={{ opacity: locked ? 0.4 : 1 }} onClick={(e) => { e.stopPropagation(); onClick(); }} data-vsco-comp-service-eye>
      {visible ? "👁" : "🚫"}
    </button>
  );

  const typeButtons: Array<{ k: keyof Filters; key: string; fallback: string }> = [
    { k: "classes", key: "evaluation.service.filter.classes", fallback: "Classes" },
    { k: "groups", key: "evaluation.service.filter.groupes", fallback: "Groupes d'enseignements" },
    { k: "manualGroups", key: "evaluation.service.filter.manualGroupes", fallback: "Groupes manuels" },
    { k: "evaluable", key: "evaluation.service.headers.evaluable", fallback: "Évaluables" },
    { k: "notEvaluable", key: "evaluation.service.headers.notEvaluable", fallback: "Non évaluables" },
  ];

  return (
    <div data-vsco-comp-services>
      <h3 className="h5 mb-12">{tr("evaluation.service.title", "Paramétrage des services")}</h3>
      <div className="mb-12">
        <input
          className="form-control mb-8"
          style={{ maxWidth: 420 }}
          type="search"
          placeholder={tr("viescolaire.utils.search", "Rechercher")}
          aria-label={tr("viescolaire.utils.search", "Rechercher")}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            addWord(e.currentTarget.value);
            e.currentTarget.value = "";
          }}
          data-vsco-comp-service-search
        />
        <div className="d-flex gap-8 flex-wrap" data-vsco-comp-service-chips>
          {words.map((w) => (
            <button key={`w${w}`} type="button" className="badge text-bg-secondary border-0" title={tr("item.delete", "Supprimer")} onClick={() => setWords(words.filter((x) => x !== w))}>
              {w} ×
            </button>
          ))}
          {classWords.map((w) => (
            <button key={`c${w}`} type="button" className="badge text-bg-primary border-0" title={tr("item.delete", "Supprimer")} onClick={() => setClassWords(classWords.filter((x) => x !== w))}>
              {w} ×
            </button>
          ))}
        </div>
      </div>
      <div className="d-flex gap-8 flex-wrap mb-12" role="group" aria-label={tr("evaluation.service.title", "Paramétrage des services")}>
        {typeButtons.map((b) => (
          <button key={b.k} type="button" aria-pressed={filters[b.k]} className={`btn btn-sm ${filters[b.k] ? "btn-primary" : "btn-outline-secondary"}`} onClick={() => setFilters({ ...filters, [b.k]: !filters[b.k] })} data-vsco-comp-service-filter={b.k}>
            {tr(b.key, b.fallback)}
          </button>
        ))}
      </div>
      {failedLoad && (
        <p className="text-danger" role="alert">
          {tr("evaluation.service.error.get", "Erreur lors de la recupereration des services.")}
        </p>
      )}
      {!ready && !failedLoad && <p className="text-muted">{tr("viescolaire.loading", "Chargement…")}</p>}
      {ready && (
        <div className="table-responsive">
          <table className="table align-middle" data-vsco-comp-service-table>
            <thead>
              <tr>
                {sortHeader("topicName", tr("evaluation.service.columns.matiere", "Matière"))}
                {sortHeader("nom_groupe", tr("evaluation.service.columns.classGroup", "Classe / Groupe"))}
                {sortHeader("nom_enseignant", tr("evaluation.service.columns.teacher", "Enseignant"))}
                {sortHeader("remplacement", tr("evaluation.service.columns.remplacement", "Remplacement"))}
                {sortHeader("coefficient", tr("viescolaire.utils.coefficient", "Coefficient"))}
                {sortHeader("modalite", tr("evaluation.service.columns.modalite", "Modalité"))}
                {sortHeader("evaluable", tr("evaluation.service.columns.evaluable", "Évaluable"))}
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-muted">
                    {tr("evaluation.service.none", "Aucun service.")}
                  </td>
                </tr>
              )}
              {shown.map((r) => {
                const k = rowKey(r);
                const merged = mergedValues(r);
                const state = evaluableState(r);
                const withMultiEye = r.coTeachers.length > 0 || r.substituteTeachers.length > 0;
                const open = deployed === k && r.subTopics.length > 0;
                return (
                  <tr key={k} data-vsco-comp-service-row={`${r.topicName}|${r.nom_enseignant}`} onClick={() => r.subTopics.length > 0 && setDeployed(open ? null : k)} style={{ cursor: r.subTopics.length > 0 ? "pointer" : undefined }}>
                    <td>
                      {r.subTopics.length > 0 ? (
                        <button type="button" className="btn btn-sm btn-link p-0 text-start" aria-expanded={open} title={tr("evaluation.service.tooltip.subtopic", "Cette matière comporte des sous matières")} onClick={(e) => { e.stopPropagation(); setDeployed(open ? null : k); }} data-vsco-comp-service-deploy>
                          {open ? "▾" : "▸"} {r.topicName}
                        </button>
                      ) : (
                        r.topicName
                      )}
                      {open && (
                        <ul className="list-unstyled mt-8 mb-0" data-vsco-comp-service-subtopics>
                          {r.subTopics.map((s) => {
                            const sk = `${k}|${s.id_subtopic}`;
                            return (
                              <li key={sk} className="d-flex align-items-center gap-8 mb-4" onClick={(e) => e.stopPropagation()}>
                                <span className="ps-16">{s.libelle}</span>
                                <input
                                  type="number"
                                  min={0}
                                  step={0.25}
                                  className="form-control form-control-sm"
                                  style={{ width: 90 }}
                                  aria-label={`${tr("viescolaire.utils.coefficient", "Coefficient")} ${s.libelle}`}
                                  value={subEdits[sk] ?? String(s.coefficient)}
                                  onChange={(e) => setSubEdits({ ...subEdits, [sk]: e.target.value })}
                                  onBlur={() => saveSubTopic(r, s)}
                                  data-vsco-comp-service-subtopic-coef
                                />
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </td>
                    <td title={r.groupsName}>{r.groupsName || r.nom_groupe}</td>
                    <td>
                      {withMultiEye && eye(r.is_visible, mainEyeLocked(r, today), tr("evaluation.service.columns.teacher", "Enseignant"), () => toggleMainEye(r))}
                      {r.nom_enseignant}
                      {r.coTeachers.filter((c) => c.displayName).map((c) => (
                        <div key={c.second_teacher_id} className="pt-4">
                          {eye(c.is_visible, multiEyeLocked(r, c, today), c.displayName ?? "", () => toggleMultiEye(r, c))}
                          {c.displayName}
                        </div>
                      ))}
                    </td>
                    <td>
                      {r.substituteTeachers.filter((s) => s.displayName).map((s) => {
                        const current = isCurrentSubstitute(s, today);
                        return (
                          <div key={s.second_teacher_id}>
                            {current && eye(s.is_visible, multiEyeLocked(r, s, today), s.displayName ?? "", () => toggleMultiEye(r, s))}
                            <span
                              className={current ? "" : "text-muted"}
                              title={`${tr("evaluation.service.columns.remplacement", "Remplacement")} ${tr("viescolaire.utils.from.date", "du")} ${fr(s.start_date)} ${tr("viescolaire.utils.to.date", "au")} ${fr(s.end_date)} ${tr("viescolaire.utils.datefinsaisie", "Date de fin de saisie")} ${fr(s.entered_end_date)}`}
                            >
                              {s.displayName}
                            </span>
                          </div>
                        );
                      })}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="number"
                        min={0}
                        className="form-control form-control-sm"
                        style={{ width: 90 }}
                        aria-label={`${tr("viescolaire.utils.coefficient", "Coefficient")} ${r.topicName}`}
                        placeholder={merged.multipleCoefficient ? tr("multiples", "Multiples") : undefined}
                        value={coefEdits[k] ?? (merged.coefficient === undefined ? "" : String(merged.coefficient))}
                        onChange={(e) => setCoefEdits({ ...coefEdits, [k]: e.target.value })}
                        onBlur={() => saveCoefficient(r)}
                        data-vsco-comp-service-coef
                      />
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <select className="form-select form-select-sm" aria-label={`${tr("evaluation.service.columns.modalite", "Modalité")} ${r.topicName}`} value={merged.modalite} onChange={(e) => saveModalite(r, e.target.value)} data-vsco-comp-service-modalite>
                        <option value={MULTIPLES} disabled>
                          {tr("multiples", "Multiples")}
                        </option>
                        {modaliteIds.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="d-flex align-items-center gap-8">
                        <input
                          type="checkbox"
                          className="form-check-input m-0"
                          aria-label={`${tr("evaluation.service.columns.evaluable", "Évaluable")} ${r.topicName}`}
                          checked={state === "all"}
                          ref={(el) => {
                            if (el) el.indeterminate = state === "various";
                          }}
                          onChange={() => switchEvaluable(r)}
                          data-vsco-comp-service-evaluable={state}
                        />
                        {r.params.length > 0 && (
                          <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setEditing({ row: r, params: r.params.map((p) => ({ ...p })) })} data-vsco-comp-service-edit>
                            {tr("evaluation.service.lightboxes.update", "Coefficients et Modalités")}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal id="vsco-comp-service-edit" isOpen={!!editing && !homework} onModalClose={() => setEditing(null)} size="lg">
        <Modal.Header onModalClose={() => setEditing(null)}>{tr("evaluation.service.lightboxes.update", "Coefficients et Modalités")}</Modal.Header>
        <Modal.Body>
          {editing && (
            <>
              <p>
                <b>{tr("evaluation.service.columns.matiere", "Matière")}</b> : {editing.row.topicName}
              </p>
              <table className="table align-middle" data-vsco-comp-service-edit-table>
                <thead>
                  <tr>
                    <th scope="col">{tr("evaluation.service.columns.classGroup", "Classe / Groupe")}</th>
                    <th scope="col">{tr("viescolaire.utils.coefficient", "Coefficient")}</th>
                    <th scope="col">{tr("evaluation.service.columns.modalite", "Modalité")}</th>
                    <th scope="col">{tr("evaluation.service.columns.evaluable", "Évaluable")}</th>
                  </tr>
                </thead>
                <tbody>
                  {[...editing.params].sort((a, b) => (a.nom_groupe ?? "").localeCompare(b.nom_groupe ?? "")).map((p) => {
                    const set = (patch: Partial<Param>) => setEditing({ ...editing, params: editing.params.map((x) => (x.id_groupe === p.id_groupe ? { ...x, ...patch } : x)) });
                    return (
                      <tr key={p.id_groupe} data-vsco-comp-service-param={p.nom_groupe}>
                        <td>{p.nom_groupe}</td>
                        <td>
                          <input type="number" min={0} className="form-control form-control-sm" style={{ width: 90 }} aria-label={`${tr("viescolaire.utils.coefficient", "Coefficient")} ${p.nom_groupe}`} value={p.coefficient ?? ""} onChange={(e) => set({ coefficient: e.target.value })} />
                        </td>
                        <td>
                          <select className="form-select form-select-sm" aria-label={`${tr("evaluation.service.columns.modalite", "Modalité")} ${p.nom_groupe}`} value={p.modalite} onChange={(e) => set({ modalite: e.target.value })}>
                            {modaliteIds.map((m) => (
                              <option key={m} value={m}>
                                {m}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input type="checkbox" className="form-check-input" aria-label={`${tr("evaluation.service.columns.evaluable", "Évaluable")} ${p.nom_groupe}`} checked={p.evaluable} onChange={(e) => set({ evaluable: e.target.checked })} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" color="tertiary" variant="ghost" onClick={() => setEditing(null)}>
            {tr("viescolaire.utils.cancel", "Annuler")}
          </Button>
          <Button type="button" color="primary" disabled={!!editing && editing.params.some((p) => validCoefficient(String(p.coefficient ?? "")) === null)} onClick={saveEditing} data-vsco-comp-service-edit-save>
            {tr("viescolaire.utils.save", "Enregistrer")}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal id="vsco-comp-service-homework" isOpen={!!homework} onModalClose={() => setHomework(null)} size="md">
        <Modal.Header onModalClose={() => setHomework(null)}>{tr("evaluation.service.lightboxes.switchEval", "Rendre non-évaluable un service")}</Modal.Header>
        <Modal.Body>
          {homework && (
            <div data-vsco-comp-service-homework>
              <p>{homeworkMessage(tr("evaluations.service.devoir.error", "Le service sélectionné est utilisé par [nbDevoir] devoir(s). Que souhaitez-vous faire ?"), homework.ids.length)}</p>
              <div className="form-check">
                <input id="vsco-comp-hw-delete" type="radio" name="vsco-comp-hw" className="form-check-input" checked={hwAction === "delete"} onChange={() => setHwAction("delete")} data-vsco-comp-hw="delete" />
                <label htmlFor="vsco-comp-hw-delete" className="form-check-label">
                  {tr("evaluations.service.devoir.delete", "Supprimer l'ensemble des devoirs liés au service")}
                </label>
              </div>
              <div className="form-check">
                <input id="vsco-comp-hw-update" type="radio" name="vsco-comp-hw" className="form-check-input" checked={hwAction === "update"} onChange={() => setHwAction("update")} data-vsco-comp-hw="update" />
                <label htmlFor="vsco-comp-hw-update" className="form-check-label">
                  {tr("evaluations.service.devoir.update", "Mettre à jour la matière de l'ensemble des devoirs liés au service")}
                </label>
              </div>
              {hwAction === "update" && (
                <div className="mt-8">
                  <label htmlFor="vsco-comp-hw-matiere" className="form-label">
                    {tr("evaluation.service.columns.matiere", "Matière")}
                  </label>
                  <select id="vsco-comp-hw-matiere" className="form-select" value={hwMatiere} onChange={(e) => setHwMatiere(e.target.value)} data-vsco-comp-hw-matiere>
                    <option value="" />
                    {(matieres.data ?? []).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.externalId} - {m.source})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" color="tertiary" variant="ghost" onClick={() => setHomework(null)}>
            {tr("viescolaire.utils.cancel", "Annuler")}
          </Button>
          <Button type="button" color="primary" disabled={hwAction === ""} onClick={confirmHomework} data-vsco-comp-hw-save>
            {tr("viescolaire.utils.save", "Enregistrer")}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};
