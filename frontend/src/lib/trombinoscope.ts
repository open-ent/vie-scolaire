/** Élève de la liste du trombinoscope. */
export interface Student {
  id: string;
  displayName: string;
  audienceName?: string;
}

/** Élève ou classe trouvé par la recherche (le libellé ajoute la classe : « DUPONT Anne - 6A »). */
export interface Found {
  id: string;
  displayName?: string;
  name?: string;
  idClasse?: string[];
}

export interface Report {
  id?: number;
  content: string;
  createdAt: string;
}

export interface Failure {
  id: string;
  path: string;
  pictureId: string;
  structureId: string;
}

/** « 2026$6A » → « 6A » : le code de classe est préfixé par celui de l'établissement. */
const className = (id: string): string => id.split("$")[1] ?? id;

/** Libellé d'un résultat de recherche : l'élève avec sa ou ses classes, ou le nom de la classe. */
export const foundLabel = (f: Found): string => {
  const name = f.displayName ?? f.name ?? "";
  return f.idClasse && f.idClasse.length > 0 ? `${name} - ${f.idClasse.map(className).join(",")}` : name;
};

/** Élèves regroupés par classe (`audienceName`), classes triées par nom, élèves par nom affiché. */
export const groupByClass = (students: Student[]): Array<{ name: string; students: Student[] }> => {
  const map = new Map<string, Student[]>();
  for (const s of students) map.set(s.audienceName ?? "", [...(map.get(s.audienceName ?? "") ?? []), s]);
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, list]) => ({ name, students: [...list].sort((a, b) => a.displayName.localeCompare(b.displayName)) }));
};

/** Paramètres de `GET /viescolaire/structures/:id/students` : page, élèves et classes filtrés, filtres croisés. */
export const studentsQuery = (page: number, studentIds: string[], groupNames: string[]): string => {
  const p = new URLSearchParams({ crossFilter: "true", page: String(page) });
  if (studentIds.length > 0) p.set("studentId", studentIds.join(","));
  if (groupNames.length > 0) p.set("groupName", groupNames.join(","));
  return `?${p.toString()}`;
};

/** Titre d'un rapport d'import : « Import du 12/10/2026 à 14:30 ». */
export const reportTitle = (r: Report, from = "Import du ", to = " à "): string => {
  const d = new Date(r.createdAt);
  if (Number.isNaN(d.getTime())) return from.trim();
  return `${from}${d.toLocaleDateString("fr-FR")}${to}${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
};

/** Cinq rapports par défaut, tous si « voir plus ». */
export const visibleReports = (reports: Report[], all: boolean): Report[] => (all ? reports : reports.slice(0, 5));

/** Avatars de l'ENT utilisés quand la case est cochée : le réglage serveur `active` est son contraire. */
export const useEntAvatars = (serverActive: boolean): boolean => !serverActive;
