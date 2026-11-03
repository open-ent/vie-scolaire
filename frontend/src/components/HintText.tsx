import { useTranslation } from "react-i18next";
import { hasWorkflow } from "../lib/access";
import { hintOf } from "../lib/hints";
import { useMe } from "../services/queries";

/** Explication en tête d'un onglet ou d'une rubrique : à quoi ça sert, avec un exemple concret quand il existe. */
export const HintText = ({ id }: { id: string }) => {
  const { t } = useTranslation("viescolaire", { useSuspense: false });
  const hint = hintOf(id);
  const me = useMe();
  if (!hint) return null;
  // les étapes et le lien ne sont proposés qu'à qui a le droit d'agir ; les autres lisent à qui s'adresser
  const allowed = !hint.needs || hasWorkflow(me.data?.actions, hint.needs);
  return (
    <div className="alert alert-info py-8 px-12 mb-16" role="note" data-vsco-hint={id}>
      <div className="w-100">
        <div>{t(`viescolaire.hint.${id}`, { defaultValue: hint.text })}</div>
        {!allowed && hint.otherwise && (
          <p className="mt-8 mb-0" data-vsco-hint-otherwise>
            {t(`viescolaire.hint.${id}.otherwise`, { defaultValue: hint.otherwise })}
          </p>
        )}
        {allowed && hint.steps && (
          <ol className="mt-8 mb-0 ps-24" data-vsco-hint-steps>
            {hint.steps.map((step, i) => (
              <li key={i}>{t(`viescolaire.hint.${id}.step.${i}`, { defaultValue: step })}</li>
            ))}
          </ol>
        )}
        {allowed && hint.link && (
          <p className="mt-8 mb-0">
            <a href={hint.link.href} target="_blank" rel="noreferrer" data-vsco-hint-link>
              {t(`viescolaire.hint.${id}.link`, { defaultValue: hint.link.label })}
            </a>
          </p>
        )}
        {hint.example && (
          <div className="mt-4 text-muted small">
            <strong>{t("viescolaire.hint.example", { defaultValue: "Exemple" })} :</strong> {t(`viescolaire.hint.${id}.example`, { defaultValue: hint.example })}
          </div>
        )}
      </div>
    </div>
  );
};
