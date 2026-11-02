import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Visibility, VISIBILITY_ID, VISIBILITY_OPTIONS } from "../../lib/competencesMisc";
import { visibilityService } from "../../services/competences.service";
import { SectionProps, useCompT } from "./shared";

interface Props extends SectionProps {
  kind: keyof typeof VISIBILITY_ID;
}

/**
 * Visibilité sur le BFC : de la moyenne calculée par domaine (kind = average) ou du barème du DNB (kind = dnb).
 * Trois choix : caché pour tous, caché pour les enseignants, visible pour tous.
 */
export const BfcVisibility = ({ structureId, notify, kind }: Props) => {
  const tr = useCompT();
  const qc = useQueryClient();
  const id = VISIBILITY_ID[kind];
  const key = ["comp-visibility", structureId, id];
  const current = useQuery({ queryKey: key, queryFn: () => visibilityService.get(structureId, id) });
  const [saving, setSaving] = useState(false);

  const change = async (value: Visibility) => {
    setSaving(true);
    try {
      await visibilityService.set(structureId, id, value);
      qc.setQueryData(key, value);
    } catch {
      notify(false, tr("evaluation.bfc.visibility.error", "Erreur lors de l'enregistrement de la visibilité"));
    }
    setSaving(false);
  };

  return (
    <fieldset className="border-0 p-0" disabled={saving || current.isLoading} data-vsco-comp-visibility={kind}>
      <legend className="visually-hidden">{kind === "average" ? tr("evaluation.bfc.visibility.average", "Visibilité du niveau calculé du BFC par domaine") : tr("evaluation.bfc.visibility.baremeBFC", "Visibilité du barème DNB affiché sur le BFC ")}</legend>
      {current.isError && (
        <p className="text-danger" role="alert">
          {tr("evaluation.bfc.visibility.error", "Erreur lors de la récupération de la visibilité")}
        </p>
      )}
      {VISIBILITY_OPTIONS.map((o) => (
        <div className="form-check" key={o.value}>
          <input id={`vsco-comp-vis-${kind}-${o.value}`} type="radio" name={`vsco-comp-vis-${kind}`} className="form-check-input" checked={current.data === o.value} onChange={() => change(o.value)} data-vsco-comp-visibility-option={o.value} />
          <label htmlFor={`vsco-comp-vis-${kind}-${o.value}`} className="form-check-label">
            {tr(o.key, o.fallback)}
          </label>
        </div>
      ))}
    </fieldset>
  );
};
