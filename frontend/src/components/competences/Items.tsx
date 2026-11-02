import { Button, Modal } from "@open-ent/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useMemo, useState } from "react";
import {
  buildEnseignements, canSaveItem, Competence, createItemPayload, deleteOutcome, Domaine, domaineHasMatch, domainePayload, domainesOfCycle, enseignementsOfCycle, hasMatch, highlightParts,
  maskOutcome, maskPayload, matchesCompetence, moveItem, newItemFor, NewItem, orderedItems, orderPayload, renamePayload, toggleDomaine, containsIgnoreCase,
} from "../../lib/competencesItems";
import { Cycle } from "../../lib/competencesLevels";
import { itemService } from "../../services/competences.service";
import { CycleTabs } from "./CycleTabs";
import { SectionProps, Tr, useCompT } from "./shared";

interface Props extends SectionProps {
  cycles: Cycle[];
  cycleId: number | null;
  onSelectCycle: (id: number) => void;
}

/** Texte avec les occurrences du mot recherché surlignées. */
const Highlighted = ({ text, keyword }: { text: string; keyword: string }) => (
  <>
    {highlightParts(text, keyword).map((p, i) => (p.hit ? <mark key={i}>{p.text}</mark> : <Fragment key={i}>{p.text}</Fragment>))}
  </>
);

/** Arbre de domaines à cocher (création d'un item, ou domaines d'un item existant). */
const DomainePicker = ({ domaines, selected, disabled, onToggle, tr }: { domaines: Domaine[]; selected: number[]; disabled: boolean; onToggle: (id: number, on: boolean) => void; tr: Tr }) => {
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const node = (d: Domaine): JSX.Element => {
    const hasItems = (d.competences ?? []).length > 0;
    // un sous-domaine sans item n'est pas affiché (comme l'AngularJS), mais ses propres sous-domaines le sont
    const shown = d.niveau === 1 || hasItems;
    return (
      <li key={d.id} className="list-unstyled">
        {shown && (
          <div className="d-flex align-items-center gap-8 mt-8">
            {hasItems && <input type="checkbox" className="form-check-input m-0" id={`vsco-comp-dom-${d.id}`} checked={selected.includes(d.id)} disabled={disabled} onChange={(e) => onToggle(d.id, e.target.checked)} data-vsco-comp-domaine-check={d.id} />}
            <label htmlFor={hasItems ? `vsco-comp-dom-${d.id}` : undefined} className={d.niveau === 1 ? "fw-bold m-0" : "m-0"}>
              {d.codification} - {d.libelle}
            </label>
            {(d.domaines ?? []).length > 0 && (
              <button type="button" className="btn btn-sm btn-link p-0" aria-expanded={!!open[d.id]} onClick={() => setOpen((o) => ({ ...o, [d.id]: !o[d.id] }))}>
                {open[d.id] ? tr("evaluations.close.model", "Masquer les libellés ") : tr("evaluations.open.model", "Afficher les libellés ")}
              </button>
            )}
          </div>
        )}
        {(d.domaines ?? []).length > 0 && (open[d.id] || !shown) && <ul className="ps-16">{(d.domaines ?? []).map(node)}</ul>}
      </li>
    );
  };
  return <ul className="ps-0 mb-0" data-vsco-comp-domaine-picker>{domaines.map(node)}</ul>;
};

/** Arbre en lecture seule des domaines avec leurs items (recherche « par domaines »). */
const DomaineReadOnly = ({ domaines, keyword }: { domaines: Domaine[]; keyword: string }) => {
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const node = (d: Domaine): JSX.Element => {
    const items = (d.competences ?? []).filter((c) => keyword.trim() === "" || containsIgnoreCase(c.nom, keyword));
    const isOpen = open[d.id] || domaineHasMatch(d, keyword);
    const showHeading = d.niveau === 1 || (d.competences ?? []).length > 0;
    return (
      <li key={d.id} className="list-unstyled">
        {showHeading && (
          <h4 className="h6 mt-12">
            <button type="button" className="btn btn-link p-0 fw-bold text-start" aria-expanded={!!isOpen} onClick={() => setOpen((o) => ({ ...o, [d.id]: !o[d.id] }))} data-vsco-comp-domaine-toggle={d.id}>
              {d.codification} - {d.libelle}
            </button>
          </h4>
        )}
        {isOpen && items.length > 0 && (
          <ul className="ps-16">
            {items.map((c) => (
              <li key={c.id} className={c.masque ? "text-muted text-decoration-line-through" : ""} data-vsco-comp-domaine-item={c.id}>
                <Highlighted text={c.nom} keyword={keyword} />
              </li>
            ))}
          </ul>
        )}
        {(d.domaines ?? []).length > 0 && <ul className="ps-16">{(d.domaines ?? []).map(node)}</ul>}
      </li>
    );
  };
  return <ul className="ps-0" data-vsco-comp-domaine-tree>{domaines.map(node)}</ul>;
};

/** Items de compétences : par enseignement (modifiables) ou par domaine (lecture seule). */
export const Items = ({ structureId, notify, cycles, cycleId, onSelectCycle }: Props) => {
  const tr = useCompT();
  const qc = useQueryClient();
  const enseignements = useQuery({ queryKey: ["comp-enseignements", structureId], queryFn: async () => buildEnseignements(await itemService.enseignements(structureId)) });
  const domaines = useQuery({ queryKey: ["comp-domaines", structureId], queryFn: () => itemService.domaines(structureId) });
  const reload = () => qc.invalidateQueries({ queryKey: ["comp-enseignements", structureId] });

  const [keyword, setKeyword] = useState("");
  const [byDomaine, setByDomaine] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [renaming, setRenaming] = useState<{ id: number; value: string } | null>(null);
  const [domaineFor, setDomaineFor] = useState<number | null>(null);
  const [creating, setCreating] = useState<NewItem | null>(null);
  const [resetStep, setResetStep] = useState<0 | 1 | 2>(0);
  const [resetError, setResetError] = useState(false);

  const cycleEns = useMemo(() => enseignementsOfCycle(enseignements.data ?? [], cycleId), [enseignements.data, cycleId]);
  const cycleDomaines = useMemo(() => domainesOfCycle(domaines.data ?? [], cycleId), [domaines.data, cycleId]);
  const isOpen = (key: string, forced: boolean) => open.has(key) || forced;
  const toggle = (key: string) =>
    setOpen((s) => {
      const n = new Set(s);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });

  /** Exécute l'action puis recharge ; l'action peut renvoyer un message de succès qui remplace le message par défaut. */
  const run = async (action: () => Promise<string | void>, okText: string, koText: string) => {
    try {
      const message = await action();
      if (message || okText) notify(true, message || okText);
    } catch {
      notify(false, koText);
    }
    await reload();
  };

  const mask = (c: Competence) =>
    run(
      async () => {
        const res = await itemService.update(maskPayload(c, structureId));
        if (maskOutcome(!c.masque, res) === "used") return tr("item.message.isUse", "Attention, l'item de compétence que vous avez masqué est lié à des évaluations existantes. Cliquer sur \"Rendre visible\" pour annuler.");
      },
      tr("item.success.updateMask", "Mise à jour du masque."),
      tr("item.error.updateMask", "Erreur lors de la mise à jour du masque."),
    );

  const rename = (c: Competence, value: string) => {
    setRenaming(null);
    if (value === c.nom || value.trim() === "") return;
    return run(() => itemService.update(renamePayload(c, value, structureId)).then(() => undefined), tr("item.success.updateName", "Mise à jour du libellé de l'item."), tr("item.error.updateName", "Erreur lors de la mise à jour du nom."));
  };

  const remove = (c: Competence, reinit: boolean) =>
    run(
      async () => {
        const res = await itemService.remove(c.id, structureId);
        if (!reinit) return deleteOutcome(res) === "mask" ? tr("item.success.delete.mask", "Attention, l'item de compétence que vous souhaitez supprimer est liée à des évaluations existantes. Elle a  par conséquent été masquée.") : tr("item.success.delete", "Item de compétence supprimé.");
      },
      reinit ? tr("item.success.reinit", "Item réinitialisé.") : "",
      tr("item.error.delete", "Erreur lors de la suppression de l'item."),
    );

  const move = async (list: Competence[], c: Competence, delta: -1 | 1) => {
    const moved = moveItem(list, c.id, delta);
    if (!moved) return;
    try {
      await itemService.update(orderPayload(moved, structureId));
    } catch {
      notify(false, tr("item.error.updateOrder", "Erreur lors de la mise à jour de l'ordre des items."));
    }
    await reload();
  };

  const toggleItemDomaine = async (c: Competence, id: number) => {
    try {
      await itemService.update(domainePayload(c, id, structureId));
    } catch {
      notify(false, tr("item.error.updateDomaine", "Erreur lors de la mise à jour des domaines liés à l'item."));
    }
    await reload();
  };

  const create = async () => {
    if (!creating || !canSaveItem(creating)) return;
    const item = creating;
    setCreating(null);
    await run(() => itemService.create(createItemPayload(item)).then(() => undefined), tr("item.success.create", "Nouvel item de compétence créé."), tr("item.error.create", "Erreur lors de la création de l'item."));
  };

  const resetAll = async () => {
    try {
      await itemService.resetAll(structureId);
      setResetStep(0);
      setResetError(false);
      notify(true, tr("item.success.delete.perso", "Items de compétences réinitialisés."));
      await reload();
    } catch {
      setResetError(true);
    }
  };

  const k = keyword.trim() !== "";
  const itemRow = (c: Competence, list: Competence[], idx: number) => {
    const hidden = k && !matchesCompetence(c, keyword);
    if (hidden) return null;
    const editing = renaming?.id === c.id;
    return (
      <li key={c.id} className="py-4 border-bottom" data-vsco-comp-item={c.id}>
        <div className="d-flex align-items-center flex-wrap gap-8">
          {editing ? (
            <input
              autoFocus
              className="form-control form-control-sm"
              style={{ maxWidth: 480 }}
              aria-label={tr("item.modify", "Modifier")}
              value={renaming.value}
              onChange={(e) => setRenaming({ id: c.id, value: e.target.value })}
              onBlur={() => rename(c, renaming.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") rename(c, renaming.value);
                if (e.key === "Escape") setRenaming(null);
              }}
              data-vsco-comp-item-rename
            />
          ) : (
            <span className={c.masque ? "text-muted text-decoration-line-through" : ""}>
              {c.ismanuelle && <span className="badge text-bg-secondary me-8" title={tr("item.manual", "Item ajouté par l'établissement")}>+</span>}
              <Highlighted text={c.nom} keyword={keyword} />
            </span>
          )}
          <span className="d-flex gap-4 flex-wrap ms-auto">
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => mask(c)} data-vsco-comp-item-mask>
              {c.masque ? tr("item.demask", "Rendre visible") : tr("item.mask", "Masquer")}
            </button>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => setRenaming({ id: c.id, value: c.nom })} data-vsco-comp-item-edit>
              {tr("item.modify", "Modifier")}
            </button>
            {c.ismanuelle && (
              <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => remove(c, false)} data-vsco-comp-item-delete>
                {tr("item.delete", "Supprimer")}
              </button>
            )}
            {!c.ismanuelle && c.hasnameperso && (
              <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => remove(c, true)} data-vsco-comp-item-reinit>
                {tr("item.reinit", "Réinitialiser")}
              </button>
            )}
            <button type="button" className="btn btn-sm btn-outline-secondary" aria-expanded={domaineFor === c.id} onClick={() => setDomaineFor(domaineFor === c.id ? null : c.id)} data-vsco-comp-item-domaines>
              {tr("item.show.domaine", "Afficher/Cacher les domaines")}
            </button>
            <button type="button" className="btn btn-sm btn-outline-secondary" aria-label={tr("viescolaire.comp.move.up", "Monter")} disabled={idx === 0} onClick={() => move(list, c, -1)} data-vsco-comp-item-up>
              ↑
            </button>
            <button type="button" className="btn btn-sm btn-outline-secondary" aria-label={tr("viescolaire.comp.move.down", "Descendre")} disabled={idx === list.length - 1} onClick={() => move(list, c, 1)} data-vsco-comp-item-down>
              ↓
            </button>
          </span>
        </div>
        {domaineFor === c.id && (
          <div className="card p-12 mt-8" data-vsco-comp-item-domaine-panel>
            <DomainePicker domaines={cycleDomaines} selected={c.ids_domaine_int ?? []} disabled={!c.ismanuelle} onToggle={(id) => toggleItemDomaine(c, id)} tr={tr} />
          </div>
        )}
      </li>
    );
  };

  return (
    <div data-vsco-comp-items>
      <h3 className="h5 mb-12">{tr("evaluations.competences.items.title", "Items de compétences")}</h3>
      <div className="d-flex gap-8 flex-wrap align-items-center mb-12">
        <input className="form-control" style={{ maxWidth: 420 }} type="search" placeholder={tr("evaluation.search.competence", "Rechercher une compétence")} aria-label={tr("evaluation.search.competence", "Rechercher une compétence")} value={keyword} onChange={(e) => setKeyword(e.target.value)} data-vsco-comp-item-search />
        <Button type="button" color="tertiary" variant="outline" onClick={() => setResetStep(1)} data-vsco-comp-items-reset>
          {tr("evaluations.perso.delete", "Réinitialiser")}
        </Button>
      </div>
      <div className="mb-12" role="radiogroup" aria-label={tr("evaluations.competences.items.title", "Items de compétences")}>
        <label className="me-16">
          <input type="radio" name="vsco-comp-items-mode" checked={!byDomaine} onChange={() => setByDomaine(false)} data-vsco-comp-mode="enseignements" /> {tr("evaluation.search.by.enseignements", "Vue par enseignements")}
        </label>
        <label>
          <input type="radio" name="vsco-comp-items-mode" checked={byDomaine} onChange={() => setByDomaine(true)} data-vsco-comp-mode="domaines" /> {tr("evaluation.search.by.domaines", "Vue par domaines")} {tr("evaluation.search.read.only", "(consultative)")}
        </label>
      </div>
      <CycleTabs cycles={cycles} selected={cycleId} onSelect={onSelectCycle} label={tr("evaluations.competences.items.title", "Items de compétences")} />
      {(enseignements.isLoading || domaines.isLoading) && <p className="text-muted">{tr("viescolaire.loading", "Chargement…")}</p>}
      {(enseignements.isError || domaines.isError) && (
        <p className="text-danger" role="alert">
          {tr("evaluations.competences.error.get", "Erreur lors de la récupération des items de compétences")}
        </p>
      )}

      {byDomaine ? (
        <div className="card p-12"><DomaineReadOnly domaines={cycleDomaines} keyword={keyword} /></div>
      ) : (
        <div className="card p-12" data-vsco-comp-enseignements>
          {cycleEns.length === 0 && !enseignements.isLoading && <p className="text-muted m-0">{tr("evaluations.competences.items.none", "Aucun item de compétences pour ce cycle.")}</p>}
          {cycleEns.map((e) => (
            <section key={e.id} className="mb-12" data-vsco-comp-enseignement={e.id}>
              <h4 className="h6">
                <button type="button" className="btn btn-link p-0 fw-bold text-start" aria-expanded={isOpen(`e${e.id}`, hasMatch(e, keyword))} onClick={() => toggle(`e${e.id}`)}>
                  <Highlighted text={e.nom} keyword={keyword} />
                </button>
              </h4>
              {isOpen(`e${e.id}`, hasMatch(e, keyword)) &&
                e.competences.map((c) => {
                  const list = orderedItems(c.competences ?? []);
                  const connOpen = isOpen(`c${c.id}`, hasMatch(c, keyword));
                  return (
                    <div key={c.id} className="ps-16 mb-8" data-vsco-comp-connaissance={c.id}>
                      <div className="d-flex align-items-center gap-8">
                        <button type="button" className="btn btn-link p-0 text-start fw-bold" aria-expanded={connOpen} onClick={() => toggle(`c${c.id}`)}>
                          {c.nom}
                        </button>
                        <button type="button" className="btn btn-sm btn-outline-primary" aria-label={`${tr("viescolaire.create.item", "Créer une compétence")} - ${c.nom}`} onClick={() => setCreating(newItemFor(c, structureId))} data-vsco-comp-item-add>
                          +
                        </button>
                      </div>
                      {connOpen && <ul className="list-unstyled ps-16 mb-0">{list.map((it, i) => itemRow(it, list, i))}</ul>}
                    </div>
                  );
                })}
            </section>
          ))}
        </div>
      )}

      <Modal id="vsco-comp-item-create" isOpen={!!creating} onModalClose={() => setCreating(null)} size="lg">
        <Modal.Header onModalClose={() => setCreating(null)}>{tr("viescolaire.create.item", "Créer une compétence")}</Modal.Header>
        <Modal.Body>
          {creating && (
            <>
              <div className="mb-12">
                <label htmlFor="vsco-comp-item-nom" className="form-label fw-bold">
                  {tr("viescolaire.libelle", "Libellé")} *
                </label>
                <input id="vsco-comp-item-nom" className="form-control" value={creating.nom} onChange={(e) => setCreating({ ...creating, nom: e.target.value })} data-vsco-comp-item-nom />
              </div>
              <p className="fw-bold mb-4">{tr("item.show.domaine", "Afficher/Cacher les domaines")} *</p>
              <DomainePicker domaines={cycleDomaines} selected={creating.ids_domaine} disabled={false} onToggle={(id, on) => setCreating({ ...creating, ids_domaine: toggleDomaine(creating.ids_domaine, id, on) })} tr={tr} />
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" color="tertiary" variant="ghost" onClick={() => setCreating(null)}>
            {tr("competences.cancel", "Annuler")}
          </Button>
          <Button type="button" color="primary" disabled={!creating || !canSaveItem(creating)} onClick={create} data-vsco-comp-item-save>
            {tr("viescolaire.utils.save", "Enregistrer")}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal id="vsco-comp-items-reset" isOpen={resetStep > 0} onModalClose={() => { setResetStep(0); setResetError(false); }} size="md">
        <Modal.Header onModalClose={() => { setResetStep(0); setResetError(false); }}>{tr("evaluations.perso.delete", "Réinitialiser")}</Modal.Header>
        <Modal.Body>
          {resetStep === 1 && <p className="m-0">{tr("evaluations.perso.item.delete.message", "Attention, vous vous apprêtez à réinstaller toutes les valeurs par défaut des items de compétences pour votre établissement. Souhaitez-vous continuer ?")}</p>}
          {resetStep === 2 && (resetError ? (
            <p className="text-danger m-0" role="alert">{tr("evaluations.perso.item.delete.error", "Désolé, Une erreur est survenue lors de la réinitiatisation.")}</p>
          ) : (
            <p className="m-0">{tr("item.message.delete.perso.confirm", "Attention, ce que vous allez faire est définitif. Êtes vous vraiment sur de vouloir tout réinitialiser ?")}</p>
          ))}
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" color="tertiary" variant="ghost" onClick={() => { setResetStep(0); setResetError(false); }}>
            {tr("competences.cancel", "Annuler")}
          </Button>
          <Button type="button" color="danger" onClick={() => (resetStep === 1 ? setResetStep(2) : resetAll())} data-vsco-comp-items-reset-confirm>
            {tr("evaluations.perso.ok", "Ok")}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};
