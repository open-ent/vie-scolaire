import { Button, Modal } from "@open-ent/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useStructure } from "../components/StructureContext";
import { canDeleteType, CDT_SECTIONS, CdtAudience, CdtKind, CdtSection, CdtType, isValidTypeLabel, MAX_LABEL, teachersLabel, withEnabled } from "../lib/cdt";
import { cdtService } from "../services/cdt.service";

type Notice = { ok: boolean; text: string } | null;

/** Message de retour (succès ou erreur), annoncé aux lecteurs d'écran. */
const Message = ({ notice }: { notice: Notice }) =>
  notice ? (
    <p className={notice.ok ? "text-success" : "text-danger"} role={notice.ok ? "status" : "alert"} data-vsco-cdt-message>
      {notice.text}
    </p>
  ) : null;

/** Initialisation des données du cahier de textes (états des devoirs, types de travail et de séance). */
const InitData = () => {
  const { t } = useTranslation("viescolaire");
  const structure = useStructure();
  const qc = useQueryClient();
  const tr = (k: string, d: string) => t(k, { defaultValue: d });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const run = async () => {
    setBusy(true);
    setNotice(null);
    try {
      await cdtService.init(structure.id);
      setNotice({ ok: true, text: tr("cdt.data.init.success", "Les données ont été correctement initialisées") });
      // les types et l'état d'initialisation ont pu changer
      await qc.invalidateQueries({ queryKey: ["cdt"] });
    } catch {
      setNotice({ ok: false, text: tr("cdt.data.init.error", "Une erreur est survenue lors de l'initialisation des données") });
    }
    setBusy(false);
  };

  return (
    <section aria-labelledby="vsco-cdt-init-title" data-vsco-cdt-init>
      <h2 id="vsco-cdt-init-title" className="h4 mb-12">
        {tr("cdt.setting.data.init", "Initialisation des données de l'application")}
      </h2>
      <Message notice={notice} />
      <h3 className="h6">{tr("cdt.data.init.are", "Les données suivantes seront initialisées")} * :</h3>
      <ul>
        <li>{tr("cdt.state.homework", "Etat des devoirs")}</li>
        <li>{tr("cdt.work.type", "Types de travail")}</li>
        <li>{tr("cdt.session.type", "Types de séance")}</li>
      </ul>
      <Button type="button" color="primary" disabled={busy} onClick={run} data-vsco-cdt-init-start>
        {tr("cdt.start.init", "Lancer l'initialisation")}
      </Button>
      <p className="text-muted fst-italic mt-16">*{tr("edt.data.information", "Si des données sont déjà existantes, l'initialisation n'aura pas d'impact et les données ne seront pas remplacées.")}</p>
    </section>
  );
};

/** Types de devoirs ou de séances : liste, ajout, modification en place, suppression confirmée. */
const TypesSection = ({ kind }: { kind: CdtKind }) => {
  const { t } = useTranslation("viescolaire");
  const structure = useStructure();
  const qc = useQueryClient();
  const tr = (k: string, d: string) => t(k, { defaultValue: d });
  const homework = kind === "homework";
  const msg = homework
    ? {
        title: tr("cdt.setting.homework.type", "Paramétrage des types de travail à faire"),
        placeholder: "Créer un type de travail",
        created: tr("cdt.homework.type.create", "Type de devoir créé"),
        createFail: tr("cdt.homework.type.create.error", "Erreur lors de la création du type de devoir"),
        updated: tr("cdt.homework.type.update", "Type de devoir modifié"),
        updateFail: tr("cdt.homework.type.update.error", "Erreur lors de la modification du type de devoir"),
        deleted: tr("cdt.homework.type.delete", "Type de devoir supprimé"),
        deleteImpossible: tr("cdt.homework.type.delete.impossible", "Suppression impossible, ce type de devoir est déjà utilisé"),
      }
    : {
        title: tr("cdt.session.type.title", "Paramétrage des types de séances"),
        placeholder: tr("cdt.session.type.placeholder", "Créer un type de séance"),
        created: tr("cdt.session.type.create", "Type de séance créé"),
        createFail: tr("cdt.session.type.create.error", "Erreur lors de la création du type de séance"),
        updated: tr("cdt.session.type.update", "Type de séance modifié"),
        updateFail: tr("cdt.session.type.update.error", "Erreur lors de la modification du type de séance"),
        deleted: tr("cdt.session.type.deleted", "Type de séance supprimé"),
        deleteImpossible: tr("cdt.session.type.delete.impossible", "Suppression impossible, ce type de séance est déjà utilisé"),
      };

  const status = useQuery({ queryKey: ["cdt", "initialized", structure.id], queryFn: () => cdtService.initialized(structure.id) });
  const key = ["cdt", "types", kind, structure.id];
  const list = useQuery({ queryKey: key, queryFn: () => cdtService.types(kind, structure.id), enabled: status.data === true });
  const [input, setInput] = useState("");
  const [editing, setEditing] = useState<CdtType | null>(null);
  const [toDelete, setToDelete] = useState<CdtType | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const types = list.data ?? [];
  const valid = isValidTypeLabel(input);

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    try {
      if (editing) {
        await cdtService.updateType(kind, structure.id, editing.id, input);
        setNotice({ ok: true, text: msg.updated });
        setEditing(null);
      } else {
        await cdtService.createType(kind, structure.id, input);
        setNotice({ ok: true, text: msg.created });
      }
      setInput("");
    } catch {
      setNotice({ ok: false, text: editing ? msg.updateFail : msg.createFail });
    }
    await qc.invalidateQueries({ queryKey: key });
    setBusy(false);
  };

  const remove = async () => {
    if (!toDelete) return;
    const target = toDelete;
    setToDelete(null);
    try {
      await cdtService.removeType(kind, structure.id, target.id);
      setNotice({ ok: true, text: msg.deleted });
      // supprimer le type en cours de modification annule la modification
      if (editing?.id === target.id) {
        setEditing(null);
        setInput("");
      }
    } catch {
      // refus serveur : type utilisé ou dernier restant
      setNotice({ ok: false, text: msg.deleteImpossible });
    }
    await qc.invalidateQueries({ queryKey: key });
  };

  const cancel = () => {
    setEditing(null);
    setInput("");
  };

  return (
    <section aria-labelledby={`vsco-cdt-${kind}-title`} data-vsco-cdt-types={kind}>
      <h2 id={`vsco-cdt-${kind}-title`} className="h4 mb-12">
        {msg.title}
      </h2>
      <Message notice={notice} />
      {(status.isPending || (status.data === true && list.isPending)) && (
        <p role="status" data-vsco-cdt-loading>
          {tr("loading", "Chargement")}
        </p>
      )}
      {(status.isError || list.isError) && (
        <p className="text-danger" role="alert" data-vsco-cdt-error>
          {tr("viescolaire.get.fail", "Erreur lors de la récupération")}
        </p>
      )}

      {status.data === false && (
        <div className="d-flex align-items-center gap-16" data-vsco-cdt-empty>
          <span>{tr("homework.session.type.empty.state", "Merci de lancer l'initialisation des données avant de paramétrer les types de travail et de séance.")}</span>
          <img src="/diary/public/img/computer-book-orange.svg" alt="" width={96} />
        </div>
      )}

      {status.data === true && (
        <>
          <form
            className="d-flex gap-8 align-items-end flex-wrap mb-16"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <div>
              <label htmlFor={`vsco-cdt-${kind}-label`} className="form-label">
                {msg.placeholder}
              </label>
              <input id={`vsco-cdt-${kind}-label`} className="form-control" maxLength={MAX_LABEL} value={input} onChange={(e) => setInput(e.target.value)} data-vsco-cdt-label />
            </div>
            <Button type="submit" color="primary" disabled={!valid || busy} data-vsco-cdt-save>
              {editing ? tr("item.modify", "Modifier") : tr("evaluations.add", "Ajouter")}
            </Button>
            {editing && (
              <Button type="button" color="tertiary" variant="ghost" onClick={cancel} data-vsco-cdt-cancel>
                {tr("viescolaire.utils.cancel", "Annuler")}
              </Button>
            )}
          </form>

          <ul className="list-unstyled" data-vsco-cdt-list>
            {types.map((ty) => (
              <li key={ty.id} className="d-flex align-items-center gap-8 mb-8" data-vsco-cdt-type={ty.label}>
                <span style={{ minWidth: 240 }}>{ty.label}</span>
                <button
                  type="button"
                  className="btn btn-sm btn-secondary"
                  onClick={() => {
                    setEditing(ty);
                    setInput(ty.label);
                  }}
                  data-vsco-cdt-edit
                >
                  {tr("item.modify", "Modifier")}
                </button>
                {canDeleteType(types.length) && (
                  <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => setToDelete(ty)} data-vsco-cdt-delete>
                    {tr("viescolaire.cdt.delete", "Supprimer")}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      <Modal id={`vsco-cdt-${kind}-delete`} isOpen={!!toDelete} onModalClose={() => setToDelete(null)} size="md">
        <Modal.Header onModalClose={() => setToDelete(null)}>{homework ? tr("cdt.homework.type", "Types de travail à faire") : tr("cdt.session.type", "Types de séance")}</Modal.Header>
        <Modal.Body>
          <p className="m-0">
            {tr("viescolaire.cdt.delete.confirm", "Supprimer le type")} « {toDelete?.label} » ?
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" color="tertiary" variant="ghost" onClick={() => setToDelete(null)}>
            {tr("viescolaire.utils.cancel", "Annuler")}
          </Button>
          <Button type="button" color="danger" onClick={remove} data-vsco-cdt-delete-confirm>
            {tr("viescolaire.cdt.delete", "Supprimer")}
          </Button>
        </Modal.Footer>
      </Modal>
    </section>
  );
};

/** Cahier de textes activé ou non par classe/groupe (MOD11), avec les enseignants concernés. */
const AudienceSettings = () => {
  const { t } = useTranslation("viescolaire");
  const structure = useStructure();
  const qc = useQueryClient();
  const tr = (k: string, d: string) => t(k, { defaultValue: d });
  const key = ["cdt", "audiences", structure.id];
  const list = useQuery({ queryKey: key, queryFn: () => cdtService.audiences(structure.id) });
  const [notice, setNotice] = useState<Notice>(null);
  const [pending, setPending] = useState<string | null>(null);
  const audiences = list.data ?? [];

  const toggle = async (a: CdtAudience) => {
    const next = !a.enabled;
    setPending(a.id);
    try {
      await cdtService.setAudienceEnabled(structure.id, a.id, next);
      // la case ne change qu'une fois l'enregistrement confirmé
      qc.setQueryData<CdtAudience[]>(key, (old) => withEnabled(old ?? [], a.id, next));
      setNotice(null);
    } catch {
      setNotice({ ok: false, text: tr("cdt.audience.settings.save.error", "Impossible d'enregistrer ce changement.") });
    }
    setPending(null);
  };

  return (
    <section aria-labelledby="vsco-cdt-audience-title" data-vsco-cdt-audience>
      <h2 id="vsco-cdt-audience-title" className="h4 mb-12">
        {tr("cdt.audience.settings.title", "Cahier de textes par classe/groupe")}
      </h2>
      <Message notice={notice} />
      <p className="text-muted fst-italic">
        {tr("cdt.audience.settings.help", "Activer ou désactiver le cahier de textes pour chaque classe/groupe de l'établissement. Les enseignants affichés sont ceux ayant un service sur cette classe (paramétrage à faire dans Vie scolaire).")}
      </p>
      {list.isPending && (
        <p role="status" data-vsco-cdt-loading>
          {tr("loading", "Chargement")}
        </p>
      )}
      {list.isError && (
        <p className="text-danger" role="alert" data-vsco-cdt-error>
          {tr("cdt.audience.settings.load.error", "Impossible de charger le paramétrage par classe/groupe.")}
        </p>
      )}
      {list.isSuccess && audiences.length === 0 && <p data-vsco-cdt-empty>{tr("cdt.audience.settings.empty", "Aucune classe/groupe trouvé pour cet établissement.")}</p>}
      {audiences.length > 0 && (
        <table className="table" data-vsco-cdt-audience-table>
          <thead>
            <tr>
              <th>{tr("cdt.audience.settings.column.audience", "Classe/Groupe")}</th>
              <th>{tr("cdt.audience.settings.column.teachers", "Enseignants")}</th>
              <th>{tr("cdt.audience.settings.column.enabled", "Activé")}</th>
            </tr>
          </thead>
          <tbody>
            {audiences.map((a) => (
              <tr key={a.id} data-vsco-cdt-audience-row={a.name}>
                <td>{a.name}</td>
                <td>{teachersLabel(a) ?? <em>{tr("cdt.audience.settings.no.teacher", "Aucun enseignant")}</em>}</td>
                <td>
                  <input
                    type="checkbox"
                    checked={a.enabled}
                    disabled={pending === a.id}
                    onChange={() => toggle(a)}
                    aria-label={`${tr("cdt.audience.settings.column.enabled", "Activé")} : ${a.name}`}
                    data-vsco-cdt-audience-toggle
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
};

/** Onglet « Cahier de texte » : menu de 4 sous-sections reprises du module cahier de textes (diary). */
export const CdtSettings = () => {
  const { t } = useTranslation("viescolaire");
  const [current, setCurrent] = useState<CdtSection>("init");

  return (
    <div className="d-flex gap-24 flex-wrap" data-vsco-cdt>
      <nav aria-label={t("viescolaire.cdt.title", { defaultValue: "Cahier de texte" })} style={{ minWidth: 220 }}>
        <ul className="nav flex-column" data-vsco-cdt-menu>
          {CDT_SECTIONS.map((s) => (
            <li key={s.id} className="nav-item">
              <button
                type="button"
                className={`btn btn-link text-start ${current === s.id ? "fw-bold" : ""}`}
                aria-current={current === s.id ? "page" : undefined}
                onClick={() => setCurrent(s.id)}
                data-vsco-cdt-section={s.id}
              >
                {t(s.label, { defaultValue: s.fallback })}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div className="flex-grow-1" style={{ minWidth: 0 }}>
        {current === "init" && <InitData />}
        {current === "homework" && <TypesSection kind="homework" />}
        {current === "session" && <TypesSection kind="session" />}
        {current === "audience" && <AudienceSettings />}
      </div>
    </div>
  );
};
