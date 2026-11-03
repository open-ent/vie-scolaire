import { useTranslation } from "react-i18next";
import { hintOf } from "../lib/hints";

/** Explication en tête d'un onglet ou d'une rubrique : à quoi ça sert, avec un exemple concret quand il existe. */
export const HintText = ({ id }: { id: string }) => {
  const { t } = useTranslation("viescolaire", { useSuspense: false });
  const hint = hintOf(id);
  if (!hint) return null;
  return (
    <div className="alert alert-info py-8 px-12 mb-16" role="note" data-vsco-hint={id}>
      <div className="w-100">
        <div>{t(`viescolaire.hint.${id}`, { defaultValue: hint.text })}</div>
        {hint.example && (
          <div className="mt-4 text-muted small">
            <strong>{t("viescolaire.hint.example", { defaultValue: "Exemple" })} :</strong> {t(`viescolaire.hint.${id}.example`, { defaultValue: hint.example })}
          </div>
        )}
      </div>
    </div>
  );
};
