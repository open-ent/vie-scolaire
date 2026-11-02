import { Button, Modal } from "@open-ent/react";
import { useEffect, useRef, useState } from "react";
import { Cycle, isValidLettre, isValidLibelle, MAX_LETTRE, MAX_LIBELLE, Niveau, niveauPayload, readableText, sameNiveau, toColorInput } from "../../lib/competencesLevels";
import { levelService } from "../../services/competences.service";
import { CycleTabs } from "./CycleTabs";
import { SectionProps, useCompT } from "./shared";

interface Props extends SectionProps {
  cycles: Cycle[];
  cycleId: number | null;
  onSelectCycle: (id: number) => void;
  /** Recharge les niveaux depuis le serveur (après une réinitialisation). */
  onReload: () => Promise<unknown>;
}

/** Pastille d'un niveau : la lettre sur la couleur. */
const Bubble = ({ color, text }: { color: string | null; text: string | null }) => (
  <span
    aria-hidden="true"
    className="d-inline-flex align-items-center justify-content-center fw-bold rounded-circle"
    style={{ width: 32, height: 32, background: toColorInput(color), color: readableText(color ?? ""), border: "1px solid rgba(0,0,0,.2)" }}
  >
    {(text ?? "").trim()}
  </span>
);

/** Option « calculer et utiliser la moyenne des niveaux pour chaque item de compétences ». */
const AverageOption = ({ structureId, notify }: SectionProps) => {
  const tr = useCompT();
  const [value, setValue] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    levelService.isSkillAverage(structureId).then(
      (v) => alive && setValue(v),
      () => alive && notify(false, tr("competences.structure.options.error.get", "une erreur est survenue lors de la récupération de l'option du calcul des compétences")),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structureId]);
  const change = async (next: boolean) => {
    setValue(next);
    try {
      await levelService.setSkillAverage(structureId, next);
    } catch {
      setValue(!next);
      notify(false, tr("competences.structure.options.error.save", "une erreur est survenue lors de la sauvegarde du calcul des compétences"));
    }
  };
  return (
    <div data-vsco-comp-average>
      <p>{tr("competence.struture.option.default.sentence", "Par défault, si un item est évalué sur plusieurs devoirs, c'est le niveau maximum qui est retenu.")}</p>
      <div className="form-check form-switch">
        <input id="vsco-comp-average" type="checkbox" role="switch" className="form-check-input" checked={!!value} disabled={value === null} onChange={(e) => change(e.target.checked)} data-vsco-comp-average-input />
        <label htmlFor="vsco-comp-average" className="form-check-label">
          {tr("competence.struture.option.is.average.skills", "Calculer et utiliser la moyenne des niveaux pour chaque item de compétences")}
        </label>
      </div>
    </div>
  );
};

/** Niveaux de maîtrise par cycle (libellé, couleur, lettre) et calcul du niveau. */
export const Levels = ({ structureId, notify, cycles, cycleId, onSelectCycle, onReload }: Props) => {
  const tr = useCompT();
  // copie locale éditable des niveaux, indexée par `id_niveau` ; `saved` garde la dernière valeur enregistrée (et l'identifiant créé)
  const [levels, setLevels] = useState<Record<number, Niveau>>({});
  const saved = useRef<Record<number, Niveau>>({});
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    const flat = Object.fromEntries(cycles.flatMap((c) => c.niveaux).map((n) => [n.id_niveau, n]));
    setLevels(flat);
    saved.current = { ...flat };
  }, [cycles]);
  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);

  const save = async (idNiveau: number, current?: Niveau) => {
    const n = current ?? levels[idNiveau];
    const before = saved.current[idNiveau];
    if (!n || !before || sameNiveau(n, before) || !isValidLettre(n.lettre ?? "") || !isValidLibelle(n.libelle ?? "")) return;
    try {
      if (n.id === null) {
        const id = await levelService.create(structureId, niveauPayload(n));
        if (id === null) throw new Error("id");
        n.id = id;
      } else {
        await levelService.update(structureId, n.id, niveauPayload(n));
      }
      saved.current[idNiveau] = { ...n };
      setLevels((l) => ({ ...l, [idNiveau]: { ...l[idNiveau], id: n.id } }));
    } catch {
      notify(false, tr("evaluations.level.save.error", "Erreur lors de l'enregistrement du niveau de maîtrise"));
    }
  };

  const edit = (idNiveau: number, patch: Partial<Niveau>) => setLevels((l) => ({ ...l, [idNiveau]: { ...l[idNiveau], ...patch } }));

  const reset = async () => {
    try {
      await levelService.reset(structureId);
      await onReload();
      notify(true, tr("evaluations.perso.delete.success", "Niveaux de maîtrise réinitialisés."));
    } catch {
      notify(false, tr("evaluations.perso.delete.error", "Erreur lors de la réinitialisation des niveaux de maîtrise"));
    }
    setConfirmReset(false);
  };

  const cycle = cycles.find((c) => c.id_cycle === cycleId);
  const row = (c: Cycle) => c.niveaux.map((n) => levels[n.id_niveau] ?? n);

  return (
    <div data-vsco-comp-levels>
      <article className="mb-24">
        <div className="d-flex align-items-center justify-content-between flex-wrap gap-8 mb-12">
          <h3 className="h5 mb-0">{tr("evaluations.level", "Niveau de maitrise et calcul du niveau")}</h3>
          <Button type="button" color="tertiary" variant="outline" onClick={() => setConfirmReset(true)} data-vsco-comp-reset>
            {tr("evaluations.perso.delete", "Réinitialiser")}
          </Button>
        </div>
        <CycleTabs cycles={cycles} selected={cycleId} onSelect={onSelectCycle} label={tr("evaluations.level", "Niveau de maitrise et calcul du niveau")} />
        {cycle && (
          <div className="table-responsive">
            <table className="table text-center align-middle" data-vsco-comp-levels-table={cycle.id_cycle}>
              <thead>
                <tr>
                  {row(cycle).map((n) => (
                    <th key={n.id_niveau} scope="col">
                      <input
                        className="form-control fw-bold text-center"
                        aria-label={`${tr("evaluations.libelle", "Libellé")} ${n.default_lib ?? ""}`}
                        value={n.libelle ?? ""}
                        onChange={(e) => edit(n.id_niveau, { libelle: e.target.value })}
                        onBlur={() => save(n.id_niveau)}
                        data-vsco-comp-level-libelle={n.id_niveau}
                      />
                      {!isValidLibelle(n.libelle ?? "") && (
                        <div className="text-warning small" role="alert">
                          {tr("evaluation.skill.text.invalid", "Deux caractères maximum autorisés.")} ({MAX_LIBELLE})
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {row(cycle).map((n) => (
                    <td key={n.id_niveau}>
                      <input
                        type="color"
                        className="form-control form-control-color mx-auto"
                        aria-label={`${tr("viescolaire.couleur", "Couleur")} ${n.libelle ?? ""}`}
                        value={toColorInput(n.couleur)}
                        onChange={(e) => {
                          const next = { ...n, couleur: e.target.value };
                          edit(n.id_niveau, { couleur: e.target.value });
                          // enregistrement différé : le sélecteur de couleur émet un évènement à chaque déplacement
                          clearTimeout(timers.current[n.id_niveau]);
                          timers.current[n.id_niveau] = setTimeout(() => save(n.id_niveau, next), 500);
                        }}
                        data-vsco-comp-level-color={n.id_niveau}
                      />
                    </td>
                  ))}
                </tr>
                <tr>
                  {row(cycle).map((n) => (
                    <td key={n.id_niveau}>
                      <input
                        className="form-control text-center"
                        style={{ maxWidth: 80, margin: "0 auto" }}
                        aria-label={`${tr("viescolaire.lettre", "Lettre")} ${n.libelle ?? ""}`}
                        value={n.lettre ?? ""}
                        onChange={(e) => edit(n.id_niveau, { lettre: e.target.value })}
                        onBlur={() => save(n.id_niveau)}
                        data-vsco-comp-level-lettre={n.id_niveau}
                      />
                      {!isValidLettre(n.lettre ?? "") && (
                        <div className="text-warning small" role="alert" data-vsco-comp-level-warning>
                          {tr("evaluation.skill.text.invalid", `Maximum ${MAX_LETTRE} caractères.`)}
                        </div>
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
                  {row(cycle).map((n) => (
                    <td key={n.id_niveau}>
                      <Bubble color={n.couleur} text={n.lettre} />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
        {cycles.length === 0 && <p className="text-muted">{tr("evaluations.level.none", "Aucun niveau de maîtrise n'est disponible pour cet établissement.")}</p>}
      </article>

      <article>
        <h3 className="h5 mb-12">{tr("viescolaire.competence.structure.option.title.calculate.level.skills", "Calcul du niveau des items de compétences")}</h3>
        <AverageOption structureId={structureId} notify={notify} />
      </article>

      <Modal id="vsco-comp-reset" isOpen={confirmReset} onModalClose={() => setConfirmReset(false)} size="md">
        <Modal.Header onModalClose={() => setConfirmReset(false)}>{tr("evaluations.perso.delete", "Réinitialiser")}</Modal.Header>
        <Modal.Body>
          <p className="m-0">{tr("evaluations.perso.delete.message", "Attention, vous vous apprêtez à réinstaller toutes les valeurs par défaut des niveaux de compétences pour votre établissement. Souhaitez-vous continuer ?")}</p>
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" color="tertiary" variant="ghost" onClick={() => setConfirmReset(false)}>
            {tr("evaluations.perso.cancel", "Annuler")}
          </Button>
          <Button type="button" color="danger" onClick={reset} data-vsco-comp-reset-confirm>
            {tr("evaluations.perso.ok", "Ok")}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};
