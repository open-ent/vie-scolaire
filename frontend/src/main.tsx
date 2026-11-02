import { AppHeader, EdificeThemeProvider, Layout } from "@open-ent/react";
import { StrictMode, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { I18nextProvider, useTranslation } from "react-i18next";
import { HashRouter, Navigate, NavLink, Route, Routes, useLocation, useParams } from "react-router-dom";
import { Structure, StructureContext } from "./components/StructureContext";
import i18n from "./i18n";
import { defaultSchoolTab, SchoolTabId, SectionId, visibleSchoolTabs, visibleSections } from "./lib/tabs";
import { Placeholder } from "./pages/Placeholder";
import { Providers } from "./providers";
import { contextOf, useMe } from "./services/queries";

// Le thème de la plateforme rend les `.btn-link` quasi invisibles (même couleur que le fond) : ils reprennent la couleur du texte, soulignés.
const style = document.createElement("style");
style.textContent =
  ".btn-link{color:inherit !important;text-decoration:underline}" +
  // l'onglet actif reprend la couleur du texte (le thème le rend presque invisible)
  ".nav-tabs .nav-link.active{color:#212529 !important;font-weight:600}";
document.head.appendChild(style);

const SECTION_LABEL: Record<SectionId, [string, string]> = {
  ecole: ["viescolaire.utils.school", "Établissement"],
  competences: ["evaluations.competences.title", "Compétences"],
  presences: ["viescolaire.presences.title", "Présences"],
  diary: ["viescolaire.cdt.title", "Cahier de textes"],
  edt: ["viescolaire.edt.title", "Emploi du temps"],
};

const SCHOOL_LABEL: Record<SchoolTabId, [string, string]> = {
  annee: ["viescolaire.year.set", "Année scolaire"],
  periodes: ["viescolaire.periode.set", "Périodes"],
  exclusions: ["viescolaire.exclusion.set", "Périodes d'exclusion"],
  creneaux: ["viescolaire.time.slots", "Plages horaires"],
  services: ["evaluation.service.title", "Services"],
  regroupements: ["viescolaire.grouping.set", "Regroupements, niveaux"],
  trombinoscope: ["viescolaire.trombinoscope", "Trombinoscope"],
};

/** Onglets : liens de navigation (l'adresse porte l'onglet, on peut donc partager ou recharger la page). */
const Tabs = ({ items, base, label, attr }: { items: Array<{ id: string; text: string }>; base: string; label: string; attr: string }) => {
  const { pathname } = useLocation();
  return (
    <ul className="nav nav-tabs mb-16" role="tablist" aria-label={label}>
      {items.map((x) => {
        const active = pathname === `${base}${x.id}` || pathname.startsWith(`${base}${x.id}/`);
        return (
          <li key={x.id} className="nav-item" role="presentation">
            <NavLink to={`${base}${x.id}`} role="tab" aria-selected={active} className={`nav-link${active ? " active" : ""}`} {...{ [attr]: x.id }}>
              {x.text}
            </NavLink>
          </li>
        );
      })}
    </ul>
  );
};

const School = ({ tabs }: { tabs: SchoolTabId[] }) => {
  const { t } = useTranslation("viescolaire");
  const { tab } = useParams();
  const fallback = defaultSchoolTab(tabs);
  if (!tabs.includes(tab as SchoolTabId)) return fallback ? <Navigate to={`/ecole/${fallback}`} replace /> : null;
  const current = tab as SchoolTabId;
  return (
    <div data-vsco-section="ecole">
      <Tabs
        items={tabs.map((id) => ({ id, text: t(SCHOOL_LABEL[id][0], { defaultValue: SCHOOL_LABEL[id][1] }) }))}
        base="/ecole/"
        label={t("viescolaire.utils.school", { defaultValue: "Établissement" })}
        attr="data-vsco-school-tab"
      />
      <div data-vsco-panel={current}>
        <Placeholder id={current} />
      </div>
    </div>
  );
};

const Section = ({ sections }: { sections: SectionId[] }) => {
  const { section } = useParams();
  const id = sections.find((s) => s === section);
  if (!id) return <Navigate to="/ecole" replace />;
  return (
    <div data-vsco-section={id}>
      <Placeholder id={id} />
    </div>
  );
};

const App = () => {
  const { t } = useTranslation("viescolaire");
  const me = useMe();
  const ctx = useMemo(() => contextOf(me.data), [me.data]);
  const sections = useMemo(() => visibleSections(ctx), [ctx]);
  const schoolTabs = useMemo(() => visibleSchoolTabs(ctx), [ctx]);
  const structures = useMemo<Structure[]>(
    () => (me.data?.structureIds ?? []).map((id, i) => ({ id, name: me.data?.structureNames[i] ?? id })),
    [me.data],
  );
  const [structureId, setStructureId] = useState<string>("");
  useEffect(() => {
    if (!structureId && structures[0]) setStructureId(structures[0].id);
  }, [structures, structureId]);
  const structure = structures.find((s) => s.id === structureId) ?? structures[0];

  return (
    <Layout>
      <AppHeader>
        <h1 className="h2" data-vsco-title>
          {t("viescolaire.param", { defaultValue: "Paramétrages" })}
        </h1>
      </AppHeader>
      {me.isLoading && <p>{t("viescolaire.loading", { defaultValue: "Chargement…" })}</p>}
      {me.data && !structure && <p className="text-muted">{t("viescolaire.no.structure", { defaultValue: "Aucun établissement rattaché à ce compte." })}</p>}
      {structure && (
        <StructureContext.Provider value={structure}>
          {structures.length > 1 && (
            <div className="mb-16" style={{ maxWidth: 420 }}>
              <label htmlFor="vsco-structure" className="form-label">
                {t("viescolaire.structure", { defaultValue: "Établissement" })}
              </label>
              <select id="vsco-structure" className="form-select" value={structure.id} onChange={(e) => setStructureId(e.target.value)} data-vsco-structure>
                {structures.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <HashRouter>
            <Tabs
              items={sections.map((id) => ({ id, text: t(SECTION_LABEL[id][0], { defaultValue: SECTION_LABEL[id][1] }) }))}
              base="/"
              label={t("viescolaire.param", { defaultValue: "Paramétrages" })}
              attr="data-vsco-tab"
            />
            <Routes>
              <Route path="/" element={<Navigate to="/ecole" replace />} />
              <Route path="/ecole/:tab?" element={<School tabs={schoolTabs} />} />
              <Route path="/:section" element={<Section sections={sections} />} />
            </Routes>
          </HashRouter>
        </StructureContext.Provider>
      )}
    </Layout>
  );
};

const root = document.getElementById("root");
if (root) {
  createRoot(root).render(
    <StrictMode>
      <Providers>
        <I18nextProvider i18n={i18n}>
          <EdificeThemeProvider>
            <App />
          </EdificeThemeProvider>
        </I18nextProvider>
      </Providers>
    </StrictMode>,
  );
}
