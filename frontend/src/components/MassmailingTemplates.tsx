import { Button, Modal } from "@open-ent/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CODES } from "../lib/massmailingCodes";
import { CATEGORIES, canSubmit, createBody, emptyTemplate, limitSms, SMS_MAX_LENGTH, sortTemplates, Template, TemplateType } from "../lib/massmailing";
import { massmailingService } from "../services/presences.service";
import { useStructure } from "./StructureContext";

const TYPES: Array<{ type: TemplateType; title: string; titleFallback: string; desc: string; descFallback: string; placeholder: string }> = [
  { type: "MAIL", title: "massmailing.template.form.mail.title", titleFallback: "Publipostage Mail", desc: "massmailing.template.form.mail.description", descFallback: "", placeholder: "massmailing.template.form.mail.name.placeholder" },
  { type: "SMS", title: "massmailing.template.form.sms.title", titleFallback: "Publipostage SMS", desc: "massmailing.template.form.sms.description", descFallback: "", placeholder: "massmailing.template.form.sms.name.placeholder" },
  { type: "PDF", title: "massmailing.template.form.pdf.title", titleFallback: "Publipostage PDF", desc: "massmailing.template.form.pdf.description", descFallback: "", placeholder: "massmailing.template.form.pdf.name.placeholder" },
];

/** Un type de modèle : formulaire (nom, catégorie, texte), codes à insérer, liste des modèles déjà saisis. */
const TypeBlock = ({ spec }: { spec: (typeof TYPES)[number] }) => {
  const { t } = useTranslation(["massmailing", "viescolaire"], { useSuspense: false });
  const tr = (k: string, d: string) => t(k, { ns: "massmailing", defaultValue: d });
  const { id: structureId } = useStructure();
  const qc = useQueryClient();
  const key = ["massmailing", structureId, spec.type];
  const list = useQuery({ queryKey: key, queryFn: () => massmailingService.list(spec.type, structureId) });
  const [draft, setDraft] = useState<Template>(emptyTemplate(spec.type));
  const [toDelete, setToDelete] = useState<Template | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState("");
  const editor = useRef<HTMLDivElement>(null);
  const rich = spec.type !== "SMS";

  const setContent = (content: string) => {
    setDraft((d) => ({ ...d, content }));
    if (editor.current && editor.current.innerHTML !== content) editor.current.innerHTML = content;
  };
  const reset = () => {
    setDraft(emptyTemplate(spec.type));
    if (editor.current) editor.current.innerHTML = "";
  };
  const reload = () => qc.invalidateQueries({ queryKey: key });
  const insert = (code: string) => {
    if (rich && editor.current) {
      editor.current.focus();
      document.execCommand("insertText", false, code);
      setDraft((d) => ({ ...d, content: editor.current?.innerHTML ?? d.content }));
    } else {
      setDraft((d) => ({ ...d, content: limitSms(d.content + code) }));
    }
    navigator.clipboard?.writeText(code).then(() => setCopied(code)).catch(() => setCopied(""));
  };

  const save = async () => {
    const body = { ...draft, content: rich ? (editor.current?.innerHTML ?? draft.content) : draft.content };
    try {
      if (draft.id) {
        await massmailingService.update(draft.id, body);
        setMessage({ ok: true, text: tr("massmailing.templates.update.success", "Modèle modifié avec succès") });
      } else {
        await massmailingService.create(createBody(body, structureId));
        setMessage({ ok: true, text: tr("massmailing.templates.creation.success", "Modèle ajouté avec succès") });
      }
    } catch {
      setMessage({ ok: false, text: draft.id ? tr("massmailing.templates.update.error", "Une erreur est survenue lors de la modification du modèle.") : tr("massmailing.templates.creation.error", "Une erreur est survenue lors de la création du modèle.") });
    }
    reset();
    await reload();
  };
  const remove = async () => {
    const tpl = toDelete;
    setToDelete(null);
    if (!tpl?.id) return;
    try {
      await massmailingService.remove(tpl.id);
      setMessage({ ok: true, text: tr("massmailing.templates.deletion.success", "Modèle supprimé avec succès") });
    } catch {
      setMessage({ ok: false, text: tr("massmailing.templates.deletion.error", "Une erreur est survenue lors de la suppression du modèle.") });
    }
    reset();
    await reload();
  };
  const open = (tpl: Template) => {
    setDraft(tpl);
    if (editor.current) editor.current.innerHTML = tpl.content;
  };

  return (
    <div className="mb-24" data-vsco-mm-type={spec.type}>
      <h3 className="h5">{tr(spec.title, spec.titleFallback)}</h3>
      <p className="text-muted">{tr(spec.desc, spec.descFallback)}</p>
      {message && (
        <p className={message.ok ? "text-success" : "text-danger"} role={message.ok ? "status" : "alert"} data-vsco-mm-message>
          {message.text}
        </p>
      )}
      <div className="d-flex gap-12 flex-wrap mb-8">
        <input className="form-control" style={{ maxWidth: 320 }} value={draft.name} placeholder={tr(spec.placeholder, "Modèle 1")} aria-label={tr(spec.title, spec.titleFallback)} onChange={(e) => setDraft({ ...draft, name: e.target.value })} data-vsco-mm-name />
        <select className="form-select" style={{ maxWidth: 240 }} value={draft.category} aria-label="Catégorie" onChange={(e) => setDraft({ ...draft, category: e.target.value as Template["category"] })} data-vsco-mm-category>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {tr(`massmailing.template.form.category.${c}`, c)}
            </option>
          ))}
        </select>
      </div>
      <div className="d-flex gap-16 flex-wrap align-items-start">
        <div style={{ flex: "1 1 360px" }}>
          {rich ? (
            <div
              ref={editor}
              contentEditable
              suppressContentEditableWarning
              role="textbox"
              aria-multiline="true"
              aria-label="Texte du modèle"
              className="form-control"
              style={{ minHeight: 140, overflow: "auto" }}
              onInput={(e) => setDraft((d) => ({ ...d, content: (e.target as HTMLDivElement).innerHTML }))}
              data-vsco-mm-editor
            />
          ) : (
            <>
              <textarea className="form-control" rows={4} value={draft.content} aria-label="Texte du SMS" onChange={(e) => setContent(limitSms(e.target.value))} data-vsco-mm-sms />
              <small className="text-muted" data-vsco-mm-count>
                {draft.content.length} / {SMS_MAX_LENGTH}
              </small>
            </>
          )}
          <div className="mt-8 d-flex gap-8 justify-content-end">
            {draft.id && (
              <Button type="button" color="tertiary" variant="ghost" onClick={reset}>
                {tr("massmailing.cancel", "Annuler")}
              </Button>
            )}
            <Button type="button" color="primary" disabled={!canSubmit(draft)} onClick={save} data-vsco-mm-save>
              {draft.id ? tr("massmailing.update", "Modifier") : tr("massmailing.add", "Ajouter")}
            </Button>
          </div>
        </div>
        <div style={{ flex: "1 1 280px" }} data-vsco-mm-codes>
          {CODES[spec.type].map((s) => (
            <div key={s.title}>
              <strong>{tr(s.title, "Codes")} :</strong>
              <ul className="list-unstyled">
                {s.codes.map((c) => (
                  <li key={c.code} className="mb-4">
                    <button type="button" className="btn btn-sm btn-secondary me-8" onClick={() => insert(tr(c.code, c.code))} title={tr("massmailing.copy", "Copier")} data-vsco-mm-code>
                      {tr(c.code, c.code)}
                    </button>
                    {tr(c.label, "")}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {copied && (
            <small className="text-muted" role="status">
              {tr("massmailing.copied", "Copié")} : {copied}
            </small>
          )}
        </div>
      </div>
      {(list.data ?? []).length > 0 && (
        <div className="mt-16">
          <strong>{tr("massmailing.templates.created", "Liste des modèles déjà saisis")} :</strong>
          <ul className="list-unstyled">
            {sortTemplates(list.data ?? []).map((tpl) => (
              <li key={tpl.id} className="d-flex align-items-center gap-8" data-vsco-mm-row={tpl.name}>
                <button type="button" className="btn btn-link p-0" onClick={() => open(tpl)} data-vsco-mm-open>
                  {tpl.name}
                </button>
                <button type="button" className="btn btn-sm btn-outline-danger" aria-label={`Supprimer ${tpl.name}`} onClick={() => setToDelete(tpl)} data-vsco-mm-delete>
                  ×
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Modal id={`vsco-mm-delete-${spec.type}`} isOpen={!!toDelete} onModalClose={() => setToDelete(null)}>
        <Modal.Header onModalClose={() => setToDelete(null)}>{tr("massmailing.templates.deletion.title", "Supprimer le modèle")}</Modal.Header>
        <Modal.Body>
          <p className="m-0">
            {tr("massmailing.template.deletion.message.1", "Le modèle")} « {toDelete?.name} » {tr("massmailing.template.deletion.message.2", "va être supprimé")}.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <Button type="button" color="tertiary" variant="ghost" onClick={() => setToDelete(null)}>
            {tr("massmailing.cancel", "Annuler")}
          </Button>
          <Button type="button" color="danger" onClick={remove} data-vsco-mm-delete-confirm>
            {tr("massmailing.delete", "Supprimer")}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

/** Textes du publipostage de l'application Présences : modèles de mail, de SMS et de PDF. */
export const MassmailingTemplates = () => {
  const { t } = useTranslation(["massmailing"], { useSuspense: false });
  return (
    <div data-vsco-mm>
      <p>{t("massmailing.form.description", { ns: "massmailing", defaultValue: "Saisissez ici les différents textes à envoyer lors du publipostage dans l'application Présences" })}</p>
      {TYPES.map((s) => (
        <TypeBlock key={s.type} spec={s} />
      ))}
    </div>
  );
};
