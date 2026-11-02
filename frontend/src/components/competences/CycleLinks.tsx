import { Button, Modal } from "@open-ent/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { allTypes, checkPayload, cycleLabel, filterGroupes, GROUP_TYPE_LABELS, Groupe, initialChoice, parseChoice, savePayload, toggleAll, toUpdate } from "../../lib/competencesCycles";
import { Cycle } from "../../lib/competencesLevels";
import { cycleLinkService } from "../../services/competences.service";
import { SectionProps, useCompT } from "./shared";

interface Props extends SectionProps {
  cycles: Cycle[];
}

/** Rattachement des classes et groupes à un cycle (choisit les niveaux de maîtrise et les items qui leur sont proposés). */
export const CycleLinks = ({ structureId, notify, cycles }: Props) => {
  const tr = useCompT();
  const qc = useQueryClient();
  const key = ["comp-groupes", structureId];
  const list = useQuery({ queryKey: key, queryFn: () => cycleLinkService.groupes(structureId) });
  const [types, setTypes] = useState(allTypes());
  const [idCycle, setIdCycle] = useState<number | null | undefined>(undefined);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [chooser, setChooser] = useState(false);
  const [choice, setChoice] = useState("");
  const [devoirs, setDevoirs] = useState<Array<{ name: string; classe: string }> | null>(null);

  const shown = useMemo(() => filterGroupes(list.data ?? [], { types, idCycle, name }), [list.data, types, idCycle, name]);
  const chosen: Groupe[] = shown.filter((g) => selected.has(g.id));
  const noCycle = tr("viescolaire.utils.no.cycle", "aucun cycle rattaché");
  const cycleOf = (c: number | null | undefined) => cycleLabel(cycles, c) ?? noCycle;

  const save = async (changed: Groupe[], target: number) => {
    try {
      await cycleLinkService.save(savePayload(changed, target));
      notify(true, target !== 0 ? tr("evaluation.link.success", "Rattachement effectué") : tr("evaluation.unlink.success", "Détachement effectué"));
      setSelected(new Set());
      setChooser(false);
      setDevoirs(null);
      await qc.invalidateQueries({ queryKey: key });
    } catch {
      notify(false, tr("evaluation.link.error.request", "Une erreur est survenue lors du rattachement."));
    }
  };

  const validate = async () => {
    const target = parseChoice(choice);
    if (target === null) return notify(false, tr("evaluation.link.no.cycle", "Veuillez choisir un cycle."));
    const changed = toUpdate(chosen, target);
    if (changed.length === 0) {
      // aucune classe ne change de cycle : on désélectionne et on ferme
      setSelected(new Set());
      return setChooser(false);
    }
    try {
      const found = await cycleLinkService.check(structureId, checkPayload(changed, target));
      if (found.length > 0) {
        setDevoirs(found.map((d) => ({ name: d.name, classe: (list.data ?? []).find((g) => g.id === d.id_groupe)?.name ?? "" })));
        setChooser(false);
      } else {
        await save(changed, target);
      }
    } catch {
      notify(false, tr("evaluation.link.error.request", "Une erreur est survenue lors du rattachement."));
    }
  };

  const target = parseChoice(choice);
  const allShownSelected = shown.length > 0 && shown.every((g) => selected.has(g.id));
  const first = chosen[0];

  return (
    <div data-vsco-comp-links>
      <h3 className="h5 mb-12">{tr("evaluation.link.group.cycle", "Rattachement des cycles")}</h3>
      <input className="form-control mb-12" style={{ maxWidth: 420 }} type="search" placeholder={tr("evaluation.link.search.class", "Rechercher une classe")} aria-label={tr("evaluation.link.search.class", "Rechercher une classe")} value={name} onChange={(e) => setName(e.target.value)} data-vsco-comp-link-search />
      <ul className="nav nav-tabs mb-12" role="tablist" aria-label={tr("evaluation.link.group.cycle", "Rattachement des cycles")}>
        {[
          { id: undefined, label: tr("all", "Tous") },
          ...cycles.map((c) => ({ id: c.id_cycle as number | undefined, label: c.libelle })),
          { id: null, label: tr("evaluation.link.notset", "Non itinialisés") },
        ].map((t) => (
          <li className="nav-item" role="presentation" key={String(t.id)}>
            <button type="button" role="tab" aria-selected={idCycle === t.id} className={`nav-link${idCycle === t.id ? " active" : ""}`} onClick={() => setIdCycle(t.id as number | null | undefined)} data-vsco-comp-link-cycle={String(t.id)}>
              {t.label}
            </button>
          </li>
        ))}
      </ul>

      <div className="d-flex gap-16 flex-wrap">
        <ul className="list-unstyled m-0" style={{ minWidth: 200 }} aria-label={tr("evaluation.link.group.classes", "Toutes les classes")}>
          {GROUP_TYPE_LABELS.map((t) => (
            <li key={t.type}>
              <label className="d-flex gap-8 align-items-center">
                <input type="checkbox" className="form-check-input m-0" checked={types[t.type]} onChange={() => setTypes((s) => ({ ...s, [t.type]: !s[t.type] }))} data-vsco-comp-link-type={t.type} />
                {t.label}
              </label>
            </li>
          ))}
        </ul>
        <div className="flex-grow-1">
          {list.isLoading && <p className="text-muted">{tr("viescolaire.loading", "Chargement…")}</p>}
          {list.isError && (
            <p className="text-danger" role="alert">
              {tr("viescolaire.get.fail", "Erreur lors de la récupération")}
            </p>
          )}
          {shown.length > 0 && (
            <label className="d-flex gap-8 align-items-center fw-bold mb-8">
              <input type="checkbox" className="form-check-input m-0" checked={allShownSelected} onChange={(e) => setSelected((s) => toggleAll(s, shown, e.target.checked))} data-vsco-comp-link-all />
              {tr("evaluation.link.group.classes", "Toutes les classes")}
            </label>
          )}
          <ul className="list-unstyled" data-vsco-comp-link-list>
            {shown.map((g) => (
              <li key={g.id} className="py-4 border-bottom" data-vsco-comp-link-row={g.name}>
                <label className="d-flex gap-8 align-items-center m-0">
                  <input
                    type="checkbox"
                    className="form-check-input m-0"
                    checked={selected.has(g.id)}
                    onChange={(e) =>
                      setSelected((s) => {
                        const n = new Set(s);
                        e.target.checked ? n.add(g.id) : n.delete(g.id);
                        return n;
                      })
                    }
                    data-vsco-comp-link-check
                  />
                  <span title={g.name}>{g.name}</span>
                  <span>- {cycleOf(g.id_cycle)}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {chosen.length > 0 && (
        <div className="position-sticky bottom-0 bg-white border-top py-8" data-vsco-comp-link-bar>
          <Button
            type="button"
            color="primary"
            onClick={() => {
              setChoice(initialChoice(chosen));
              setChooser(true);
            }}
            data-vsco-comp-link-edit
          >
            {!first || !first.id_cycle ? tr("evaluation.link.group.edit", "Rattacher le cycle") : tr("item.modify", "Modifier")}
          </Button>
        </div>
      )}

      <Modal id="vsco-comp-link-choose" isOpen={chooser} onModalClose={() => setChooser(false)} size="md">
        <Modal.Header onModalClose={() => setChooser(false)}>{tr("evaluation.link.group.lightbox.title", "Rattachement cycle")}</Modal.Header>
        <Modal.Body>
          <fieldset className="border-0 p-0">
            {cycles.map((c) => (
              <div className="form-check" key={c.id_cycle}>
                <input id={`vsco-comp-link-c${c.id_cycle}`} type="radio" name="vsco-comp-link-choice" className="form-check-input" checked={choice === String(c.id_cycle)} onChange={() => setChoice(String(c.id_cycle))} data-vsco-comp-link-choice={c.id_cycle} />
                <label htmlFor={`vsco-comp-link-c${c.id_cycle}`} className="form-check-label">
                  {c.libelle}
                </label>
              </div>
            ))}
            <div className="form-check">
              <input id="vsco-comp-link-none" type="radio" name="vsco-comp-link-choice" className="form-check-input" checked={choice === "0"} onChange={() => setChoice("0")} data-vsco-comp-link-choice="0" />
              <label htmlFor="vsco-comp-link-none" className="form-check-label">
                {tr("none", "Aucun")}
              </label>
            </div>
          </fieldset>
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" color="tertiary" variant="ghost" onClick={() => setChooser(false)}>
            {tr("competences.cancel", "Annuler")}
          </Button>
          <Button type="button" color="primary" onClick={validate} data-vsco-comp-link-save>
            {tr("viescolaire.utils.save", "Enregistrer")}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal id="vsco-comp-link-devoirs" isOpen={!!devoirs} onModalClose={() => setDevoirs(null)} size="md">
        <Modal.Header onModalClose={() => setDevoirs(null)}>
          {target !== 0 ? `${tr("evaluation.link.group.to", "Rattachement au ")}${cycleOf(target)}` : tr("evaluation.unlink.group.title", "Retirer un groupe ou une classe d'un cycle")}
        </Modal.Header>
        <Modal.Body>
          <p>{target !== 0 ? tr("evaluation.link.message", "Attention une ou plusieurs classes vont changer de cycle. Les devoirs suivants ne seront pas conservés :") : tr("evaluation.unlink.group.message", "Attention, vous allez retirer un cycle sur un groupe ou une classe qui contient des devoirs évalués. Les devoirs suivants ne seront pas conservés :")}</p>
          <ul data-vsco-comp-link-devoirs>
            {(devoirs ?? []).map((d, i) => (
              <li key={i}>
                {d.name} - ({d.classe})
              </li>
            ))}
          </ul>
          <p className="m-0">{tr("evaluations.devoir.confirmation.question", "Souhaitez vous continuer ?")}</p>
        </Modal.Body>
        <Modal.Footer>
          <Button
            type="button"
            color="tertiary"
            variant="ghost"
            onClick={() => {
              setDevoirs(null);
              setChooser(true);
            }}
          >
            {tr("competences.cancel", "Annuler")}
          </Button>
          <Button type="button" color="danger" onClick={() => target !== null && save(toUpdate(chosen, target), target)} data-vsco-comp-link-confirm>
            {tr("evaluations.perso.ok", "Ok")}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};
