import { Cycle } from "../../lib/competencesLevels";

/** Onglets des cycles (niveaux de maîtrise, items de compétences). */
export const CycleTabs = ({ cycles, selected, onSelect, label }: { cycles: Cycle[]; selected: number | null; onSelect: (id: number) => void; label: string }) => (
  <ul className="nav nav-tabs mb-12" role="tablist" aria-label={label} data-vsco-comp-cycles>
    {cycles.map((c) => (
      <li key={c.id_cycle} className="nav-item" role="presentation">
        <button type="button" role="tab" aria-selected={c.id_cycle === selected} className={`nav-link${c.id_cycle === selected ? " active" : ""}`} onClick={() => onSelect(c.id_cycle)} data-vsco-comp-cycle={c.id_cycle}>
          {c.libelle}
        </button>
      </li>
    ))}
  </ul>
);
