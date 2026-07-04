import { useEdificeClient } from '@open-ent/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FormEvent, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { api } from '../api';
import { formatDate } from '../utils';

/** Mémento vie scolaire : recherche d'un élève → fiche + commentaires (ajout). Nécessite droit ADML/vie sco. */
export function Memento() {
  const { t } = useTranslation(['viescolaire', 'common']);
  const { user, init } = useEdificeClient();
  const qc = useQueryClient();
  const structureId = user?.structures?.[0] ?? '';

  const [search, setSearch] = useState('');
  const [studentId, setStudentId] = useState('');
  const [comment, setComment] = useState('');
  const [formError, setFormError] = useState('');

  const studentsQuery = useQuery({ queryKey: ['viesco', 'students', structureId], queryFn: () => api.getStudents(structureId), enabled: !!structureId });
  const mementoQuery = useQuery({ queryKey: ['viesco', 'memento', studentId], queryFn: () => api.getMemento(studentId), enabled: !!studentId });

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 2) return [];
    return (studentsQuery.data ?? []).filter((s) => s.displayName.toLowerCase().includes(q)).slice(0, 20);
  }, [studentsQuery.data, search]);

  const addMut = useMutation({
    mutationFn: () => api.addMementoComment(studentId, comment.trim()),
    onSuccess: () => { setComment(''); setFormError(''); qc.invalidateQueries({ queryKey: ['viesco', 'memento', studentId] }); },
    onError: () => setFormError(t('viescolaire.memento.error', { defaultValue: "L'ajout du commentaire a échoué." })),
  });
  const onAdd = (e: FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    addMut.mutate();
  };

  const memento = mementoQuery.data;
  const comments = memento?.comments ?? (memento?.comment ? [{ comment: memento.comment }] : []);

  if (init && !structureId) {
    return <div><h1>{t('viescolaire.memento.title', { defaultValue: 'Mémento' })}</h1></div>;
  }

  return (
    <div>
      <h1 className="mb-16">{t('viescolaire.memento.title', { defaultValue: 'Mémento élève' })}</h1>

      {/* Recherche d'élève */}
      <div className="mb-16" style={{ maxWidth: 520, position: 'relative' }}>
        <label htmlFor="memento-search" className="form-label">{t('viescolaire.memento.search', { defaultValue: 'Rechercher un élève' })}</label>
        <input
          id="memento-search"
          className="form-control"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('viescolaire.memento.search.ph', { defaultValue: 'Nom de l’élève (min. 2 caractères)' })}
          autoComplete="off"
        />
        {results.length > 0 && (
          <ul className="list-unstyled border rounded bg-white" style={{ position: 'absolute', zIndex: 5, width: '100%', maxHeight: 260, overflowY: 'auto', boxShadow: '0 2px 8px rgba(0,0,0,.12)' }}>
            {results.map((s) => (
              <li key={s.id}>
                <button type="button" className="btn btn-link text-start w-100 px-12 py-4" onClick={() => { setStudentId(s.id); setSearch(s.displayName); }}>
                  {s.displayName}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!studentId && (
        <p className="text-muted">{t('viescolaire.memento.select', { defaultValue: 'Sélectionnez un élève pour afficher sa fiche.' })}</p>
      )}

      {studentId && mementoQuery.isLoading && <p>{t('viescolaire.loading', { defaultValue: 'Chargement…' })}</p>}

      {memento && (
        <div className="d-flex gap-16 flex-wrap align-items-start">
          {/* Fiche élève */}
          <section className="card p-16 flex-grow-1" style={{ minWidth: 320 }}>
            <h2 style={{ fontSize: 18 }} className="mb-12">{memento.name}</h2>
            <table className="table mb-0">
              <tbody>
                <tr><td>{t('viescolaire.memento.birth', { defaultValue: 'Date de naissance' })}</td><td>{formatDate(memento.birth_date)}</td></tr>
                {memento.classes && memento.classes.length > 0 && (
                  <tr><td>{t('viescolaire.classes', { defaultValue: 'Classes' })}</td><td>{memento.classes.join(', ')}</td></tr>
                )}
                <tr><td>{t('viescolaire.memento.accommodation', { defaultValue: 'Régime' })}</td><td>{memento.accommodation ?? '—'}</td></tr>
                <tr><td>{t('viescolaire.memento.transport', { defaultValue: 'Transport' })}</td><td>{memento.transport ? t('common.yes', { defaultValue: 'Oui' }) : t('common.no', { defaultValue: 'Non' })}</td></tr>
              </tbody>
            </table>
            {memento.relatives && memento.relatives.length > 0 && (
              <>
                <h3 style={{ fontSize: 15 }} className="mt-12 mb-8">{t('viescolaire.memento.relatives', { defaultValue: 'Responsables' })}</h3>
                <ul className="list-unstyled mb-0">
                  {memento.relatives.map((r, i) => (
                    <li key={i} className="py-4 border-bottom">{r.displayName ?? r.name} {r.mobile || r.phone ? <span className="text-muted">· {r.mobile ?? r.phone}</span> : null}</li>
                  ))}
                </ul>
              </>
            )}
          </section>

          {/* Commentaires */}
          <section className="card p-16 flex-grow-1" style={{ minWidth: 320 }}>
            <h2 style={{ fontSize: 18 }} className="mb-12">{t('viescolaire.memento.comments', { defaultValue: 'Commentaires' })}</h2>
            <form className="mb-12" onSubmit={onAdd}>
              <textarea className="form-control mb-8" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t('viescolaire.memento.comment.ph', { defaultValue: 'Ajouter un commentaire…' })} />
              {formError && <div className="alert alert-warning" role="alert">{formError}</div>}
              <button type="submit" className="btn btn-primary" disabled={addMut.isPending || !comment.trim()}>{t('viescolaire.memento.comment.add', { defaultValue: 'Ajouter' })}</button>
            </form>
            {comments.length === 0 && <p className="text-muted mb-0">{t('viescolaire.memento.comments.empty', { defaultValue: 'Aucun commentaire.' })}</p>}
            {comments.length > 0 && (
              <ul className="list-unstyled mb-0">
                {comments.map((c, i) => (
                  <li key={c.id ?? i} className="py-8 border-bottom">
                    <div>{c.comment}</div>
                    {(c.owner_name || c.created) && <div className="text-muted" style={{ fontSize: 12 }}>{c.owner_name} {c.created ? `· ${formatDate(c.created)}` : ''}</div>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

export default Memento;
