import { useEdificeClient } from '@open-ent/react';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../api';
import { byName, formatDate, periodeLabel } from '../utils';

/** Tableau de bord Vie scolaire : référentiel de l'établissement (périodes, matières, classes). */
export function Dashboard() {
  const { t } = useTranslation(['viescolaire', 'common']);
  const { user, init } = useEdificeClient();
  const structureId = user?.structures?.[0] ?? '';

  const periodesQuery = useQuery({ queryKey: ['viesco', 'periodes', structureId], queryFn: () => api.getPeriodes(structureId), enabled: !!structureId });
  const typesQuery = useQuery({ queryKey: ['viesco', 'periode-types'], queryFn: () => api.getPeriodeTypes(), enabled: !!structureId });
  const matieresQuery = useQuery({ queryKey: ['viesco', 'matieres', structureId], queryFn: () => api.getMatieres(structureId), enabled: !!structureId });
  const classesQuery = useQuery({ queryKey: ['viesco', 'classes', structureId], queryFn: () => api.getClasses(structureId), enabled: !!structureId });

  // Table type de période -> libellé (l'API /periodes/types renvoie id + libellé/type).
  const typeLabels = useMemo(() => {
    const m = new Map<number, string>();
    for (const ty of typesQuery.data ?? []) m.set(ty.id, ty.libelle ?? ty.type ?? `Période ${ty.id}`);
    return m;
  }, [typesQuery.data]);

  const periodes = periodesQuery.data ?? [];
  const matieres = [...(matieresQuery.data ?? [])].sort(byName);
  const classes = [...(classesQuery.data ?? [])].sort(byName);

  if (init && !structureId) {
    return (
      <div>
        <h1>{t('viescolaire.title', { defaultValue: 'Vie scolaire' })}</h1>
        <div className="alert alert-info" role="alert">
          {t('viescolaire.no.structure', { defaultValue: 'Aucun établissement associé à votre compte.' })}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-16">{t('viescolaire.title', { defaultValue: 'Vie scolaire' })}</h1>
      <p className="text-muted mb-16">
        {t('viescolaire.dashboard.intro', { defaultValue: "Référentiel de l'établissement." })}
      </p>

      <div className="d-flex gap-16 flex-wrap align-items-start">
        {/* Périodes scolaires */}
        <section className="card p-16 flex-grow-1" style={{ minWidth: 320 }}>
          <h2 style={{ fontSize: 18 }} className="mb-12">{t('viescolaire.periods', { defaultValue: 'Périodes' })}</h2>
          {periodesQuery.isLoading && <p>{t('viescolaire.loading', { defaultValue: 'Chargement…' })}</p>}
          {!periodesQuery.isLoading && periodes.length === 0 && (
            <p className="text-muted">{t('viescolaire.periods.empty', { defaultValue: 'Aucune période définie.' })}</p>
          )}
          {periodes.length > 0 && (
            <table className="table">
              <thead>
                <tr>
                  <th>{t('viescolaire.period', { defaultValue: 'Période' })}</th>
                  <th>{t('viescolaire.start', { defaultValue: 'Début' })}</th>
                  <th>{t('viescolaire.end', { defaultValue: 'Fin' })}</th>
                </tr>
              </thead>
              <tbody>
                {periodes.map((p) => (
                  <tr key={p.id}>
                    <td>{periodeLabel(p.type ?? p.id_type, typeLabels)}</td>
                    <td>{formatDate(p.timestamp_dt)}</td>
                    <td>{formatDate(p.timestamp_fn)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Matières */}
        <section className="card p-16 flex-grow-1" style={{ minWidth: 260 }}>
          <h2 style={{ fontSize: 18 }} className="mb-12">
            {t('viescolaire.subjects', { defaultValue: 'Matières' })}{' '}
            <span className="text-muted" style={{ fontSize: 14 }}>({matieres.length})</span>
          </h2>
          {matieresQuery.isLoading && <p>{t('viescolaire.loading', { defaultValue: 'Chargement…' })}</p>}
          {!matieresQuery.isLoading && matieres.length === 0 && (
            <p className="text-muted">{t('viescolaire.subjects.empty', { defaultValue: 'Aucune matière.' })}</p>
          )}
          {matieres.length > 0 && (
            <ul className="list-unstyled mb-0">
              {matieres.map((m) => (
                <li key={m.id} className="py-4 border-bottom">{m.name}</li>
              ))}
            </ul>
          )}
        </section>

        {/* Classes */}
        <section className="card p-16 flex-grow-1" style={{ minWidth: 260 }}>
          <h2 style={{ fontSize: 18 }} className="mb-12">
            {t('viescolaire.classes', { defaultValue: 'Classes' })}{' '}
            <span className="text-muted" style={{ fontSize: 14 }}>({classes.length})</span>
          </h2>
          {classesQuery.isLoading && <p>{t('viescolaire.loading', { defaultValue: 'Chargement…' })}</p>}
          {!classesQuery.isLoading && classes.length === 0 && (
            <p className="text-muted">{t('viescolaire.classes.empty', { defaultValue: 'Aucune classe.' })}</p>
          )}
          {classes.length > 0 && (
            <ul className="list-unstyled mb-0">
              {classes.map((c) => (
                <li key={c.id} className="py-4 border-bottom">{c.name}</li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

export default Dashboard;
