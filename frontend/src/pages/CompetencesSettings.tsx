import { HintText } from "../components/HintText";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { AbsenceImport } from "../components/competences/AbsenceImport";
import { BfcVisibility } from "../components/competences/BfcVisibility";
import { CycleLinks } from "../components/competences/CycleLinks";
import { Items } from "../components/competences/Items";
import { Levels } from "../components/competences/Levels";
import { Opinions } from "../components/competences/Opinions";
import { ProgramElements } from "../components/competences/ProgramElements";
import { Projects } from "../components/competences/Projects";
import { ServiceSettings } from "../components/competences/ServiceSettings";
import { useCompT } from "../components/competences/shared";
import { SubjectModels } from "../components/competences/SubjectModels";
import { SubjectOrder } from "../components/competences/SubjectOrder";
import { useStructure } from "../components/StructureContext";
import { CompSectionId, currentCompSection, visibleCompSections } from "../lib/competencesAccess";
import { buildCycles, pickCycle } from "../lib/competencesLevels";
import { isStructureActive } from "../lib/competencesMisc";
import { activationService, levelService } from "../services/competences.service";
import { useMe } from "../services/queries";

/** Module d'évaluation des compétences : activation pour l'établissement, puis paramétrage en douze rubriques. */
export const CompetencesSettings = () => {
  const tr = useCompT();
  const structure = useStructure();
  const qc = useQueryClient();
  const me = useMe();
  const [wanted, setWanted] = useState<CompSectionId>("levels");
  const [cycleId, setCycleId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const notify = (ok: boolean, text: string) => setNotice({ ok, text });

  const activeKey = ["comp-active", structure.id];
  const actives = useQuery({ queryKey: activeKey, queryFn: () => activationService.actives("notes") });
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (actives.data) setActive(isStructureActive(actives.data, structure.id));
  }, [actives.data, structure.id]);

  const levelsKey = ["comp-levels", structure.id];
  const levels = useQuery({ queryKey: levelsKey, queryFn: () => levelService.list(structure.id), enabled: active });
  const cycles = useMemo(() => buildCycles(levels.data ?? [], structure.id), [levels.data, structure.id]);
  useEffect(() => setCycleId((c) => pickCycle(cycles, c)), [cycles]);
  useEffect(() => setNotice(null), [structure.id, wanted]);

  const sections = useMemo(() => visibleCompSections(me.data?.actions), [me.data]);
  const current = currentCompSection(sections, wanted);

  const toggleActive = async (next: boolean) => {
    setActive(next);
    try {
      if (next) await activationService.activate("notes", structure.id);
      else await activationService.deactivate("notes", structure.id);
      await qc.invalidateQueries({ queryKey: activeKey });
    } catch {
      setActive(!next);
      notify(false, tr("viescolaire.comp.activation.error", "Erreur lors de l'activation du module"));
    }
  };

  const props = { structureId: structure.id, notify };
  const label = (id: CompSectionId) => sections.find((s) => s.id === id);

  return (
    <section data-vsco-competences>
      <article className="mb-16">
        <div className="form-check form-switch">
          <input id="vsco-comp-active" type="checkbox" role="switch" className="form-check-input" checked={active} disabled={actives.isLoading} onChange={(e) => toggleActive(e.target.checked)} data-vsco-comp-active />
          <label htmlFor="vsco-comp-active" className="form-check-label fw-bold">
            {tr("activated.module", "Activer le module.")}
          </label>
        </div>
        {actives.isError && (
          <p className="text-danger" role="alert">
            {tr("viescolaire.get.fail", "Erreur lors de la récupération")}
          </p>
        )}
      </article>
      {notice && (
        <p className={notice.ok ? "text-success" : "text-danger"} role={notice.ok ? "status" : "alert"} data-vsco-comp-message>
          {notice.text}
        </p>
      )}

      {active && (
        <div className="row" data-vsco-comp-panel>
          <nav className="col-12 col-md-3 mb-16" aria-label={tr("evaluations.competences.title", "Compétences")}>
            <ul className="nav flex-column nav-pills" data-vsco-comp-nav>
              {sections.map((s) => (
                <li className="nav-item" key={s.id}>
                  <button type="button" className={`nav-link text-start${current === s.id ? " active" : ""}`} aria-current={current === s.id ? "page" : undefined} onClick={() => setWanted(s.id)} data-vsco-comp-section-link={s.id}>
                    {tr(s.key, s.fallback)}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <div className="col-12 col-md-9" data-vsco-comp-section={current}>
            {levels.isError && (
              <p className="text-danger" role="alert">
                {tr("viescolaire.get.fail", "Erreur lors de la récupération")}
              </p>
            )}
            <HintText id={`comp.${current}`} />
            {current === "levels" && <Levels {...props} cycles={cycles} cycleId={cycleId} onSelectCycle={setCycleId} onReload={() => qc.invalidateQueries({ queryKey: levelsKey })} />}
            {current === "visibilityAverage" && (
              <article>
                <h3 className="h5 mb-12">{tr(label("visibilityAverage")?.key ?? "evaluation.bfc.visibility.average", "Visibilité du niveau calculé du BFC par domaine")}</h3>
                <BfcVisibility {...props} kind="average" />
              </article>
            )}
            {current === "visibilityDnb" && (
              <article>
                <h3 className="h5 mb-12">
                  {tr("evaluation.bfc.visibility.baremeBFC", "Visibilité du barème DNB affiché sur le BFC ")} {tr("evaluation.bfc.visibility.diviseur", " /400 :")}
                </h3>
                <BfcVisibility {...props} kind="dnb" />
              </article>
            )}
            {current === "items" && <Items {...props} cycles={cycles} cycleId={cycleId} onSelectCycle={setCycleId} />}
            {current === "links" && <CycleLinks {...props} cycles={cycles} />}
            {current === "projects" && <Projects {...props} />}
            {current === "services" && <ServiceSettings {...props} />}
            {current === "subjects" && <SubjectModels {...props} />}
            {current === "absences" && <AbsenceImport {...props} />}
            {current === "opinions" && <Opinions {...props} />}
            {current === "program" && <ProgramElements {...props} cycles={cycles} />}
            {current === "order" && <SubjectOrder {...props} />}
          </div>
        </div>
      )}
    </section>
  );
};
