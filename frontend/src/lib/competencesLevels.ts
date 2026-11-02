/** Niveau de maîtrise d'un cycle, tel que le renvoie `GET /competences/maitrise/level/:structure`. */
export interface Niveau {
  /** Null tant que l'établissement n'a pas personnalisé ce niveau (le niveau par défaut s'affiche alors). */
  id: number | null;
  id_niveau: number;
  id_cycle: number;
  cycle: string;
  ordre: number | string;
  /** Clé de la couleur par défaut (`blue`, `red`…). */
  default?: string;
  default_lib?: string | null;
  libelle: string | null;
  lettre: string | null;
  couleur: string | null;
  id_etablissement?: string | null;
}

/** Cycle et ses niveaux, du plus haut au plus bas. */
export interface Cycle {
  id_cycle: number;
  libelle: string;
  niveaux: Niveau[];
}

export const DEFAULT_COLORS: Record<string, string> = {
  blue: "#97BBCD",
  red: "#e13a3a",
  green: "#46bfaf",
  yellow: "#ecbe30",
  grey: "#5f5f5f",
  orange: "#FF8500",
  unevaluated: "#5f5f5f",
};

/** Longueurs maximales de l'AngularJS : libellé 36 caractères, lettre 2. */
export const MAX_LIBELLE = 36;
export const MAX_LETTRE = 2;

/** Valeurs par défaut quand l'établissement n'a rien personnalisé : couleur, lettre « espace », libellé d'origine. */
export const normalizeNiveau = (n: Niveau, structureId: string): Niveau => ({
  ...n,
  couleur: n.couleur ?? DEFAULT_COLORS[n.default ?? ""] ?? "#5f5f5f",
  lettre: n.lettre ?? " ",
  libelle: n.libelle ?? n.default_lib ?? "",
  id_etablissement: structureId,
});

/**
 * Cycles dans l'ordre de leur identifiant ; niveaux du plus haut au plus bas.
 * Ex. niveaux d'ordre 1, 2, 3, 4 → affichés 4, 3, 2, 1.
 */
export const buildCycles = (levels: Niveau[], structureId: string): Cycle[] => {
  const byCycle = new Map<number, Niveau[]>();
  for (const l of levels.map((x) => normalizeNiveau(x, structureId))) byCycle.set(l.id_cycle, [...(byCycle.get(l.id_cycle) ?? []), l]);
  return [...byCycle.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([id, niveaux]) => ({
      id_cycle: id,
      libelle: niveaux[0].cycle,
      niveaux: [...niveaux].sort((a, b) => Number(b.ordre) - Number(a.ordre)),
    }));
};

export const isValidLettre = (lettre: string): boolean => lettre.length <= MAX_LETTRE;
export const isValidLibelle = (libelle: string): boolean => libelle.length <= MAX_LIBELLE;

/** Corps d'enregistrement d'un niveau (création si `id` est nul, modification sinon). */
export const niveauPayload = (n: Niveau) => ({
  lettre: n.lettre,
  couleur: n.couleur,
  libelle: n.libelle,
  ...(n.id === null ? {} : { id: n.id }),
  id_niveau: n.id_niveau,
  id_etablissement: n.id_etablissement,
});

/** Deux niveaux ont les mêmes valeurs éditables (évite un enregistrement inutile à la perte du focus). */
export const sameNiveau = (a: Niveau, b: Niveau): boolean => a.libelle === b.libelle && a.lettre === b.lettre && a.couleur === b.couleur;

/** Couleur au format attendu par `<input type="color">` (`#rrggbb`), noir à défaut. */
export const toColorInput = (c: string | null | undefined): string => (c && /^#[0-9a-fA-F]{6}$/.test(c) ? c.toLowerCase() : "#000000");

/** Texte noir ou blanc selon la clarté du fond, pour la pastille : fond jaune → noir, fond rouge → blanc. */
export const readableText = (background: string): string => {
  const hex = toColorInput(background).slice(1);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? "#000000" : "#ffffff";
};

/** Cycle sélectionné après un rechargement : celui qui l'était encore, sinon le premier. */
export const pickCycle = (cycles: Cycle[], selected: number | null): number | null =>
  cycles.some((c) => c.id_cycle === selected) ? selected : cycles[0]?.id_cycle ?? null;
