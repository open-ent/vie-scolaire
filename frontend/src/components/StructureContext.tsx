import { createContext, useContext } from "react";

export interface Structure {
  id: string;
  name: string;
}

/** Établissement sélectionné, partagé par tous les onglets. */
export const StructureContext = createContext<Structure | null>(null);
export const useStructure = (): Structure => {
  const s = useContext(StructureContext);
  if (!s) throw new Error("StructureContext absent");
  return s;
};
