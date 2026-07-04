import { useEdificeClient } from '@open-ent/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../api';
import { compareFr } from '../utils';

/**
 * Regroupements de classes/groupes — parité IHM AngularJS (CCTP 51C).
 * Liste des regroupements (GET /grouping/structure/:id/list) et création (POST /grouping/structure/:id).
 */
export function Regroupements() {
  const { t } = useTranslation(['viescolaire', 'common']);
  const { user, init } = useEdificeClient();
  const qc = useQueryClient();
  const structureId = user?.structures?.[0] ?? '';

  const groupingsQuery = useQuery({ queryKey: ['viesco', 'groupings', structureId], queryFn: () => api.getGroupings(structureId), enabled: !!structureId });
  const groupings = [...(groupingsQuery.data ?? [])].sort((a, b) => compareFr(a.name, b.name));

  const [name, setName] = useState('');
  const [formError, setFormError] = useState('');
  const invalidate = () => qc.invalidateQueries({ queryKey: ['viesco', 'groupings', structureId] });
  const createMut = useMutation({
    mutationFn: () => api.createGrouping(structureId, name.trim()),
    onSuccess: () => { setName(''); setFormError(''); invalidate(); },
    onError: () => setFormError(t('viescolaire.grouping.error', { defaultValue: 'La création du regroupement a échoué.' })),
  });

  const onCreate = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError(t('viescolaire.grouping.required', { defaultValue: 'Le nom est obligatoire.' }));
      return;
    }
    setFormError('');
    createMut.mutate();
  };

  if (init && !structureId) {
    return (
      <div>
        <h1>{t('viescolaire.title', { defaultValue: 'Vie scolaire' })}</h1>
        <div className="alert alert-info" role="alert">{t('viescolaire.no.structure', { defaultValue: 'Aucun établissement associé à votre compte.' })}</div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-16">{t('viescolaire.groupings.title', { defaultValue: 'Regroupements' })}</h1>

      <section className="card p-16 mb-24">
        <h2 style={{ fontSize: 18 }} className="mb-12">{t('viescolaire.grouping.new', { defaultValue: 'Nouveau regroupement' })}</h2>
        <form onSubmit={onCreate} className="d-flex gap-12 align-items-end flex-wrap">
          <div className="flex-grow-1" style={{ minWidth: 260 }}>
            <label htmlFor="g-name" className="form-label">{t('viescolaire.grouping.label', { defaultValue: 'Nom du regroupement' })}</label>
            <input id="g-name" className="form-control" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <button type="submit" className="btn btn-primary" disabled={createMut.isPending}>{t('viescolaire.grouping.add', { defaultValue: 'Créer' })}</button>
          {formError && <div className="alert alert-warning mb-0 w-100" role="alert">{formError}</div>}
        </form>
      </section>

      <h2 style={{ fontSize: 18 }} className="mb-12">
        {t('viescolaire.groupings.list', { defaultValue: 'Regroupements' })} <span className="text-muted" style={{ fontSize: 14 }}>({groupings.length})</span>
      </h2>
      {groupingsQuery.isLoading && <p>{t('viescolaire.loading', { defaultValue: 'Chargement…' })}</p>}
      {!groupingsQuery.isLoading && groupings.length === 0 && <p className="text-muted">{t('viescolaire.groupings.empty', { defaultValue: 'Aucun regroupement.' })}</p>}
      {groupings.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="table table-bordered mb-0">
            <thead>
              <tr>
                <th>{t('viescolaire.grouping.label', { defaultValue: 'Nom du regroupement' })}</th>
                <th>{t('viescolaire.groupings.classes', { defaultValue: 'Classes / groupes' })}</th>
              </tr>
            </thead>
            <tbody>
              {groupings.map((g) => (
                <tr key={g.id}>
                  <td>{g.name}</td>
                  <td>
                    {g.divisions.length === 0
                      ? <span className="text-muted">{t('viescolaire.groupings.none', { defaultValue: 'Aucune' })}</span>
                      : g.divisions.map((d) => <span key={d.id} className="badge bg-secondary me-4">{d.name}</span>)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default Regroupements;
