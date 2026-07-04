import { useEdificeClient } from '@open-ent/react';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { api } from '../api';
import { compareFr, resolveName } from '../utils';

/**
 * Services d'enseignement (parité IHM AngularJS) : tableau « qui enseigne quelle matière
 * à quel groupe », avec modalité, coefficient et caractère évaluable. Lecture seule.
 * Matière et enseignant résolus en clair ; filtre par matière.
 */
export function Services() {
  const { t } = useTranslation(['viescolaire', 'common']);
  const { user, init } = useEdificeClient();
  const structureId = user?.structures?.[0] ?? '';
  const [matiereFilter, setMatiereFilter] = useState('');

  const servicesQuery = useQuery({ queryKey: ['viesco', 'services', structureId], queryFn: () => api.getServices(structureId), enabled: !!structureId });
  const matieresQuery = useQuery({ queryKey: ['viesco', 'matieres', structureId], queryFn: () => api.getMatieres(structureId), enabled: !!structureId });
  const classesQuery = useQuery({ queryKey: ['viesco', 'classes', structureId], queryFn: () => api.getClasses(structureId), enabled: !!structureId });
  const teachersQuery = useQuery({ queryKey: ['viesco', 'teachers', structureId], queryFn: () => api.getTeachers(structureId), enabled: !!structureId });

  const matiereById = useMemo(() => new Map((matieresQuery.data ?? []).map((m) => [m.id, m.name])), [matieresQuery.data]);
  const classById = useMemo(() => new Map((classesQuery.data ?? []).map((c) => [c.id, c.name])), [classesQuery.data]);
  const teacherById = useMemo(() => new Map((teachersQuery.data ?? []).map((e) => [e.id, e.displayName])), [teachersQuery.data]);

  const services = servicesQuery.data ?? [];
  const rows = useMemo(() => {
    const enriched = services.map((s) => ({
      ...s,
      matiereName: resolveName(s.id_matiere, matiereById),
      groupeName: resolveName(s.id_groupe, classById),
      enseignantName: resolveName(s.id_enseignant, teacherById),
    }));
    const filtered = matiereFilter ? enriched.filter((s) => s.id_matiere === matiereFilter) : enriched;
    return filtered.sort((a, b) => compareFr(a.matiereName, b.matiereName) || compareFr(a.groupeName, b.groupeName));
  }, [services, matiereById, classById, teacherById, matiereFilter]);

  // Matières réellement présentes dans les services (pour le filtre).
  const matieresPresentes = useMemo(() => {
    const ids = new Set(services.map((s) => s.id_matiere));
    return (matieresQuery.data ?? []).filter((m) => ids.has(m.id)).sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
  }, [services, matieresQuery.data]);

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

  const loading = servicesQuery.isLoading || matieresQuery.isLoading;

  return (
    <div>
      <h1 className="mb-16">{t('viescolaire.services.title', { defaultValue: "Services d'enseignement" })}</h1>

      <div className="d-flex gap-12 align-items-end flex-wrap mb-16">
        <div style={{ minWidth: 280 }}>
          <label htmlFor="svc-matiere" className="form-label">{t('viescolaire.subject', { defaultValue: 'Matière' })}</label>
          <select id="svc-matiere" className="form-select" value={matiereFilter} onChange={(e) => setMatiereFilter(e.target.value)}>
            <option value="">{t('viescolaire.all.subjects', { defaultValue: 'Toutes les matières' })}</option>
            {matieresPresentes.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <span className="text-muted">{rows.length} {t('viescolaire.services.count', { defaultValue: 'service(s)' })}</span>
      </div>

      {loading && <p>{t('viescolaire.loading', { defaultValue: 'Chargement…' })}</p>}
      {servicesQuery.isError && <div className="alert alert-warning" role="alert">{t('viescolaire.error', { defaultValue: 'Une erreur est survenue.' })}</div>}
      {!loading && rows.length === 0 && <p className="text-muted">{t('viescolaire.services.empty', { defaultValue: 'Aucun service.' })}</p>}

      {rows.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table className="table table-bordered mb-0">
            <thead>
              <tr>
                <th>{t('viescolaire.subject', { defaultValue: 'Matière' })}</th>
                <th>{t('viescolaire.group', { defaultValue: 'Groupe' })}</th>
                <th>{t('viescolaire.teacher', { defaultValue: 'Enseignant' })}</th>
                <th className="text-center">{t('viescolaire.modality', { defaultValue: 'Modalité' })}</th>
                <th className="text-center">{t('viescolaire.coefficient', { defaultValue: 'Coefficient' })}</th>
                <th className="text-center">{t('viescolaire.evaluable', { defaultValue: 'Évaluable' })}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s, i) => (
                <tr key={`${s.id_groupe}-${s.id_matiere}-${s.id_enseignant}-${i}`}>
                  <td>{s.matiereName}</td>
                  <td>{s.groupeName}</td>
                  <td>{s.enseignantName}</td>
                  <td className="text-center">{s.modalite || '—'}</td>
                  <td className="text-center">{typeof s.coefficient === 'number' ? s.coefficient : '—'}</td>
                  <td className="text-center">{s.evaluable ? '✓' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default Services;
