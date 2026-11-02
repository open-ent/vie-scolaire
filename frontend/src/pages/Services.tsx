import { Button, Modal } from "@open-ent/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { MultiTeachingModal } from "../components/MultiTeachingModal";
import { useStructure } from "../components/StructureContext";
import { isCurrent } from "../lib/multiteaching";
import { multiTeachingService } from "../services/settings.service";
import { alreadyExists, createPayload, deletePath, enrich, filterServices, GROUP_TYPES, Group, MultiTeaching, Service, SortKey, sortServices, typeFilterQuery } from "../lib/services";
import { teachingService } from "../services/settings.service";

const COLUMNS: Array<{ key: SortKey; i18n: string; fallback: string }> = [
  { key: "topicName", i18n: "evaluation.service.columns.matiere", fallback: "Matière" },
  { key: "groupName", i18n: "evaluation.service.columns.classGroup", fallback: "Classe / groupe" },
  { key: "teacherName", i18n: "evaluation.service.columns.teacher", fallback: "Enseignant" },
  { key: "substitute", i18n: "evaluation.service.columns.remplacement", fallback: "Remplaçant" },
];

/** Services d'enseignement : matière, classe ou groupe, enseignant, co-enseignants et remplaçants. */
export const Services = () => {
  const { t } = useTranslation("viescolaire");
  const structure = useStructure();
  const qc = useQueryClient();
  const tr = (k: string, d: string) => t(k, { defaultValue: d });
  const [selectedTypes, setSelectedTypes] = useState<Record<string, boolean>>({ classes: true, groups: true, manualGroups: true });
  const [sort, setSort] = useState<{ key: SortKey; ascending: boolean }>({ key: "topicName", ascending: true });
  const [words, setWords] = useState<string[]>([]);
  const [classWords, setClassWords] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [deployed, setDeployed] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<Service | null>(null);
  // fenêtre des co-enseignants / remplaçants : service visé, mode et remplacement existant à modifier
  const [mt, setMt] = useState<{ service: Service; isCo: boolean; existing?: MultiTeaching } | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const id = structure.id;
  const filter = typeFilterQuery(selectedTypes);
  const raw = useQuery({ queryKey: ["services", id, filter], queryFn: () => teachingService.list(id, filter) });
  const groups = useQuery({ queryKey: ["serviceGroups", id], queryFn: () => teachingService.groups(id) });
  const matieres = useQuery({ queryKey: ["matieres", id], queryFn: () => teachingService.matieres(id) });
  const teachers = useQuery({ queryKey: ["teachers", id], queryFn: () => teachingService.teachers(id) });
  const subTopics = useQuery({ queryKey: ["subTopics", id], queryFn: () => teachingService.subTopics(id) });
  const loading = raw.isLoading || groups.isLoading || matieres.isLoading || teachers.isLoading;

  const services = useMemo(() => enrich(raw.data ?? [], matieres.data ?? [], teachers.data ?? [], groups.data ?? [], subTopics.data ?? []), [raw.data, matieres.data, teachers.data, groups.data, subTopics.data]);
  const shown = useMemo(() => sortServices(filterServices(services, words, classWords), sort.key, sort.ascending), [services, words, classWords, sort]);

  // création
  const [cMatiere, setCMatiere] = useState("");
  const [cTeacher, setCTeacher] = useState("");
  const [cClasses, setCClasses] = useState<Group[]>([]);
  const [cEvaluable, setCEvaluable] = useState(false);
  const exists = alreadyExists(raw.data ?? [], cMatiere, cTeacher, cClasses.map((c) => c.id));
  const canCreate = !!cMatiere && !!cTeacher && cClasses.length > 0 && !exists;
  const openCreate = () => { setCMatiere(""); setCTeacher(""); setCClasses([]); setCEvaluable(false); setCreating(true); };

  const refresh = () => qc.invalidateQueries({ queryKey: ["services", id] });
  const create = async () => {
    setCreating(false);
    try {
      await teachingService.create(createPayload(id, cTeacher, cMatiere, cClasses.map((c) => c.id), cEvaluable));
      setMessage({ ok: true, text: cClasses.length > 1 ? tr("evaluation.services.create", "Les services ont bien été créés") : tr("evaluation.service.create", "Le service a bien été créé") });
    } catch {
      setMessage({ ok: false, text: tr("evaluation.service.error.create", "Une erreur est survenue lors de la création du service") });
    }
    await refresh();
  };
  const remove = async () => {
    const s = toDelete;
    setToDelete(null);
    if (!s) return;
    try {
      await teachingService.remove(deletePath(s));
      setMessage({ ok: true, text: tr("evaluation.service.delete", "Le service a bien été supprimé") });
    } catch {
      setMessage({ ok: false, text: tr("evaluation.service.error.delete", "Une erreur est survenue lors de la suppression du service") });
    }
    await refresh();
  };

  const addWord = () => {
    const w = query.trim();
    if (!w) return;
    // un mot qui correspond à une classe devient un filtre de classe, sinon un filtre de texte
    const isClass = services.some((s) => s.groupName.toUpperCase().includes(w.toUpperCase()));
    if (isClass && !classWords.includes(w.toUpperCase())) setClassWords([...classWords, w.toUpperCase()]);
    else if (!isClass && !words.includes(w)) setWords([...words, w]);
    setQuery("");
  };

  return (
    <section data-vsco-services>
      <h2 className="h4 mb-16">{tr("evaluation.service.title", "Paramétrage des services")}</h2>
      {message && (
        <p className={message.ok ? "text-success" : "text-danger"} role={message.ok ? "status" : "alert"} data-vsco-message>
          {message.text}
        </p>
      )}
      {(raw.isError || groups.isError || matieres.isError || teachers.isError) && (
        <p className="text-danger" role="alert">
          {tr("evaluation.service.error.get", "Une erreur est survenue lors de la récupération des services")}
        </p>
      )}

      <div className="d-flex gap-16 flex-wrap align-items-end mb-8">
        <div style={{ minWidth: 320 }}>
          <label htmlFor="vsco-service-search" className="form-label">
            {tr("viescolaire.utils.search", "Rechercher")}
          </label>
          <input
            id="vsco-service-search"
            className="form-control"
            value={query}
            placeholder={tr("evaluation.service.search.placeholder", "Enseignant, matière ou classe (Entrée pour ajouter le filtre)")}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addWord()}
            data-vsco-service-search
          />
        </div>
        <Button type="button" color="primary" onClick={openCreate} data-vsco-service-create>
          {tr("evaluation.service.lightboxes.create", "Créer un service")}
        </Button>
      </div>
      <div className="d-flex gap-8 flex-wrap mb-8" data-vsco-service-chips>
        {[...words, ...classWords].map((w) => (
          <button key={w} type="button" className="btn btn-sm btn-secondary" onClick={() => { setWords(words.filter((x) => x !== w)); setClassWords(classWords.filter((x) => x !== w)); }} aria-label={`Retirer le filtre ${w}`}>
            {w} ×
          </button>
        ))}
      </div>
      <div className="d-flex gap-8 flex-wrap mb-16" role="group" aria-label={tr("evaluation.service.filter.type", "Type de groupe")}>
        {GROUP_TYPES.map((g) => (
          <button key={g.key} type="button" aria-pressed={selectedTypes[g.key]} className={`btn btn-sm ${selectedTypes[g.key] ? "btn-primary" : "btn-outline-secondary"}`} onClick={() => setSelectedTypes({ ...selectedTypes, [g.key]: !selectedTypes[g.key] })} data-vsco-service-type={g.key}>
            {tr(g.fallback, g.label)}
          </button>
        ))}
      </div>

      {loading && <p>{tr("viescolaire.loading", "Chargement…")}</p>}
      <table className="table" data-vsco-service-table>
        <thead>
          <tr>
            {COLUMNS.map((c) => (
              <th key={c.key} aria-sort={sort.key === c.key ? (sort.ascending ? "ascending" : "descending") : "none"}>
                <button type="button" className="border-0 bg-transparent p-0 fw-bold" onClick={() => setSort((s) => ({ key: c.key, ascending: s.key === c.key ? !s.ascending : true }))} data-vsco-service-sort={c.key}>
                  {tr(c.i18n, c.fallback)} {sort.key === c.key ? (sort.ascending ? "▲" : "▼") : ""}
                </button>
              </th>
            ))}
            <th>{tr("evaluation.service.columns.actions", "Actions")}</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((s) => {
            const key = `${s.id_matiere}|${s.id_enseignant}|${s.id_groupe}`;
            return (
              <>
                <tr key={key} data-vsco-service-row={s.topicName}>
                  <td>
                    {s.subTopics.length > 0 ? (
                      <button type="button" className="btn btn-link p-0" aria-expanded={deployed === key} onClick={() => setDeployed(deployed === key ? null : key)} data-vsco-service-deploy>
                        {s.topicName}
                      </button>
                    ) : (
                      s.topicName
                    )}
                  </td>
                  <td>{s.groupName}</td>
                  <td>
                    {s.teacherName}
                    {s.coTeachers.filter((c) => c.displayName).map((c) => (
                      <div key={c.second_teacher_id} className="text-muted" data-vsco-co-teacher>
                        {c.displayName}{" "}
                        <button type="button" className="btn btn-link p-0" aria-label={`Retirer ${c.displayName}`} onClick={async () => {
                          try {
                            await multiTeachingService.remove(id, (c.idsAndIdsGroups ?? []).map((l) => l.id));
                            setMessage({ ok: true, text: tr("evaluation.coteaching.delete", "Le co-enseignant a bien été retiré") });
                          } catch {
                            setMessage({ ok: false, text: tr("evaluation.coteaching.delete.error", "Une erreur est survenue lors de la suppression") });
                          }
                          await refresh();
                        }} data-vsco-co-remove>
                          ×
                        </button>
                      </div>
                    ))}
                  </td>
                  <td>
                    {s.substituteTeachers.filter((c) => c.displayName).map((c) => (
                      <div key={`${c.second_teacher_id}-${c.start_date}`} data-vsco-substitute className={isCurrent(c) ? "" : "text-muted"}>
                        <span title={`${c.start_date?.slice(0, 10)} → ${c.end_date?.slice(0, 10)}`}>{c.displayName}</span>{" "}
                        <button type="button" className="btn btn-link p-0" aria-label={`Modifier le remplacement de ${c.displayName}`} onClick={() => setMt({ service: s, isCo: false, existing: c })} data-vsco-substitute-edit>
                          ✎
                        </button>
                      </div>
                    ))}
                  </td>
                  <td className="d-flex gap-8 flex-wrap">
                    <button type="button" className="btn btn-sm btn-secondary" onClick={() => setMt({ service: s, isCo: false })} data-vsco-substitute-add>
                      {tr("evaluations.remplacement.remplacant", "+ Remplaçant")}
                    </button>
                    <button type="button" className="btn btn-sm btn-secondary" onClick={() => setMt({ service: s, isCo: true })} data-vsco-coteacher-add>
                      {tr("evaluation.service.coenseignants", "+ Co-enseignant")}
                    </button>
                    {s.is_manual && (
                      <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setToDelete(s)} data-vsco-service-delete>
                        {tr("item.delete", "Supprimer")}
                      </button>
                    )}
                  </td>
                </tr>
                {deployed === key && s.subTopics.map((sub) => (
                  <tr key={`${key}-${sub.id}`} className="table-light">
                    <td className="ps-24">{sub.libelle}</td>
                    <td>{s.groupName}</td>
                    <td colSpan={3} />
                  </tr>
                ))}
              </>
            );
          })}
        </tbody>
      </table>
      {!loading && shown.length === 0 && <p className="text-muted">{tr("evaluation.service.none", "Aucun service.")}</p>}

      <MultiTeachingModal
        service={mt?.service ?? null}
        isCo={mt?.isCo ?? false}
        existing={mt?.existing}
        structureId={id}
        teachers={teachers.data ?? []}
        onClose={() => setMt(null)}
        onDone={async (ok, text) => {
          setMt(null);
          setMessage({ ok, text });
          await refresh();
        }}
      />

      <Modal id="vsco-service-create" isOpen={creating} onModalClose={() => setCreating(false)} size="lg" scrollable>
        <Modal.Header onModalClose={() => setCreating(false)}>{tr("evaluation.service.lightboxes.create", "Créer un service")}</Modal.Header>
        <Modal.Body>
          <div className="mb-12">
            <label htmlFor="vsco-c-matiere" className="form-label">{tr("evaluation.service.columns.matiere", "Matière")}</label>
            <select id="vsco-c-matiere" className="form-select" value={cMatiere} onChange={(e) => setCMatiere(e.target.value)} data-vsco-c-matiere>
              <option value="" disabled>{tr("evaluation.service.columns.matiere", "Matière")}</option>
              {[...(matieres.data ?? [])].sort((a, b) => a.name.localeCompare(b.name)).map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div className="mb-12">
            <label htmlFor="vsco-c-class" className="form-label">{tr("viescolaire.competences.classe.groupe", "Classe / groupe")}</label>
            <div className="d-flex gap-8 flex-wrap mb-8">
              {cClasses.map((c) => (
                <button key={c.id} type="button" className="btn btn-sm btn-secondary" onClick={() => setCClasses(cClasses.filter((x) => x.id !== c.id))} aria-label={`Retirer ${c.name}`} data-vsco-c-class-chip>
                  {c.name} ×
                </button>
              ))}
            </div>
            <select id="vsco-c-class" className="form-select" value="" onChange={(e) => { const g = (groups.data ?? []).find((x) => x.id === e.target.value); if (g) setCClasses([...cClasses, g]); }} data-vsco-c-class>
              <option value="">{tr("viescolaire.competences.classe.groupe", "Classe / groupe")}</option>
              {[...(groups.data ?? [])].filter((g) => !cClasses.some((c) => c.id === g.id)).sort((a, b) => (a.type_groupe ?? 0) - (b.type_groupe ?? 0) || a.name.localeCompare(b.name)).map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>
          <div className="mb-12">
            <label htmlFor="vsco-c-teacher" className="form-label">{tr("evaluation.service.columns.teacher", "Enseignant")}</label>
            <select id="vsco-c-teacher" className="form-select" value={cTeacher} onChange={(e) => setCTeacher(e.target.value)} data-vsco-c-teacher>
              <option value="" disabled>{tr("evaluation.service.columns.teacher", "Enseignant")}</option>
              {[...(teachers.data ?? [])].sort((a, b) => a.displayName.localeCompare(b.displayName)).map((x) => (
                <option key={x.id} value={x.id}>{x.displayName}</option>
              ))}
            </select>
          </div>
          <label className="mb-8">
            <input type="checkbox" checked={cEvaluable} onChange={(e) => setCEvaluable(e.target.checked)} /> {tr("evaluation.service.columns.evaluable", "Évaluable")}
          </label>
          {exists && <p className="text-danger" role="alert" data-vsco-c-exists>{tr("evaluation.service.exists", "Ce service existe déjà pour cet enseignant et cette classe.")}</p>}
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" color="tertiary" variant="ghost" onClick={() => setCreating(false)}>{tr("viescolaire.utils.cancel", "Annuler")}</Button>
          <Button type="button" color="primary" disabled={!canCreate} onClick={create} data-vsco-c-save>{tr("viescolaire.utils.save", "Enregistrer")}</Button>
        </Modal.Footer>
      </Modal>

      <Modal id="vsco-service-delete" isOpen={!!toDelete} onModalClose={() => setToDelete(null)}>
        <Modal.Header onModalClose={() => setToDelete(null)}>{tr("evaluation.service.lightboxes.deletion", "Supprimer le service")}</Modal.Header>
        <Modal.Body><p className="m-0">{toDelete?.topicName}</p></Modal.Body>
        <Modal.Footer>
          <Button type="button" color="tertiary" variant="ghost" onClick={() => setToDelete(null)}>{tr("viescolaire.utils.cancel", "Annuler")}</Button>
          <Button type="button" color="danger" onClick={remove} data-vsco-service-delete-confirm>{tr("item.delete", "Supprimer")}</Button>
        </Modal.Footer>
      </Modal>
    </section>
  );
};
