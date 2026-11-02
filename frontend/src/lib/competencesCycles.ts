/** Classe ou groupe tel que le renvoie `GET /viescolaire/classes` ; `id_cycle` nul ou 0 = non rattaché. */
export interface Groupe {
  id: string;
  name: string;
  /** 0 classe, 1 groupe d'enseignement, 2 groupe manuel. */
  type_groupe: number;
  id_cycle?: number | null;
}

export const GROUP_TYPE_LABELS: Array<{ type: number; label: string }> = [
  { type: 0, label: "Classe" },
  { type: 1, label: "Groupe d'enseignement" },
  { type: 2, label: "Groupe manuel" },
];

/** Filtre de la liste : types cochés, cycle (undefined = tous, null = non rattaché), début du nom. */
export interface LinkFilter {
  types: Record<number, boolean>;
  idCycle: number | null | undefined;
  name: string;
}

export const allTypes = (): Record<number, boolean> => ({ 0: true, 1: true, 2: true });

export const isUnlinked = (g: Groupe): boolean => g.id_cycle == null || g.id_cycle === 0;

/** Classes affichées, triées par type puis par nom. Ex. nom « 6 » → 6A, 6B (début du nom, sans casse ; « * » = tout). */
export const filterGroupes = (list: Groupe[], f: LinkFilter): Groupe[] => {
  const prefix = f.name.trim() === "*" ? "" : f.name.trim().toUpperCase();
  return list
    .filter((g) => {
      if (!f.types[g.type_groupe]) return false;
      if (f.idCycle !== undefined && (f.idCycle === null ? !isUnlinked(g) : g.id_cycle !== f.idCycle)) return false;
      return g.name.toUpperCase().startsWith(prefix);
    })
    .sort((a, b) => a.type_groupe - b.type_groupe || a.name.localeCompare(b.name));
};

/** Choix initial du rattachement : le cycle de la première classe sélectionnée, sinon rien. */
export const initialChoice = (selected: Groupe[]): string => (selected[0] && !isUnlinked(selected[0]) ? String(selected[0].id_cycle) : selected[0] ? "0" : "");

/** Classes dont le cycle change réellement (celles déjà au bon cycle sont laissées de côté). */
export const toUpdate = (selected: Groupe[], choice: number): Groupe[] => selected.filter((g) => (isUnlinked(g) ? 0 : (g.id_cycle as number)) !== choice);

/** Choix invalide (aucun bouton radio coché). */
export const parseChoice = (choice: string): number | null => (choice === "" || Number.isNaN(parseInt(choice, 10)) ? null : parseInt(choice, 10));

export const checkPayload = (changed: Groupe[], idCycle: number) => ({ idClasses: changed.map((g) => g.id), id_cycle: idCycle });
export const savePayload = (changed: Groupe[], idCycle: number) => ({ idClasses: changed.map((g) => g.id), id_cycle: idCycle, typesGroupes: changed.map((g) => g.type_groupe) });

/** Libellé du cycle d'un groupe, ou null s'il n'est pas rattaché. */
export const cycleLabel = (cycles: Array<{ id_cycle: number; libelle: string }>, id: number | null | undefined): string | null =>
  isUnlinked({ id: "", name: "", type_groupe: 0, id_cycle: id }) ? null : cycles.find((c) => c.id_cycle === id)?.libelle ?? null;

/** Tout cocher / décocher dans la liste affichée. */
export const toggleAll = (selected: Set<string>, shown: Groupe[], on: boolean): Set<string> => {
  const next = new Set(selected);
  for (const g of shown) on ? next.add(g.id) : next.delete(g.id);
  return next;
};
