import { useEdificeClient } from '@open-ent/react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api, PeriodeSaisie } from '../api';
import { DecoupagePeriode, byName, decoupageAnnee } from '../utils';

/** Découpages proposés (nombre de périodes → libellé). Le backend déduit le type du nombre. */
const DECOUPAGES = [
  { nb: 2, key: 'semestres' },
  { nb: 3, key: 'trimestres' },
];

/**
 * Paramétrage des périodes : sélection d'une ou plusieurs classes, choix du découpage
 * (semestres/trimestres), édition des bornes de chaque période puis enregistrement
 * via PUT /viescolaire/periodes. Nécessite le droit ADML sur la structure.
 */
export function Periodes() {
  const { t } = useTranslation(['viescolaire', 'common']);
  const { user, init } = useEdificeClient();
  const structureId = user?.structures?.[0] ?? '';

  const [selected, setSelected] = useState<string[]>([]);
  const [nb, setNb] = useState(3);
  const [rows, setRows] = useState<DecoupagePeriode[]>([]);
  const [ok, setOk] = useState(false);
  const [formError, setFormError] = useState('');

  const classesQuery = useQuery({ queryKey: ['viesco', 'classes', structureId], queryFn: () => api.getClasses(structureId), enabled: !!structureId });
  const yearQuery = useQuery({ queryKey: ['viesco', 'schoolyear', structureId], queryFn: () => api.getSchoolYear(structureId), enabled: !!structureId });

  const classes = useMemo(() => [...(classesQuery.data ?? [])].sort(byName), [classesQuery.data]);
  const year = yearQuery.data;

  // Proposition initiale de découpage dès que l'année et le nombre de périodes sont connus.
  useEffect(() => {
    setRows(decoupageAnnee(nb, year?.start_date, year?.end_date));
    setOk(false);
    setFormError('');
  }, [nb, year?.start_date, year?.end_date]);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const setField = (i: number, field: keyof DecoupagePeriode, value: string | boolean) =>
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));

  const saveMut = useMutation({
    mutationFn: () => api.updatePeriodes(structureId, selected, rows as PeriodeSaisie[]),
    onSuccess: () => { setOk(true); setFormError(''); },
    onError: () => setFormError(t('viescolaire.periodes.error', { defaultValue: "L'enregistrement des périodes a échoué." })),
  });

  const onSave = (e: FormEvent) => {
    e.preventDefault();
    setOk(false);
    if (selected.length === 0) { setFormError(t('viescolaire.periodes.noclass', { defaultValue: 'Sélectionnez au moins une classe.' })); return; }
    saveMut.mutate();
  };

  if (init && !structureId) return <div><h1>{t('viescolaire.periodes.title', { defaultValue: 'Périodes' })}</h1></div>;

  return (
    <div>
      <h1 className="mb-16">{t('viescolaire.periodes.title', { defaultValue: 'Paramétrage des périodes' })}</h1>
      {year && (
        <p className="text-muted mb-16">
          {t('viescolaire.periodes.year', { defaultValue: 'Année scolaire' })} : {year.start_date?.slice(0, 10)} → {year.end_date?.slice(0, 10)}
        </p>
      )}

      <form onSubmit={onSave}>
        <div className="d-flex gap-16 flex-wrap align-items-start">
          {/* Classes */}
          <section className="card p-16" style={{ minWidth: 260 }}>
            <h2 style={{ fontSize: 16 }} className="mb-12">{t('viescolaire.periodes.classes', { defaultValue: 'Classes concernées' })}</h2>
            {classes.length === 0 && <p className="text-muted mb-0">{t('viescolaire.periodes.noclasses', { defaultValue: 'Aucune classe.' })}</p>}
            <ul className="list-unstyled mb-0" style={{ maxHeight: 320, overflowY: 'auto' }}>
              {classes.map((c) => (
                <li key={c.id} className="py-4">
                  <label className="d-flex align-items-center gap-8">
                    <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggle(c.id)} />
                    <span>{c.name}</span>
                  </label>
                </li>
              ))}
            </ul>
          </section>

          {/* Découpage + périodes */}
          <section className="card p-16 flex-grow-1" style={{ minWidth: 420 }}>
            <div className="mb-12" style={{ maxWidth: 260 }}>
              <label htmlFor="per-decoupage" className="form-label">{t('viescolaire.periodes.decoupage', { defaultValue: 'Découpage' })}</label>
              <select id="per-decoupage" className="form-select" value={nb} onChange={(e) => setNb(Number(e.target.value))}>
                {DECOUPAGES.map((d) => (
                  <option key={d.nb} value={d.nb}>
                    {t(`viescolaire.periodes.${d.key}`, { defaultValue: d.key })} ({d.nb})
                  </option>
                ))}
              </select>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{t('viescolaire.periodes.start', { defaultValue: 'Début' })}</th>
                    <th>{t('viescolaire.periodes.end', { defaultValue: 'Fin' })}</th>
                    <th>{t('viescolaire.periodes.saisie', { defaultValue: 'Fin de saisie' })}</th>
                    <th>{t('viescolaire.periodes.conseil', { defaultValue: 'Conseil de classe' })}</th>
                    <th>{t('viescolaire.periodes.publi', { defaultValue: 'Visibilité des bulletins aux parents' })}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td><input type="date" className="form-control" value={r.timestamp_dt} onChange={(e) => setField(i, 'timestamp_dt', e.target.value)} /></td>
                      <td><input type="date" className="form-control" value={r.timestamp_fn} onChange={(e) => setField(i, 'timestamp_fn', e.target.value)} /></td>
                      <td><input type="date" className="form-control" value={r.date_fin_saisie} onChange={(e) => setField(i, 'date_fin_saisie', e.target.value)} /></td>
                      <td><input type="date" className="form-control" value={r.date_conseil_classe} onChange={(e) => setField(i, 'date_conseil_classe', e.target.value)} /></td>
                      <td className="text-center"><input type="checkbox" checked={r.publication_bulletin} onChange={(e) => setField(i, 'publication_bulletin', e.target.checked)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {formError && <div className="alert alert-warning" role="alert">{formError}</div>}
            {ok && <div className="alert alert-success" role="status">{t('viescolaire.periodes.saved', { defaultValue: 'Périodes enregistrées.' })}</div>}
            <button type="submit" className="btn btn-primary" disabled={saveMut.isPending || rows.length === 0}>
              {t('viescolaire.periodes.save', { defaultValue: 'Enregistrer les périodes' })}
            </button>
          </section>
        </div>
      </form>
    </div>
  );
}

export default Periodes;
