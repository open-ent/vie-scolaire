import { Button } from "@open-ent/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { dropRange, moveRange, prepareSubjects, RankedSubject, reshuffleOk, reshufflePayload } from "../../lib/competencesMisc";
import { subjectRankService } from "../../services/competences.service";
import { SectionProps, useCompT } from "./shared";

/** Ordre d'affichage des matières : boutons monter / descendre ou glisser-déposer ; retour à l'ordre par défaut. */
export const SubjectOrder = ({ structureId, notify }: SectionProps) => {
  const tr = useCompT();
  const qc = useQueryClient();
  const key = ["comp-subject-order", structureId];
  const list = useQuery({ queryKey: key, queryFn: async () => prepareSubjects(await subjectRankService.list(structureId)) });
  const [busy, setBusy] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const failure = tr("evaluations.service.error.matiere", "Erreur lors de la récupération des matières.");

  const reshuffle = async (s: RankedSubject, range: { indexStart: number; indexEnd: number }) => {
    setBusy(true);
    try {
      const res = await subjectRankService.reshuffle(structureId, reshufflePayload(structureId, s.id, range));
      if (!reshuffleOk(res)) throw new Error("rank");
    } catch {
      notify(false, failure);
    }
    await qc.invalidateQueries({ queryKey: key });
    setBusy(false);
  };

  const reset = async () => {
    setBusy(true);
    try {
      await subjectRankService.reset(structureId);
    } catch {
      notify(false, failure);
    }
    await qc.invalidateQueries({ queryKey: key });
    setBusy(false);
  };

  const drop = (dropIndex: number | undefined) => {
    const dragged = (list.data ?? []).find((s) => s.id === dragId);
    setDragId(null);
    if (!dragged) return;
    const range = dropRange(dragged.rank, dropIndex);
    if (range) reshuffle(dragged, range);
  };

  const subjects = list.data ?? [];
  return (
    <div data-vsco-comp-order>
      <h3 className="h5 mb-8">{tr("evaluation.orderShowSubject.title", "Organiser les matières")}</h3>
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-8 mb-12">
        <p className="mb-0">{tr("evaluation.orderShowSubject.description", "Cet écran permet d'organiser l'ordre dans lequel sont affichées les matières sur les différents écrans et exports de l'application Compétences. Par défaut, les matières sont organisées par ordre alphabétique.")}</p>
        <Button type="button" color="tertiary" variant="outline" disabled={busy} onClick={reset} data-vsco-comp-order-reset>
          {tr("evaluations.perso.delete", "Réinitialiser")}
        </Button>
      </div>
      {(list.isLoading || busy) && (
        <p className="text-muted" role="status" data-vsco-comp-order-loader>
          {tr("viescolaire.loading", "Chargement…")}
        </p>
      )}
      {list.isError && (
        <p className="text-danger" role="alert">
          {failure}
        </p>
      )}
      {!busy && (
        <ul className="list-unstyled" data-vsco-comp-order-list>
          {dragId && (
            <li className="border border-dashed rounded mb-4" style={{ minHeight: 12 }} onDragOver={(e) => e.preventDefault()} onDrop={() => drop(undefined)} aria-hidden="true" />
          )}
          {subjects.map((s, i) => (
            <li
              key={s.id}
              className={`d-flex align-items-center gap-8 border rounded p-8 mb-4${dragId === s.id ? " opacity-50" : ""}`}
              draggable
              onDragStart={() => setDragId(s.id)}
              onDragEnd={() => setDragId(null)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => drop(i)}
              data-vsco-comp-order-row={s.name}
            >
              <span aria-hidden="true" style={{ cursor: "grab" }}>
                ⠿
              </span>
              <span className="flex-grow-1">
                {s.name} ({s.code} - {s.source})
              </span>
              <button type="button" className="btn btn-sm btn-outline-secondary" aria-label={`${tr("viescolaire.comp.move.up", "Monter")} ${s.name}`} disabled={i === 0} onClick={() => reshuffle(s, moveRange(i, "up"))} data-vsco-comp-order-up>
                ↑
              </button>
              <button type="button" className="btn btn-sm btn-outline-secondary" aria-label={`${tr("viescolaire.comp.move.down", "Descendre")} ${s.name}`} disabled={i === subjects.length - 1} onClick={() => reshuffle(s, moveRange(i, "down"))} data-vsco-comp-order-down>
                ↓
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
