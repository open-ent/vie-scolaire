import {
  AppHeader,
  Breadcrumb,
  Layout,
  LoadingScreen,
  useEdificeClient,
} from '@open-ent/react';
import { NavLink, Outlet } from 'react-router-dom';

/** Gabarit commun : bandeau ENT (Layout + AppHeader + fil d'Ariane) + navigation + contenu. */
export function Root() {
  const { currentApp, init } = useEdificeClient();
  if (!init) return <LoadingScreen />;

  const tab = (to: string, label: string, end?: boolean) => (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => `btn btn-${isActive ? 'primary' : 'secondary'}`}
    >
      {label}
    </NavLink>
  );

  return (
    <div className="d-flex flex-column vh-100">
      <Layout>
        <div className="d-print-none">
          <AppHeader>{currentApp && <Breadcrumb app={currentApp} />}</AppHeader>
        </div>
        <div className="flex-grow-1 overflow-auto">
          <div className="container py-16">
            <nav className="btn-group mb-16" aria-label="Navigation vie scolaire">
              {tab('/', 'Référentiel', true)}
              {tab('/periodes', 'Périodes')}
              {tab('/services', 'Services')}
              {tab('/regroupements', 'Regroupements')}
              {tab('/exclusions', 'Exclusions')}
              {tab('/memento', 'Mémento')}
              {tab('/trombinoscope', 'Trombinoscope')}
            </nav>
            {/* Passerelles vers les paramétrages des modules liés (parité onglets Angular
                COMPÉTENCES / PRESENCES / CAHIER DE TEXTE — modules migrés, liens directs). */}
            <nav className="d-flex gap-8 mb-16 flex-wrap" aria-label="Modules liés">
              <a className="btn btn-secondary btn-sm" href="/competences?ui=react">Compétences</a>
              <a className="btn btn-secondary btn-sm" href="/presences?ui=react#/parametrage">Présences</a>
              <a className="btn btn-secondary btn-sm" href="/diary?ui=react">Cahier de textes</a>
            </nav>
            <Outlet />
          </div>
        </div>
      </Layout>
    </div>
  );
}

export default Root;
