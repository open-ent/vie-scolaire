import { Matiere, SubTopic } from "./services";

/** Sous-matières cochées au départ : celles déjà rattachées à la matière du service d'où l'on part. */
export const initialSelection = (matiere: Matiere | undefined, all: SubTopic[]): number[] => {
  const linked = new Set((matiere?.sous_matieres ?? []).map((s) => s.id_type_sousmatiere));
  return all.filter((s) => linked.has(s.id)).map((s) => s.id);
};

/** Matières proposables à l'ajout : celles qui ne sont pas déjà dans la liste. */
export const addableMatieres = (all: Matiere[], current: string[]): Matiere[] =>
  all.filter((m) => !current.includes(m.id)).sort((a, b) => a.name.localeCompare(b.name));

/**
 * Matières cochées qui n'ont encore AUCUNE sous-matière alors qu'on en rattache : l'AngularJS demande confirmation
 * (leurs évaluations passeront sur la première sous-matière cochée).
 */
export const needsConfirmation = (matieres: Matiere[], checkedMatieres: string[], selectedSubTopics: number[]): Matiere[] =>
  selectedSubTopics.length === 0 ? [] : matieres.filter((m) => checkedMatieres.includes(m.id) && (m.sous_matieres ?? []).length === 0);

/** Sous-matière par défaut citée dans la confirmation : la première cochée, dans l'ordre de la liste. */
export const defaultSubTopic = (all: SubTopic[], selected: number[]): SubTopic | undefined => all.find((s) => selected.includes(s.id));

/** Corps de `POST /viescolaire/types/sousmatieres/relations`. */
export const relationsPayload = (checkedMatieres: string[], selectedSubTopics: number[]) => ({ topics: checkedMatieres, subTopics: selectedSubTopics });

/** Un libellé vide est refusé ; en modification, un libellé vidé reprend l'ancien. */
export const keepLabel = (next: string, previous: string): string => (next.trim() === "" ? previous : next.trim());
