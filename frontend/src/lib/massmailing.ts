/** Type de modèle de publipostage. */
export type TemplateType = "MAIL" | "PDF" | "SMS";

/** Modèle de texte (mail, PDF ou SMS) tel que le renvoie `GET /massmailing/settings/templates/:type`. */
export interface Template {
  id?: number;
  structure_id?: string;
  type: TemplateType;
  name: string;
  content: string;
  category: Category;
}

/** Catégories : à quels événements s'applique le modèle. */
export const CATEGORIES = ["ALL", "ABSENCES", "LATENESS", "PUNISHMENT_SANCTION"] as const;
export type Category = (typeof CATEGORIES)[number];

/** Un SMS ne dépasse pas 160 caractères. */
export const SMS_MAX_LENGTH = 160;

export const emptyTemplate = (type: TemplateType): Template => ({ type, name: "", content: "", category: "ALL" });

/** « Ajouter » est inactif tant que le nom ET le contenu sont vides (une seule des deux valeurs suffit à l'AngularJS). */
export const canSubmit = (t: Template): boolean => !(t.name.trim() === "" && stripHtml(t.content).trim() === "" && t.content.trim() === "");

/** Texte brut d'un contenu HTML : `<p>Bonjour</p>` → `Bonjour`. */
export const stripHtml = (html: string): string => html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();

/** Le contenu d'un SMS est tronqué à 160 caractères (on refuse la frappe au-delà). */
export const limitSms = (content: string): string => content.slice(0, SMS_MAX_LENGTH);

/** Modèles triés par nom. */
export const sortTemplates = (list: Template[]): Template[] => [...list].sort((a, b) => a.name.localeCompare(b.name));

/** Corps de création : le type et l'établissement sont ajoutés au brouillon. */
export const createBody = (t: Template, structureId: string) => ({ ...t, structure_id: structureId, type: t.type });
