import { useEffect, useState } from "react";
import { Found, foundLabel } from "../lib/trombinoscope";

/** Champ de recherche avec suggestions (élève ou classe) : saisir, puis choisir un résultat. */
export const Finder = ({ label, placeholder, search, onPick, attr }: { label: string; placeholder: string; search: (q: string) => Promise<Found[]>; onPick: (f: Found) => void; attr: string }) => {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Found[]>([]);
  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => search(q).then((r) => !cancelled && setResults(r ?? [])).catch(() => !cancelled && setResults([])), 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
  return (
    <div style={{ position: "relative", maxWidth: 360 }}>
      <label className="form-label" htmlFor={`finder-${attr}`}>
        {label}
      </label>
      <input id={`finder-${attr}`} className="form-control" value={q} placeholder={placeholder} onChange={(e) => setQ(e.target.value)} autoComplete="off" data-vsco-finder={attr} />
      {results.length > 0 && (
        <ul className="list-group position-absolute w-100 shadow" style={{ zIndex: 20, maxHeight: 240, overflowY: "auto" }} role="listbox">
          {results.map((r) => (
            <li key={r.id} role="option" aria-selected="false">
              <button type="button" className="list-group-item list-group-item-action" onClick={() => { onPick(r); setQ(""); setResults([]); }} data-vsco-finder-result={foundLabel(r)}>
                {foundLabel(r)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
