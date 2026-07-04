import { useEdificeClient } from '@open-ent/react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { api } from '../api';
import { formatDate } from '../utils';

/**
 * Périodes d'exclusion (jours fériés, vacances, jours sans cours) — parité IHM AngularJS (CCTP 51C).
 * Lecture GET /settings/periodes/exclusions : ces dates sont exclues des calculs de présence/évaluation.
 */
export function Exclusions() {
  const { t } = useTranslation(['viescolaire', 'common']);
  const { user, init } = useEdificeClient();
  const structureId = user?.structures?.[0] ?? '';

  const exclusionsQuery = useQuery({ queryKey: ['viesco', 'exclusions', structureId], queryFn: () => api.getExclusions(structureId), enabled: !!structureId });
  const exclusions = [...(exclusionsQuery.data ?? [])].sort((a, b) => a.startDate.localeCompare(b.startDate));

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
      <h1 className="mb-16">{t('viescolaire.exclusions.title', { defaultValue: "Périodes d'exclusion" })}</h1>
      <p className="text-muted mb-16">{t('viescolaire.exclusions.help', { defaultValue: 'Jours fériés, vacances et jours sans cours, exclus des calculs de présence et d’évaluation.' })}</p>

      {exclusionsQuery.isLoading && <p>{t('viescolaire.loading', { defaultValue: 'Chargement…' })}</p>}
      {!exclusionsQuery.isLoading && exclusions.length === 0 && <p className="text-muted">{t('viescolaire.exclusions.empty', { defaultValue: 'Aucune période d’exclusion.' })}</p>}
      {exclusions.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="table table-bordered mb-0">
            <thead>
              <tr>
                <th>{t('viescolaire.exclusions.desc', { defaultValue: 'Libellé' })}</th>
                <th>{t('viescolaire.from', { defaultValue: 'Du' })}</th>
                <th>{t('viescolaire.to', { defaultValue: 'Au' })}</th>
              </tr>
            </thead>
            <tbody>
              {exclusions.map((e) => (
                <tr key={e.id}>
                  <td>{e.description || '—'}</td>
                  <td>{formatDate(e.startDate)}</td>
                  <td>{formatDate(e.endDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default Exclusions;
