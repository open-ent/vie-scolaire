import { Button, Modal } from "@open-ent/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Cycle } from "../../lib/competencesLevels";
import { isReadOnlyProposition, MAX_PROPOSITION } from "../../lib/competencesMisc";
import { programService } from "../../services/competences.service";
import { SectionProps, useCompT } from "./shared";

interface Props extends SectionProps {
  cycles: Cycle[];
}

/** Éléments du programme : propositions de l'établissement par cycle, domaine d'enseignement et sous-domaine. */
export const ProgramElements = ({ structureId, notify, cycles }: Props) => {
  const tr = useCompT();
  const qc = useQueryClient();
  const [cycle, setCycle] = useState("");
  const [domaine, setDomaine] = useState("");
  const [adding, setAdding] = useState<{ id: number; libelle: string } | null>(null);
  const [text, setText] = useState("");
  const [edits, setEdits] = useState<Record<number, string>>({});

  const domaines = useQuery({ queryKey: ["comp-prog-domaines", cycle], queryFn: () => programService.domaines(Number(cycle)), enabled: cycle !== "" });
  const treeKey = ["comp-prog-tree", structureId, domaine];
  const tree = useQuery({
    queryKey: treeKey,
    enabled: domaine !== "",
    queryFn: async () => {
      const sous = await programService.sousDomaines(Number(domaine));
      return Promise.all(sous.map(async (s) => ({ ...s, propositions: await programService.propositions(s.id, structureId) })));
    },
  });
  const reload = () => qc.invalidateQueries({ queryKey: treeKey });

  const create = async () => {
    if (!adding || text.trim() === "") return;
    const target = adding;
    setAdding(null);
    setText("");
    try {
      await programService.create({ libelle: text, id_sous_domaine: target.id, id_etablissement: structureId });
    } catch {
      notify(false, tr("viescolaire.program.error", "Erreur lors de l'ajout de la proposition"));
    }
    await reload();
  };

  const rename = async (id: number, before: string) => {
    const value = edits[id];
    setEdits(({ [id]: _drop, ...rest }) => rest);
    if (value === undefined || value === before || value.trim() === "") return;
    try {
      await programService.update({ libelle: value, id_proposition: id });
    } catch {
      notify(false, tr("viescolaire.program.error", "Erreur lors de la modification de la proposition"));
    }
    await reload();
  };

  const remove = async (id: number) => {
    try {
      await programService.remove(id);
    } catch {
      notify(false, tr("viescolaire.program.error", "Erreur lors de la suppression de la proposition"));
    }
    await reload();
  };

  return (
    <div data-vsco-comp-program>
      <h3 className="h5 mb-12">{tr("viescolaire.conference.elements", "Éléments du programme")}</h3>
      <div className="d-flex gap-16 flex-wrap mb-16">
        <select
          className="form-select"
          style={{ maxWidth: 260 }}
          aria-label={tr("viescolaire.utils.cycle", "Cycle")}
          value={cycle}
          onChange={(e) => {
            setCycle(e.target.value);
            setDomaine("");
          }}
          data-vsco-comp-program-cycle
        >
          <option value="" disabled>
            {tr("viescolaire.utils.cycle", "Cycle")}
          </option>
          {cycles.map((c) => (
            <option key={c.id_cycle} value={c.id_cycle}>
              {c.libelle}
            </option>
          ))}
        </select>
        <select className="form-select" style={{ maxWidth: 360 }} aria-label={tr("viescolaire.utils.domaines.enseignements", "Domaines d'enseignement")} disabled={cycle === ""} value={domaine} onChange={(e) => setDomaine(e.target.value)} data-vsco-comp-program-domaine>
          <option value="" disabled>
            {tr("viescolaire.utils.domaines.enseignements", "Domaines d'enseignement")}
          </option>
          {(domaines.data ?? []).map((d) => (
            <option key={d.id} value={d.id}>
              {d.libelle}
            </option>
          ))}
        </select>
      </div>
      {(domaines.isLoading && cycle !== "") || tree.isLoading ? <p className="text-muted">{tr("viescolaire.loading", "Chargement…")}</p> : null}
      {(domaines.isError || tree.isError) && (
        <p className="text-danger" role="alert">
          {tr("evaluations.elements.get.error", "Une erreur est survenue lors de la récupération des éléments")}
        </p>
      )}
      {cycle !== "" && domaine !== "" && (
        <ul className="list-unstyled" data-vsco-comp-program-list>
          {(tree.data ?? []).map((s) => (
            <li key={s.id} className="mb-16" data-vsco-comp-program-sous={s.libelle}>
              <div className="d-flex align-items-center justify-content-between gap-8 mb-8">
                <h4 className="h6 mb-0">{s.libelle}</h4>
                <Button type="button" color="primary" onClick={() => setAdding({ id: s.id, libelle: s.libelle })} data-vsco-comp-program-add>
                  {tr("viescolaire.program.add", "Ajouter un élément à ce sous-domaine")}
                </Button>
              </div>
              <ul className="list-unstyled ps-16">
                {s.propositions.map((p) => {
                  const ro = isReadOnlyProposition(p);
                  return (
                    <li key={p.id} className="d-flex align-items-center gap-8 mb-4" data-vsco-comp-program-proposition>
                      <input
                        className="form-control fst-italic"
                        aria-label={p.libelle}
                        value={edits[p.id] ?? p.libelle}
                        disabled={ro}
                        onChange={(e) => setEdits({ ...edits, [p.id]: e.target.value })}
                        onBlur={() => rename(p.id, p.libelle)}
                        data-vsco-comp-program-input
                      />
                      {!ro && (
                        <button type="button" className="btn btn-sm btn-outline-danger" title={tr("evaluations.test.delete", "Supprimer")} aria-label={`${tr("evaluations.test.delete", "Supprimer")} ${p.libelle}`} onClick={() => remove(p.id)} data-vsco-comp-program-delete>
                          🗑
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      )}

      <Modal id="vsco-comp-program-add" isOpen={!!adding} onModalClose={() => { setAdding(null); setText(""); }} size="md">
        <Modal.Header onModalClose={() => { setAdding(null); setText(""); }}>{tr("viescolaire.program.add", "Ajouter un élément à ce sous-domaine")}</Modal.Header>
        <Modal.Body>
          <input
            autoFocus
            className="form-control"
            maxLength={MAX_PROPOSITION}
            aria-label={tr("viescolaire.program.add", "Ajouter un élément à ce sous-domaine")}
            placeholder={tr("viescolaire.program.add", "Ajouter un élément à ce sous-domaine")}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
            data-vsco-comp-program-text
          />
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" color="tertiary" variant="ghost" onClick={() => { setAdding(null); setText(""); }}>
            {tr("competences.cancel", "Annuler")}
          </Button>
          <Button type="button" color="primary" disabled={text.trim() === ""} onClick={create} data-vsco-comp-program-save>
            {tr("viescolaire.utils.save", "Enregistrer")}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};
