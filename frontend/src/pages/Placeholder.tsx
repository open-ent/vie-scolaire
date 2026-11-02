import { useTranslation } from "react-i18next";

/** Onglet dont l'écran React arrive dans un incrément suivant. */
export const Placeholder = ({ id }: { id: string }) => {
  const { t } = useTranslation("viescolaire");
  return (
    <p className="text-muted" data-vsco-placeholder={id}>
      {t("viescolaire.react.soon", { defaultValue: "Cet écran arrive bientôt dans la nouvelle interface." })}
    </p>
  );
};
