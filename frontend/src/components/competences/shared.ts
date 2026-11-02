import { useTranslation } from "react-i18next";

/** Traduction : les clés viennent du module Compétences d'abord, puis de Vie scolaire (celles de l'AngularJS fusionnent les deux). */
export type Tr = (key: string, fallback: string, vars?: Record<string, string | number>) => string;

/**
 * `useSuspense: false` : le fichier de traduction du module Compétences se charge à la demande,
 * sans bloquer l'écran ; en attendant, le texte par défaut s'affiche.
 */
export const useCompT = (): Tr => {
  const { t } = useTranslation(["competences", "viescolaire"], { useSuspense: false });
  return (key, fallback, vars) => t(key, { ns: ["competences", "viescolaire"], defaultValue: fallback, ...vars }) as string;
};

/** Message de retour (succès ou erreur) affiché en tête de l'onglet. */
export type Notify = (ok: boolean, text: string) => void;

export interface SectionProps {
  structureId: string;
  notify: Notify;
}

