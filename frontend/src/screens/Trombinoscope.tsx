import { useEdificeClient } from '@open-ent/react';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../api';

/** Trombinoscope : élèves de l'établissement (annuaire) avec avatar. Nécessite droit ADML/vie sco. */
export function Trombinoscope() {
  const { t } = useTranslation(['viescolaire', 'common']);
  const { user, init } = useEdificeClient();
  const structureId = user?.structures?.[0] ?? '';

  const [search, setSearch] = useState('');
  const studentsQuery = useQuery({ queryKey: ['viesco', 'students', structureId], queryFn: () => api.getStudents(structureId), enabled: !!structureId });

  const all = studentsQuery.data ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = q ? all.filter((s) => s.displayName.toLowerCase().includes(q)) : all;
    return list.slice(0, 120);
  }, [all, search]);

  if (init && !structureId) {
    return <div><h1>{t('viescolaire.trombi.title', { defaultValue: 'Trombinoscope' })}</h1></div>;
  }

  return (
    <div>
      <h1 className="mb-8">{t('viescolaire.trombi.title', { defaultValue: 'Trombinoscope' })}</h1>
      <p className="text-muted mb-16">
        {t('viescolaire.trombi.count', { defaultValue: 'élèves' })}: {all.length}
        {filtered.length < all.length ? ` · ${t('viescolaire.trombi.shown', { defaultValue: 'affichés' })}: ${filtered.length}` : ''}
      </p>

      <div className="mb-16" style={{ maxWidth: 420 }}>
        <label htmlFor="trombi-search" className="form-label">{t('viescolaire.memento.search', { defaultValue: 'Rechercher un élève' })}</label>
        <input id="trombi-search" className="form-control" value={search} onChange={(e) => setSearch(e.target.value)} autoComplete="off" />
      </div>

      {studentsQuery.isLoading && <p>{t('viescolaire.loading', { defaultValue: 'Chargement…' })}</p>}

      <div className="d-flex flex-wrap gap-16">
        {filtered.map((s) => (
          <figure key={s.id} className="text-center m-0" style={{ width: 120 }}>
            <img
              src={`/userbook/avatar/${s.id}?thumbnail=100x100`}
              alt=""
              width={80}
              height={80}
              loading="lazy"
              style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: '50%', background: '#e9ecef' }}
              onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }}
            />
            <figcaption style={{ fontSize: 12, marginTop: 4 }}>{s.displayName}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

export default Trombinoscope;
