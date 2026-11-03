import { HintText } from "../components/HintText";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { EdtImport } from "./EdtImport";
import { EdtInit } from "./EdtInit";
import { EdtLabels } from "./EdtLabels";

type Section = "init" | "import" | "labels";

/** Paramétrage de l'emploi du temps : initialisation des données, import STS, étiquettes de cours. */
export const EdtSettings = ({ canInit }: { canInit: boolean }) => {
  const { t } = useTranslation(["viescolaire", "edt", "common"]);
  const sections: Array<{ id: Section; key: string; fallback: string }> = [
    ...(canInit ? [{ id: "init" as const, key: "edt.data.init", fallback: "Initialisation des données" }] : []),
    { id: "import", key: "edt.admin.import.edt", fallback: "Import STS" },
    { id: "labels", key: "edt.admin.course.tags", fallback: "Étiquettes de cours" },
  ];
  const [current, setCurrent] = useState<Section>(sections[0].id);
  const shown = sections.some((s) => s.id === current) ? current : sections[0].id;
  return (
    <section data-vsco-edt>
      <ul className="nav nav-pills mb-16" role="tablist" aria-label="Emploi du temps">
        {sections.map((s) => (
          <li key={s.id} className="nav-item" role="presentation">
            <button type="button" role="tab" aria-selected={shown === s.id} className={`nav-link${shown === s.id ? " active" : ""}`} onClick={() => setCurrent(s.id)} data-vsco-edt-section={s.id}>
              {t(s.key, { ns: "edt", defaultValue: s.fallback })}
            </button>
          </li>
        ))}
      </ul>
      <HintText id={`edt.${shown}`} />
      <div data-vsco-edt-panel={shown}>
        {shown === "init" && <EdtInit />}
        {shown === "import" && <EdtImport />}
        {shown === "labels" && <EdtLabels />}
      </div>
    </section>
  );
};
