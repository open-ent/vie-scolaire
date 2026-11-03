import { HintText } from "../components/HintText";
import { MassmailingTemplates } from "../components/MassmailingTemplates";
import { Button, Modal } from "@open-ent/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useStructure } from "../components/StructureContext";
import { hasWorkflow } from "../lib/access";
import {
  absenceAlertBell,
  canCreate,
  catalogCreateBody,
  CatalogForm,
  catalogFormOf,
  CatalogId,
  CatalogItem,
  catalogToggleBody,
  catalogUpdateBody,
  draftOfReason,
  emptyCatalogForm,
  emptyReasonDraft,
  EventRecoveryMethod,
  initButtons,
  INIT_RIGHTS,
  InitType,
  isModuleActive,
  isValidLabel,
  latenessAlertBell,
  nextThreshold,
  parseThreshold,
  PresencesSetting,
  reasonCreateBody,
  ReasonDraft,
  ReasonKind,
  reasonToggleBody,
  reasonUpdateBody,
  RECOVERY_METHODS,
  recoveryMethodOf,
  Reason,
  resetCatalogForm,
  resetReasonDraft,
  SERIOUSNESS_COLORS,
  SERIOUSNESS_LEVELS,
  sortById,
  sortReasons,
  splitPunishments,
  THRESHOLDS,
  ThresholdRef,
  visibilityState,
  visibleReasons,
  withDefaults,
} from "../lib/presences";
import { useMe } from "../services/queries";
import { catalogService, moduleActivationService, presencesInitService, presencesSettingsService, reasonsService } from "../services/presences.service";

// Libellés : clés d'origine du module Présences (et Incidents) ; le français de repli est celui du fr.json.
const NS = ["presences", "incidents", "viescolaire"];

type Notify = (ok: boolean, text: string) => void;

/** Traducteur commun : `tr(clé, repli)` ; les espaces de noms Présences/Incidents se chargent à la demande, sans bloquer l'écran. */
const useTr = () => {
  const { t } = useTranslation(NS, { useSuspense: false });
  return (key: string, fallback: string) => t(key, { ns: NS, defaultValue: fallback });
};

/** Titre de section, avec l'ancre que visent les raccourcis du bandeau. */
const SectionCard = ({ anchor, title, children }: { anchor?: string; title: string; children: ReactNode }) => (
  <section className="card p-16 mb-16" aria-label={title} data-vsco-presences-section={anchor}>
    <h3 className="h5 mb-12">{title}</h3>
    {anchor && <HintText id={`presences.${anchor}`} />}
    {children}
  </section>
);

const Oui = ({ name, value, onChange, trueValue = true, falseValue = false, id }: { name: string; value: boolean; onChange: (v: boolean) => void; trueValue?: boolean; falseValue?: boolean; id: string }) => {
  const tr = useTr();
  return (
    <div className="d-flex gap-16">
      <div className="form-check form-check-inline">
        <input className="form-check-input" type="radio" id={`${id}-oui`} name={name} checked={value === trueValue} onChange={() => onChange(trueValue)} />
        <label className="form-check-label" htmlFor={`${id}-oui`}>
          {tr("true.maj", "Oui")}
        </label>
      </div>
      <div className="form-check form-check-inline">
        <input className="form-check-input" type="radio" id={`${id}-non`} name={name} checked={value === falseValue} onChange={() => onChange(falseValue)} />
        <label className="form-check-label" htmlFor={`${id}-non`}>
          {tr("false.maj", "Non")}
        </label>
      </div>
    </div>
  );
};

const Check = ({ id, checked, onChange, label, attr }: { id: string; checked: boolean; onChange: (v: boolean) => void; label: string; attr?: Record<string, string> }) => (
  <div className="form-check">
    <input className="form-check-input" type="checkbox" id={id} checked={checked} onChange={(e) => onChange(e.target.checked)} {...attr} />
    <label className="form-check-label" htmlFor={id}>
      {label}
    </label>
  </div>
);

/** Icônes de fin de ligne : masquer/afficher (élément déjà utilisé) ou supprimer (élément jamais utilisé). */
const RowActions = ({ item, onEdit, onToggle, onDelete, scope }: { item: { used?: boolean | null; hidden?: boolean | null }; onEdit: () => void; onToggle: () => void; onDelete: () => void; scope: string }) => {
  const tr = useTr();
  const state = visibilityState(item);
  return (
    <span className="d-flex gap-8 flex-wrap">
      <button type="button" className="btn btn-sm btn-secondary" onClick={onEdit} data-vsco-presences-edit={scope}>
        {tr("edit", "Modifier")}
      </button>
      {state !== "deletable" && (
        <button type="button" className="btn btn-sm btn-outline-secondary" aria-pressed={state === "hidden"} onClick={onToggle} data-vsco-presences-toggle={scope} data-vsco-presences-state={state}>
          {state === "visible" ? tr("presences.visibility.hide", "Masquer") : tr("presences.visibility.show", "Afficher")}
        </button>
      )}
      {state === "deletable" && (
        <button type="button" className="btn btn-sm btn-outline-danger" onClick={onDelete} data-vsco-presences-delete={scope}>
          {tr("delete", "Supprimer")}
        </button>
      )}
    </span>
  );
};

// ───────────────────────────── Motifs d'absence / de retard ─────────────────────────────

const ReasonSection = ({ kind, notify }: { kind: ReasonKind; notify: Notify }) => {
  const tr = useTr();
  const { id: structureId } = useStructure();
  const qc = useQueryClient();
  const key = ["presencesReasons", structureId, kind];
  const list = useQuery({ queryKey: key, queryFn: () => reasonsService.list(structureId, kind) });
  const [form, setForm] = useState<ReasonDraft>(() => emptyReasonDraft(kind));
  const [edit, setEdit] = useState<ReasonDraft | null>(null);
  const reasons = useMemo(() => sortReasons(visibleReasons(list.data ?? [])), [list.data]);
  const absence = kind === "absence";
  const err = (text: string) => notify(false, text);
  const reload = () => qc.invalidateQueries({ queryKey: key });

  const create = async () => {
    try {
      await reasonsService.create(kind, reasonCreateBody(structureId, form));
      setForm(resetReasonDraft(kind, form));
      await reload();
    } catch {
      err(tr("presences.react.error", "Une erreur est survenue"));
    }
  };
  const save = async () => {
    if (!edit) return;
    try {
      await reasonsService.update(reasonUpdateBody(edit));
      setEdit(null);
      await reload();
    } catch {
      err(tr("presences.reason.error", "Une erreur est survenue lors de la modification d'un motif."));
    }
  };
  const toggle = async (r: Reason) => {
    try {
      await reasonsService.update(reasonToggleBody(r));
    } catch {
      err(tr("presences.reason.error", "Une erreur est survenue lors de la modification d'un motif."));
    }
    await reload();
  };
  const remove = async (r: Reason) => {
    try {
      await reasonsService.remove(r.id);
    } catch {
      err(tr("presences.react.error", "Une erreur est survenue"));
    }
    await reload();
  };

  const complianceKey = absence ? "presences.compliance.absence" : "presences.lateness.reason.compliance.form.input";
  const complianceFallback = absence
    ? "Ce motif doit-il être pris en compte dans la comptatibilité des absences pour le bulletin de l'élève ?"
    : "Ce motif doit-il être pris en compte dans la comptatibilité des retards pour le bulletin de l'élève ?";
  const title = absence ? tr("presences.absence.reason.title", "Motifs d'absences") : tr("presences.lateness.reasons", "Motifs des retards");
  const p = `vsco-pres-${kind}`;

  return (
    <SectionCard anchor={absence ? "absence" : "lateness"} title={title}>
      <div className="mb-12">
        <label htmlFor={`${p}-label`} className="form-label fw-bold">
          {absence
            ? tr("presences.absence.reason.form.input", "Saisissez ici un motif d'absence individuelle que vous pourrez utiliser dans l'application Présences")
            : tr("presences.lateness.reason.form.input", "Saisissez ici un motif du retard individuelle que vous pourrez utiliser dans l'application Présences")}
        </label>
        <input
          id={`${p}-label`}
          className="form-control"
          style={{ maxWidth: 420 }}
          placeholder={absence ? tr("presences.absence.reason.placeholder", "Maladie ...") : tr("presences.lateness.reason.placeholder", "Réveil ...")}
          value={form.label}
          onChange={(e) => setForm({ ...form, label: e.target.value })}
          data-vsco-presences-label={kind}
        />
      </div>
      {absence && (
        <fieldset className="mb-12">
          <legend className="form-label fw-bold fs-6">{tr("presences.regularisable", "Ce motif nécessite-t-il une régularisation pour être justifié ?")}</legend>
          {/* « Oui » = à régulariser, donc proving=false */}
          <Oui id={`${p}-reg`} name={`${p}-reg`} value={form.proving} trueValue={false} falseValue={true} onChange={(v) => setForm({ ...form, proving: v })} />
        </fieldset>
      )}
      <fieldset className="mb-12">
        <legend className="form-label fw-bold fs-6">{tr(complianceKey, complianceFallback)}</legend>
        <Oui id={`${p}-comp`} name={`${p}-comp`} value={form.absenceCompliance} onChange={(v) => setForm({ ...form, absenceCompliance: v })} />
      </fieldset>
      <fieldset className="mb-12">
        {absence ? (
          <>
            <legend className="form-label fw-bold fs-6">{tr("presences.alert.rules", "Ce motif compte dans les alertes")}</legend>
            <Check id={`${p}-reg-alert`} checked={form.excludeAlertRegularised} onChange={(v) => setForm({ ...form, excludeAlertRegularised: v })} label={tr("presences.alert.rules.regularised", "Quand il est régularisé")} />
            <Check id={`${p}-noreg-alert`} checked={form.excludeAlertNoRegularised} onChange={(v) => setForm({ ...form, excludeAlertNoRegularised: v })} label={tr("presences.alert.rules.no.regularised", "Quand il est non-régularisé")} />
          </>
        ) : (
          <Check id={`${p}-late-alert`} checked={form.excludeAlertLateness} onChange={(v) => setForm({ ...form, excludeAlertLateness: v })} label={tr("presences.alert.rules", "Ce motif compte dans les alertes")} />
        )}
      </fieldset>
      <Button type="button" color="primary" disabled={!isValidLabel(form.label)} onClick={create} data-vsco-presences-add={kind}>
        {tr("add", "Ajouter")}
      </Button>

      {list.isError && (
        <p className="text-danger mt-12" role="alert" data-vsco-presences-error={kind}>
          {tr("presences.react.error", "Une erreur est survenue")}
        </p>
      )}
      {list.isLoading && (
        <p className="text-muted mt-12" role="status" data-vsco-presences-loading={kind}>
          {tr("presences.loading", "Chargement…")}
        </p>
      )}
      {reasons.length > 0 && (
        <div className="mt-16">
          <p className="fw-bold mb-8">{tr("presence.existed.reasons", "Motifs existants")}</p>
          <ul className="list-unstyled m-0" data-vsco-presences-list={kind}>
            {reasons.map((r) => {
              const aBell = absence ? absenceAlertBell(r) : null;
              const bellColor = absence ? aBell?.color : latenessAlertBell(r)?.color;
              const bellText = absence ? (aBell ? tr(aBell.titleKey, aBell.titleDefault) : "") : tr("presences.absence.reason.lateness", "Alerte pour ce motif");
              return (
                <li key={r.id} className="d-flex align-items-center justify-content-between flex-wrap gap-8 py-8 border-bottom" data-vsco-presences-row={r.label}>
                  <span className="d-flex align-items-center flex-wrap gap-8">
                    <span>{r.label}</span>
                    {!r.proving && (
                      <span className="badge text-bg-warning" title={tr("presences.absence.reason.regularisation.necessary", "Régularisation nécessaire")}>
                        {tr("presences.absence.reason.regularisation.necessary", "Régularisation nécessaire")}
                      </span>
                    )}
                    {r.absence_compliance && (
                      <span className="badge text-bg-light" title={tr("presences.absence.reason.notebook.into.account", "Pris en compte bulletin")}>
                        {tr("presences.absence.reason.notebook.into.account", "Pris en compte bulletin")}
                      </span>
                    )}
                    {bellColor && (
                      <span className="badge" style={{ background: bellColor, color: "#212529" }} title={bellText} data-vsco-presences-bell>
                        {bellText}
                      </span>
                    )}
                  </span>
                  <RowActions item={r} scope={kind} onEdit={() => setEdit(draftOfReason(kind, r))} onToggle={() => toggle(r)} onDelete={() => remove(r)} />
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <Modal id={`vsco-presences-${kind}-edit`} isOpen={!!edit} onModalClose={() => setEdit(null)} size="md">
        <Modal.Header onModalClose={() => setEdit(null)}>{tr("presences.absence.reason.edit", "Modifier le motif")}</Modal.Header>
        <Modal.Body>
          {edit && (
            <>
              <p className="text-muted">{tr("presences.absence.edit.warning", "Attention, la modification du motif entraînera une modification sur toutes les absences déjà saisies avec ce motif.")}</p>
              <div className="mb-12">
                <label htmlFor={`${p}-edit-label`} className="form-label fw-bold">
                  {tr("presences.absence.reason.title", "Motifs d'absences")}
                </label>
                <input id={`${p}-edit-label`} className="form-control" value={edit.label} onChange={(e) => setEdit({ ...edit, label: e.target.value })} data-vsco-presences-edit-label />
              </div>
              {absence && (
                <fieldset className="mb-12">
                  <legend className="form-label fw-bold fs-6">{tr("presences.regularisable", "Ce motif nécessite-t-il une régularisation pour être justifié ?")}</legend>
                  <Oui id={`${p}-edit-reg`} name={`${p}-edit-reg`} value={edit.proving} trueValue={false} falseValue={true} onChange={(v) => setEdit({ ...edit, proving: v })} />
                </fieldset>
              )}
              <fieldset className="mb-12">
                <legend className="form-label fw-bold fs-6">{tr("presences.compliance.absence", "Ce motif doit-il être pris en compte dans la comptatibilité des absences pour le bulletin de l'élève ?")}</legend>
                <Oui id={`${p}-edit-comp`} name={`${p}-edit-comp`} value={edit.absenceCompliance} onChange={(v) => setEdit({ ...edit, absenceCompliance: v })} />
              </fieldset>
              <fieldset>
                {absence ? (
                  <>
                    <legend className="form-label fw-bold fs-6">{tr("presences.alert.rules", "Ce motif compte dans les alertes")}</legend>
                    <Check id={`${p}-edit-reg-alert`} checked={edit.excludeAlertRegularised} onChange={(v) => setEdit({ ...edit, excludeAlertRegularised: v })} label={tr("presences.alert.rules.regularised", "Quand il est régularisé")} />
                    <Check id={`${p}-edit-noreg-alert`} checked={edit.excludeAlertNoRegularised} onChange={(v) => setEdit({ ...edit, excludeAlertNoRegularised: v })} label={tr("presences.alert.rules.no.regularised", "Quand il est non-régularisé")} />
                  </>
                ) : (
                  <Check id={`${p}-edit-late-alert`} checked={edit.excludeAlertLateness} onChange={(v) => setEdit({ ...edit, excludeAlertLateness: v })} label={tr("presences.alert.rules", "Ce motif compte dans les alertes")} />
                )}
              </fieldset>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" color="tertiary" variant="ghost" onClick={() => setEdit(null)}>
            {tr("evaluations.devoir.annuler", "Annuler")}
          </Button>
          <Button type="button" color="primary" disabled={!edit || !isValidLabel(edit.label)} onClick={save} data-vsco-presences-edit-save>
            {tr("edit", "Modifier")}
          </Button>
        </Modal.Footer>
      </Modal>
    </SectionCard>
  );
};

// ───────────────────────────────────── Paramètres ─────────────────────────────────────

/** Lecture et écriture des paramètres de la structure (partagées par appels multiples, alertes et comptage). */
const useSettings = () => {
  const { id: structureId } = useStructure();
  const qc = useQueryClient();
  const key = ["presencesSettings", structureId];
  const query = useQuery({ queryKey: key, queryFn: () => presencesSettingsService.get(structureId) });
  const save = async (body: PresencesSetting) => {
    await presencesSettingsService.put(structureId, body);
    await qc.invalidateQueries({ queryKey: key });
  };
  return { query, save };
};

const MultipleSlotsSection = ({ notify }: { notify: Notify }) => {
  const tr = useTr();
  const { query, save } = useSettings();
  const allow = !!query.data?.allow_multiple_slots;
  const change = async (v: boolean) => {
    try {
      await save({ allow_multiple_slots: v });
      notify(true, tr("presences.multiple.slots.manage.save.confirm", "Appels multiples : modification enregistrée avec succès"));
    } catch {
      notify(false, tr("presences.multiple.slots.manage.save.error", "Appels multiples : une erreur est survenue lors de la sauvegarde du paramètrage"));
    }
  };
  return (
    <SectionCard anchor="multiple-slots" title={tr("presences.multiple.slots.manage.title", "Appels multiples")}>
      {query.isError ? (
        <p className="text-danger" role="alert" data-vsco-presences-error="multiple-slots">
          {tr("presences.multiple.slots.manage.load.error", "Appels multiples : une erreur est survenue lors de la récupération du paramètrage")}
        </p>
      ) : (
        <div className="form-check form-switch">
          <input className="form-check-input" type="checkbox" role="switch" id="vsco-pres-multiple-slots" checked={allow} disabled={query.isLoading} onChange={(e) => change(e.target.checked)} data-vsco-presences-multiple-slots />
          <label className="form-check-label" htmlFor="vsco-pres-multiple-slots">
            {tr("presences.multiple.slots.manage.description", "Activer les appels multiples pour les cours dépassant 1h")}
          </label>
        </div>
      )}
    </SectionCard>
  );
};

const AlertSection = ({ notify }: { notify: Notify }) => {
  const tr = useTr();
  const { query, save } = useSettings();
  const setting = useMemo(() => withDefaults(query.data), [query.data]);
  const [values, setValues] = useState<Record<string, string>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Les champs reprennent les valeurs du serveur à chaque rechargement.
  useEffect(() => {
    setValues(Object.fromEntries(THRESHOLDS.map((x) => [x.ref, String(setting[x.ref] ?? 0)])));
  }, [setting]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const send = async (patch: PresencesSetting) => {
    try {
      await save({ ...setting, ...patch });
      notify(true, tr("presences.alert.manage.event.method.save.confirm", "Enregistrement du seuil d'alerte: modification enregistrée avec succès"));
    } catch {
      notify(false, tr("presences.alert.manage.event.method.save.error", "Enregistrement du seuil d'alerte: une erreur est survenue lors de la sauvegarde du paramètrage"));
    }
  };
  const step = (ref: ThresholdRef, inc: boolean) => send({ [ref]: nextThreshold(Number(values[ref]), inc) });
  // Saisie au clavier : enregistrée 200 ms après la dernière frappe.
  const type = (ref: ThresholdRef, raw: string) => {
    setValues((v) => ({ ...v, [ref]: raw }));
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const n = parseThreshold(raw);
      if (n !== null) void send({ [ref]: n });
    }, 200);
  };

  return (
    <SectionCard anchor="alert" title={tr("presences.alerts.title", "Alertes")}>
      {query.isError && (
        <p className="text-danger" role="alert" data-vsco-presences-error="alert">
          {tr("presences.react.error", "Une erreur est survenue")}
        </p>
      )}
      <p className="fw-bold">{tr("presences.alerts.form.input", "Saisissez ici le nombre d'événements à atteindre par élève avant de déclencher une alerte")}</p>
      {THRESHOLDS.map((x) => (
        <div key={x.ref} className="d-flex align-items-center gap-12 mb-8" data-vsco-presences-threshold={x.ref}>
          <label htmlFor={`vsco-pres-${x.ref}`} style={{ minWidth: 140 }}>
            {tr(x.key, x.label)}
          </label>
          <button type="button" className="btn btn-sm btn-outline-secondary" aria-label={`− ${tr(x.key, x.label)}`} onClick={() => step(x.ref, false)} data-vsco-presences-minus={x.ref}>
            −
          </button>
          <input id={`vsco-pres-${x.ref}`} type="number" min={0} className="form-control" style={{ width: 90 }} value={values[x.ref] ?? ""} onChange={(e) => type(x.ref, e.target.value)} data-vsco-presences-input={x.ref} />
          <button type="button" className="btn btn-sm btn-outline-secondary" aria-label={`+ ${tr(x.key, x.label)}`} onClick={() => step(x.ref, true)} data-vsco-presences-plus={x.ref}>
            +
          </button>
        </div>
      ))}
      <div className="mt-12">
        <Check
          id="vsco-pres-excl-absence"
          checked={!!setting.exclude_alert_absence_no_reason}
          onChange={(v) => send({ exclude_alert_absence_no_reason: v })}
          label={tr("presences.alerts.exclude.absence.no.reason", "Les absences sans motif comptent dans les alertes")}
          attr={{ "data-vsco-presences-exclude": "absence" }}
        />
        <Check
          id="vsco-pres-excl-lateness"
          checked={!!setting.exclude_alert_lateness_no_reason}
          onChange={(v) => send({ exclude_alert_lateness_no_reason: v })}
          label={tr("presences.alerts.exclude.lateness.no.reason", "Les retards sans motif comptent dans les alertes")}
          attr={{ "data-vsco-presences-exclude": "lateness" }}
        />
        <Check
          id="vsco-pres-excl-notebook"
          checked={!!setting.exclude_alert_forgotten_notebook}
          onChange={(v) => send({ exclude_alert_forgotten_notebook: v })}
          label={tr("presences.alerts.exclude.foregotten.notebook", "Les carnets oubliés comptent dans les alertes")}
          attr={{ "data-vsco-presences-exclude": "notebook" }}
        />
      </div>
    </SectionCard>
  );
};

const StatisticsSection = ({ notify }: { notify: Notify }) => {
  const tr = useTr();
  const { query, save } = useSettings();
  const method = recoveryMethodOf(query.data);
  const change = async (v: EventRecoveryMethod) => {
    try {
      await save({ event_recovery_method: v });
      notify(true, tr("presences.statistics.manage.event.inventory.method.save.confirm", "Comptage des événements: modification enregistrée avec succès"));
    } catch {
      notify(false, tr("presences.statistics.manage.event.inventory.method.save.error", "Comptage des événements: une erreur est survenue lors de la sauvegarde du paramètrage"));
    }
  };
  return (
    <SectionCard anchor="statistics" title={tr("presences.statistics.manage.title", "Comptage des événements")}>
      <p>{tr("presences.statistics.manage.description", "Sélectionnez ici la façon de recencer les absences, retards et autres événements dans Présences. Ce comptage intervient dans Alertes, Statistiques, Publipostage, Bulletin")}</p>
      {query.isError ? (
        <p className="text-danger" role="alert" data-vsco-presences-error="statistics">
          {tr("presences.statistics.manage.event.inventory.method.load.error", "Comptage des événements: une erreur est survenue lors de la récupération du paramètrage")}
        </p>
      ) : (
        <fieldset className="d-flex align-items-center flex-wrap gap-16">
          <legend className="fs-6 fw-bold float-none w-auto m-0">{tr("presences.statistics.manage.events.inventory.method", "Recenser les absences")} :</legend>
          {RECOVERY_METHODS.map((m) => (
            <div key={m.value} className="form-check form-check-inline">
              <input className="form-check-input" type="radio" name="vsco-pres-recovery" id={`vsco-pres-recovery-${m.value}`} checked={method === m.value} disabled={query.isLoading} onChange={() => change(m.value)} data-vsco-presences-recovery={m.value} />
              <label className="form-check-label" htmlFor={`vsco-pres-recovery-${m.value}`}>
                {tr(m.key, m.label)}
              </label>
            </div>
          ))}
        </fieldset>
      )}
    </SectionCard>
  );
};

// ──────────────── Catalogues : actions, disciplines, incidents, punitions et sanctions ────────────────

interface CatalogText {
  title: [string, string];
  input: [string, string];
  placeholder?: [string, string];
  list: [string, string];
  editTitle: [string, string];
  editWarning: [string, string];
  anchor?: string;
}

const CATALOG_TEXT: Record<CatalogId, CatalogText> = {
  action: {
    title: ["presences.absence.actions.progress.absences", "Actions en cours sur les absences"],
    input: ["presences.absence.actions.form.input", "Saisissez ici une action que vous pouvez réaliser sur une absence. Ce paramètre vous permettra d'indiquer pour chaque absence, l'action en cours et donc de suivre le traitement de l'absence"],
    placeholder: ["presences.absence.actions.placeholder", "Appel parents..."],
    list: ["presence.absence.actions.existed", "Actions existantes"],
    editTitle: ["presence.absence.actions.update", "Modifier l'action"],
    editWarning: ["presences.absence.actions.warning.update", "Attention, la modification de l'action entraînera une modification sur tous les événements déjà saisis avec cette action."],
    anchor: "action",
  },
  discipline: {
    title: ["presences.discipline.form.title", "Lieux, disciplines, autres pour déclarer des présences"],
    input: ["presences.discipline.form.input", "Saisissez ici un lieu (ou une discipline ou autres) pour lesquel il sera possible de déclarer des présences (et non des absences)"],
    placeholder: ["presences.discipline.form.input.threshold", "CDI, infirmerie, sortie..."],
    list: ["presence.existed.disciplines", "Lieux, disciplines, autres existants"],
    editTitle: ["presences.discipline.edit.title", "Modifier la discipline"],
    editWarning: ["presences.discipline.edit.warning", "Attention, la modification d'une discipline entraînera une modification sur toutes les présences déjà saisies avec cette discipline."],
    anchor: "discipline",
  },
  incidentType: {
    title: ["incident.type.title", "Types d'incidents"],
    input: ["incident.type.form.input", "Saisissez ici un type d'incidents que vous pourrez utiliser dans l'application Présences"],
    placeholder: ["incident.type.form.input.placeholder", "Injure, agression..."],
    list: ["incident.type.lists", "Types d'incidents existants"],
    editTitle: ["incident.type.form.input.edit", "Modifier le type d'incident"],
    editWarning: ["incident.type.form.input.edit.warning", "Attention, la modification du type d'incident entraînera une modification sur tous les incidents déjà saisis avec ce type d'incident."],
    anchor: "incidents",
  },
  place: {
    title: ["incident.place.title", "Lieux d'incidents"],
    input: ["incident.place.form.input", "Saisissez ici un lieu d'incidents que vous pourrez utiliser dans l'application Présences"],
    placeholder: ["presences.incident.place.form.input.placeholder", "Cour de récréation, classe..."],
    list: ["incident.place.lists", "Lieux d'incidents existants"],
    editTitle: ["incident.place.form.input.edit", "Modifier le lieu d'incident"],
    editWarning: ["incident.place.form.input.edit.warning", "Attention, la modification d'un lieu d'incident entraînera une modification sur tous les incidents déjà saisis avec ce lieu d'incident."],
  },
  protagonist: {
    title: ["incident.protagonist.type.title", "Types de protagonistes"],
    input: ["incident.protagonist.type.form.input", "Saisissez ici un type de protagonistes lors d'un incident que vous pourrez utiliser dans l'application Présences"],
    placeholder: ["incident.protagonist.type.form.input.placeholder", "Victime, agresseur, témoin..."],
    list: ["incident.protagonist.type.lists", "Types d'incidents existants"],
    editTitle: ["incident.protagonist.type.form.input.edit", "Modifier le type de protagonist"],
    editWarning: ["incident.protagonist.type.form.input.edit.warning", "Attention, la modification d'un type de protagonist entraînera une modification sur tous les incidents déjà saisis avec ce type de protagonist."],
  },
  seriousness: {
    title: ["incident.seriousness.title", "Niveaux de gravité d'un incident"],
    input: ["incident.seriousness.form.input", "Saisissez ici un niveau de gravité d'un incident que vous pourrez utiliser dans l'application Présences"],
    placeholder: ["incident.seriousness.form.input.placeholder", "Peu grave, grave..."],
    list: ["incident.seriousness.lists", "Niveaux de gravité existants"],
    editTitle: ["incident.seriousness.form.input.edit", "Modifier le niveau de gravité"],
    editWarning: ["incident.seriousness.form.input.edit.warning", "Attention, la modification d'un niveau de gravité entraînera une modification sur tous les incidents déjà saisis avec ce niveau de gravité."],
  },
  partner: {
    title: ["incident.partner.title", "Partenaires à prévenir en cas d'incidents"],
    input: ["incident.partner.form.input", "Saisissez ici un partenaire à contacter lors d'un incident que vous pourrez utiliser dans l'application Présences"],
    placeholder: ["incident.partner.form.input.placeholder", "Police, association locale..."],
    list: ["incident.partner.lists", "Partenaires existants"],
    editTitle: ["incident.partner.form.input.edit", "Modifier le partenaire"],
    editWarning: ["incident.partner.form.input.edit.warning", "Attention, la modification d'un partenaire entraînera une modification sur tous les incidents déjà saisis avec ce partenaire."],
  },
  punishmentType: {
    title: ["presences.punishments.type.title", "Type de punitions et sanctions"],
    input: ["presences.punishments.type.form.input", "Saisissez ici un modèle  de punitions ou sanctions que vous pourrez utiliser dans l'application Présence"],
    placeholder: ["presences.punishments.type.form.input.placeholder", "Retenue"],
    list: ["presences.punishments.type.lists", "Types de punitions existants"],
    editTitle: ["presences.punishments.form.input.edit", "Modifier le type de punition ou sanction"],
    editWarning: ["presences.punishments.form.input.edit.warning", "Attention, la modification d'un type de punition ou sanction entraînera une modification sur toutes les punitions et les sanctions déjà saisies avec ce type"],
    anchor: "punishment",
  },
};

/** Messages de succès / d'échec propres aux actions et aux types de punition (les autres catalogues sont muets en cas de succès). */
const CATALOG_MESSAGES: Partial<Record<CatalogId, Record<"create" | "update" | "delete", { ok: [string, string]; ko: [string, string] }>>> = {
  action: {
    create: { ok: ["presences.absence.action.setting.method.create.confirm", "Création de l'action effectuée avec succès"], ko: ["presences.absence.action.setting.method.create.error", "Une erreur est survenue lors de la création de l'action"] },
    update: { ok: ["presences.absence.action.setting.method.update.confirm", "Modification de l'action effectuée avec succès"], ko: ["presences.absence.action.setting.method.update.error", "Une erreur est survenue lors de la modification de l'action"] },
    delete: { ok: ["presences.absence.action.setting.method.delete.confirm", "Suppression de l'action effectuée avec succès"], ko: ["presences.absence.action.setting.method.delete.error", "Une erreur est survenue lors de la suppression de l'action"] },
  },
  punishmentType: {
    create: { ok: ["presences.punishments.type.setting.method.create.confirm", "Création du type de punition ou sanction effectuée avec succès"], ko: ["presences.punishments.type.setting.method.create.error", "Une erreur est survenue lors de la création du type de punition ou sanction"] },
    update: { ok: ["presences.punishments.type.setting.method.update.confirm", "Modification du type de punition ou sanction effectuée avec succès"], ko: ["presences.punishments.type.setting.method.update.error", "Une erreur est survenue lors de la modification du type de punition ou sanction"] },
    delete: { ok: ["presences.punishments.type.setting.method.delete.confirm", "Suppression du type de punition ou sanction effectuée avec succès"], ko: ["presences.punishments.type.setting.method.delete.error", "Une erreur est survenue lors de la suppression du type de punition ou sanction"] },
  },
};

/** Pastilles de gravité 0 à 7 (choix de la couleur d'un niveau). */
const LevelPicker = ({ value, onChange, name }: { value: number; onChange: (n: number) => void; name: string }) => {
  const tr = useTr();
  return (
    <div role="radiogroup" aria-label={tr("incident.seriousness.form.input.color", "Sélectionnez la couleur à attribuer à ce niveau de gravité")} className="d-flex gap-8 flex-wrap">
      {SERIOUSNESS_LEVELS.map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${name} ${n + 1}`}
          onClick={() => onChange(n)}
          data-vsco-presences-level={n}
          style={{ width: 24, height: 24, borderRadius: "50%", background: SERIOUSNESS_COLORS[n], border: value === n ? "3px solid #212529" : "1px solid #adb5bd", padding: 0 }}
        />
      ))}
    </div>
  );
};

const TypeRadios = ({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) => {
  const tr = useTr();
  return (
    <div className="d-flex gap-16">
      {[
        ["PUNISHMENT", tr("presences.punishment", "Punition")],
        ["SANCTION", tr("presences.sanction", "Sanction")],
      ].map(([v, label]) => (
        <div key={v} className="form-check form-check-inline">
          <input className="form-check-input" type="radio" id={`${id}-${v}`} name={id} checked={value === v} onChange={() => onChange(v)} data-vsco-presences-type={v} />
          <label className="form-check-label" htmlFor={`${id}-${v}`}>
            {label}
          </label>
        </div>
      ))}
    </div>
  );
};

const CatalogSection = ({ id, notify, nested }: { id: CatalogId; notify: Notify; nested?: boolean }) => {
  const tr = useTr();
  const { id: structureId } = useStructure();
  const qc = useQueryClient();
  const text = CATALOG_TEXT[id];
  const msgs = CATALOG_MESSAGES[id];
  const key = ["presencesCatalog", id, structureId];
  const list = useQuery({ queryKey: key, queryFn: () => catalogService.list(id, structureId) });
  const categories = useQuery({ queryKey: ["presencesPunishmentCategories"], queryFn: catalogService.punishmentCategories, enabled: id === "punishmentType" });
  const [form, setForm] = useState<CatalogForm>(emptyCatalogForm);
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [editForm, setEditForm] = useState<CatalogForm>(emptyCatalogForm);
  const items = useMemo(() => sortById(list.data ?? []), [list.data]);
  const split = useMemo(() => splitPunishments(list.data ?? []), [list.data]);
  const p = `vsco-pres-${id}`;
  const preview = categories.data?.find((c) => c.id === form.categoryId)?.url_img;

  /** Exécute l'appel puis recharge la liste ; message de succès/échec seulement pour les catalogues qui en avaient un. */
  const run = async (op: "create" | "update" | "delete", call: () => Promise<unknown>): Promise<boolean> => {
    const m = msgs?.[op];
    try {
      await call();
      if (m) notify(true, tr(m.ok[0], m.ok[1]));
      await qc.invalidateQueries({ queryKey: key });
      return true;
    } catch {
      notify(false, m ? tr(m.ko[0], m.ko[1]) : tr("presences.react.error", "Une erreur est survenue"));
      await qc.invalidateQueries({ queryKey: key });
      return false;
    }
  };

  const create = async () => {
    if (await run("create", () => catalogService.create(id, catalogCreateBody(id, structureId, form)))) setForm(resetCatalogForm(id, form));
  };
  const saveEdit = async () => {
    if (!editing) return;
    if (await run("update", () => catalogService.update(id, catalogUpdateBody(id, editing, editForm, !!editing.hidden)))) setEditing(null);
  };

  const renderRow = (item: CatalogItem) => (
    <li key={item.id} className="d-flex align-items-center justify-content-between flex-wrap gap-8 py-8 border-bottom" data-vsco-presences-row={item.label}>
      <span className="d-flex align-items-center flex-wrap gap-8">
        <span>{id === "action" ? `${item.label} (${item.abbreviation ?? ""})` : item.label}</span>
        {id === "seriousness" && !item.exclude_alert_seriousness && (
          <span className="badge" style={{ background: "#ffb600", color: "#212529" }} title={tr("incidents.seriousness.alert.rules", "Ce niveau de gravité compte dans les alertes")} data-vsco-presences-bell>
            {tr("incidents.seriousness.alert.rules", "Ce niveau de gravité compte dans les alertes")}
          </span>
        )}
        {id === "seriousness" && (
          <span aria-hidden="true" style={{ display: "inline-block", width: 18, height: 18, borderRadius: "50%", background: SERIOUSNESS_COLORS[item.level ?? 0] }} data-vsco-presences-level-dot={item.level} />
        )}
      </span>
      <RowActions
        item={item}
        scope={id}
        onEdit={() => {
          setEditing(item);
          setEditForm(catalogFormOf(item));
        }}
        onToggle={() => run("update", () => catalogService.update(id, catalogToggleBody(id, item)))}
        onDelete={() => run("delete", () => catalogService.remove(id, item.id))}
      />
    </li>
  );

  const body = (
    <>
      <div className="mb-12">
        <label htmlFor={`${p}-label`} className="form-label fw-bold">
          {tr(text.input[0], text.input[1])}
        </label>
        {id === "punishmentType" && (
          <div className="mb-8">
            <label htmlFor={`${p}-category`} className="visually-hidden">
              {tr("presences.punishments.select.category", "Choisissez un modèle")}
            </label>
            <select id={`${p}-category`} className="form-select" style={{ maxWidth: 320 }} value={form.categoryId ?? ""} onChange={(e) => setForm({ ...form, categoryId: e.target.value === "" ? null : Number(e.target.value) })} data-vsco-presences-category>
              <option value="">{tr("presences.punishments.model.title", "Modèles")}</option>
              {(categories.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <div className="mt-8">
              <TypeRadios id={`${p}-type`} value={form.type} onChange={(v) => setForm({ ...form, type: v })} />
            </div>
          </div>
        )}
        <input id={`${p}-label`} className="form-control" style={{ maxWidth: 420 }} placeholder={text.placeholder ? tr(text.placeholder[0], text.placeholder[1]) : undefined} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} data-vsco-presences-label={id} />
      </div>
      {id === "action" && (
        <div className="mb-12">
          <label htmlFor={`${p}-abbr`} className="form-label fw-bold">
            {tr("presences.absence.actions.form.abbreviation.input", "Abréviation à utiliser dans le tableau des événements")}
          </label>
          <input id={`${p}-abbr`} className="form-control" style={{ maxWidth: 220 }} maxLength={10} placeholder={tr("presences.absence.actions.abbreviation.placeholder", "AP...")} value={form.abbreviation} onChange={(e) => setForm({ ...form, abbreviation: e.target.value })} data-vsco-presences-abbreviation />
        </div>
      )}
      {id === "seriousness" && (
        <>
          <div className="mb-12">
            <p className="fw-bold mb-8">{tr("incident.seriousness.form.input.color", "Sélectionnez la couleur à attribuer à ce niveau de gravité")}</p>
            <LevelPicker name={tr("incident.seriousness.title", "Niveaux de gravité d'un incident")} value={form.level} onChange={(n) => setForm({ ...form, level: n })} />
          </div>
          <div className="mb-12">
            <Check id={`${p}-alert`} checked={form.excludeAlertSeriousness} onChange={(v) => setForm({ ...form, excludeAlertSeriousness: v })} label={tr("incidents.seriousness.alert.rules", "Ce niveau de gravité compte dans les alertes")} />
          </div>
        </>
      )}
      <Button type="button" color="primary" disabled={!canCreate(id, form)} onClick={create} data-vsco-presences-add={id}>
        {tr("add", "Ajouter")}
      </Button>
      {preview && (
        <div className="mt-12">
          <img src={preview} alt={tr("presences.punishments.preview", "template saisie de punitions et sanctions")} style={{ maxWidth: 320 }} />
        </div>
      )}

      {list.isError && (
        <p className="text-danger mt-12" role="alert" data-vsco-presences-error={id}>
          {tr("presences.react.error", "Une erreur est survenue")}
        </p>
      )}
      {list.isLoading && (
        <p className="text-muted mt-12" role="status" data-vsco-presences-loading={id}>
          {tr("presences.loading", "Chargement…")}
        </p>
      )}
      {id === "punishmentType" ? (
        <>
          {split.punishments.length > 0 && (
            <div className="mt-16">
              <p className="fw-bold mb-8">{tr(text.list[0], text.list[1])}</p>
              <ul className="list-unstyled m-0" data-vsco-presences-list="punishments">
                {split.punishments.map(renderRow)}
              </ul>
            </div>
          )}
          {split.sanctions.length > 0 && (
            <div className="mt-16">
              <p className="fw-bold mb-8">{tr("presences.sanctions.type.lists", "Types de sanctions existants")}</p>
              <ul className="list-unstyled m-0" data-vsco-presences-list="sanctions">
                {split.sanctions.map(renderRow)}
              </ul>
            </div>
          )}
        </>
      ) : (
        items.length > 0 && (
          <div className="mt-16">
            <p className="fw-bold mb-8">{tr(text.list[0], text.list[1])}</p>
            <ul className="list-unstyled m-0" data-vsco-presences-list={id}>
              {items.map(renderRow)}
            </ul>
          </div>
        )
      )}

      <Modal id={`vsco-presences-${id}-edit`} isOpen={!!editing} onModalClose={() => setEditing(null)} size="md">
        <Modal.Header onModalClose={() => setEditing(null)}>{tr(text.editTitle[0], text.editTitle[1])}</Modal.Header>
        <Modal.Body>
          <p className="text-muted">{tr(text.editWarning[0], text.editWarning[1])}</p>
          {id === "punishmentType" && (
            <>
              <label htmlFor={`${p}-edit-category`} className="form-label fw-bold">
                {tr("presences.punishments.select.category", "Choisissez un modèle")}
              </label>
              <select id={`${p}-edit-category`} className="form-select mb-12" value={editForm.categoryId ?? ""} onChange={(e) => setEditForm({ ...editForm, categoryId: Number(e.target.value) })} data-vsco-presences-edit-category>
                {(categories.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <p className="form-label fw-bold">{tr("presences.punishments.select.type", "Choisissez un type")}</p>
              <div className="mb-12">
                <TypeRadios id={`${p}-edit-type`} value={editForm.type} onChange={(v) => setEditForm({ ...editForm, type: v })} />
              </div>
            </>
          )}
          <label htmlFor={`${p}-edit-label`} className="form-label fw-bold visually-hidden">
            {tr(text.title[0], text.title[1])}
          </label>
          <input id={`${p}-edit-label`} className="form-control mb-12" value={editForm.label} onChange={(e) => setEditForm({ ...editForm, label: e.target.value })} data-vsco-presences-edit-label />
          {id === "action" && (
            <>
              <label htmlFor={`${p}-edit-abbr`} className="form-label fw-bold">
                {tr("presences.absence.actions.form.abbreviation.input", "Abréviation à utiliser dans le tableau des événements")}
              </label>
              <input id={`${p}-edit-abbr`} className="form-control mb-12" maxLength={10} value={editForm.abbreviation} onChange={(e) => setEditForm({ ...editForm, abbreviation: e.target.value })} data-vsco-presences-edit-abbreviation />
            </>
          )}
          {id === "seriousness" && (
            <>
              <p className="form-label fw-bold">{tr("incident.seriousness.form.input.color", "Sélectionnez la couleur à attribuer à ce niveau de gravité")}</p>
              <div className="mb-12">
                <LevelPicker name={tr("incident.seriousness.title", "Niveaux de gravité d'un incident")} value={editForm.level} onChange={(n) => setEditForm({ ...editForm, level: n })} />
              </div>
              <Check id={`${p}-edit-alert`} checked={editForm.excludeAlertSeriousness} onChange={(v) => setEditForm({ ...editForm, excludeAlertSeriousness: v })} label={tr("incidents.seriousness.alert.rules", "Ce niveau de gravité compte dans les alertes")} />
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" color="tertiary" variant="ghost" onClick={() => setEditing(null)}>
            {tr("evaluations.devoir.annuler", "Annuler")}
          </Button>
          <Button type="button" color="primary" disabled={!isValidLabel(editForm.label)} onClick={saveEdit} data-vsco-presences-edit-save>
            {tr("edit", "Modifier")}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );

  // Les catalogues d'incidents partagent la carte « Incidents » ; les autres ont la leur.
  if (nested) {
    return (
      <div className="mb-24" data-vsco-presences-catalog={id}>
        <h4 className="h6 mb-8">{tr(text.title[0], text.title[1])}</h4>
        {body}
      </div>
    );
  }
  return (
    <SectionCard anchor={text.anchor} title={tr(text.title[0], text.title[1])}>
      <div data-vsco-presences-catalog={id}>{body}</div>
    </SectionCard>
  );
};

// ───────────────────────────────── Contenu du module ─────────────────────────────────

/** Raccourcis du bandeau : (ancre, clé, repli, alignement du défilement). */
const NAV: Array<[string, string, string, ScrollLogicalPosition]> = [
  ["absence", "presences.absence.reason.title", "Motifs d'absences", "center"],
  ["multiple-slots", "presences.multiple.slots.manage.title", "Appels multiples", "center"],
  ["action", "presences.absence.actions", "Actions", "center"],
  ["alert", "presences.alerts.title", "Alertes", "center"],
  ["discipline", "presences.title", "Présences", "center"],
  ["incidents", "incidents.title", "Incidents", "center"],
  ["punishment", "presences.punishments", "Punitions", "center"],
  ["massmailing", "presences.publipostage", "Publipostage", "start"],
  ["statistics", "presences.statistics", "Statistiques", "center"],
];

const PresencesContent = ({ notify }: { notify: Notify }) => {
  const tr = useTr();
  const { id: structureId } = useStructure();
  const qc = useQueryClient();
  const me = useMe();
  const status = useQuery({ queryKey: ["presencesInit", structureId], queryFn: () => presencesInitService.status(structureId) });
  const has1D = hasWorkflow(me.data?.actions, INIT_RIGHTS.oneD);
  const has2D = hasWorkflow(me.data?.actions, INIT_RIGHTS.twoD);
  const buttons = status.isSuccess ? initButtons(status.data, has1D, has2D) : [];

  const init = async (type: InitType) => {
    try {
      await presencesInitService.init(structureId, type);
      notify(true, type === "ONE_D" ? tr("presences.init.1d.success", "Initialisation Premier degré réussie") : tr("presences.init.2d.success", "Initialisation Second degré réussie"));
      await qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).startsWith("presences") });
    } catch {
      notify(false, tr("presences.init.error", "Une erreur est survenue lors de l'initialisation de l'établissement"));
    }
  };

  const scrollTo = (anchor: string, block: ScrollLogicalPosition) =>
    document.querySelector(`[data-vsco-presences-section="${anchor}"]`)?.scrollIntoView({ behavior: "smooth", block, inline: "nearest" });

  return (
    <div data-vsco-presences-content>
      {buttons.length > 0 && (
        <div className="d-flex align-items-center flex-wrap gap-12 mb-16" data-vsco-presences-init>
          {buttons.map((b) => (
            <Button key={b} type="button" color="primary" onClick={() => init(b)} data-vsco-presences-init-button={b}>
              {tr("presences.init.button", "Initialiser")}
            </Button>
          ))}
          <span>{tr("presences.init.title", "Initialiser les données par défaut")}</span>
        </div>
      )}

      <nav aria-label={tr("presences.title", "Présences")} className="d-flex flex-wrap gap-8 mb-16" data-vsco-presences-nav>
        {NAV.map(([anchor, k, d, block]) => (
          <button key={anchor} type="button" className="btn btn-sm btn-outline-secondary" onClick={() => scrollTo(anchor, block)} data-vsco-presences-nav-item={anchor}>
            {tr(k, d)}
          </button>
        ))}
      </nav>

      <ReasonSection kind="absence" notify={notify} />
      <ReasonSection kind="lateness" notify={notify} />
      <MultipleSlotsSection notify={notify} />
      <CatalogSection id="action" notify={notify} />
      <AlertSection notify={notify} />
      <CatalogSection id="discipline" notify={notify} />

      <SectionCard anchor="incidents" title={tr("incidents.title", "Incidents")}>
        <CatalogSection id="incidentType" notify={notify} nested />
        <CatalogSection id="place" notify={notify} nested />
        <CatalogSection id="protagonist" notify={notify} nested />
        <CatalogSection id="seriousness" notify={notify} nested />
        <CatalogSection id="partner" notify={notify} nested />
      </SectionCard>

      <CatalogSection id="punishmentType" notify={notify} />

      <SectionCard anchor="massmailing" title={tr("presences.publipostage", "Publipostage")}>
        <MassmailingTemplates />
      </SectionCard>

      <StatisticsSection notify={notify} />
    </div>
  );
};

/**
 * Onglet « Présences » : case « Activer le module » puis, si le module est activé, le paramétrage Présences
 * (initialisation, motifs, appels multiples, actions, alertes, disciplines, incidents, punitions, comptage).
 */
export const PresencesSettings = () => {
  const tr = useTr();
  const { id: structureId } = useStructure();
  const qc = useQueryClient();
  const key = ["presencesActives", structureId];
  const actives = useQuery({ queryKey: key, queryFn: moduleActivationService.actives });
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, setPending] = useState<boolean | null>(null);
  const notify: Notify = (ok, text) => setNotice({ ok, text });
  const active = pending ?? isModuleActive(actives.data, structureId);

  // Changer d'établissement efface le message de l'établissement précédent.
  useEffect(() => setNotice(null), [structureId]);

  const toggle = async (v: boolean) => {
    setPending(v);
    try {
      if (v) await moduleActivationService.activate(structureId);
      else await moduleActivationService.deactivate(structureId);
      await qc.invalidateQueries({ queryKey: key });
    } catch {
      notify(false, tr("presences.react.error", "Une erreur est survenue"));
    }
    setPending(null);
  };

  return (
    <section data-vsco-presences>
      {notice && (
        <p className={notice.ok ? "text-success" : "text-danger"} role={notice.ok ? "status" : "alert"} data-vsco-presences-message data-vsco-presences-ok={notice.ok ? "true" : "false"}>
          {notice.text}
        </p>
      )}
      {actives.isError && (
        <p className="text-danger" role="alert" data-vsco-presences-error="actives">
          {tr("presences.react.error", "Une erreur est survenue")}
        </p>
      )}
      <div className="form-check mb-16">
        <input className="form-check-input" type="checkbox" id="vsco-presences-active" checked={active} disabled={actives.isLoading || pending !== null} onChange={(e) => toggle(e.target.checked)} data-vsco-presences-active />
        <label className="form-check-label fw-bold" htmlFor="vsco-presences-active">
          {tr("activated.module", "Activer le module.")}
        </label>
      </div>
      {active && <PresencesContent notify={notify} />}
    </section>
  );
};
