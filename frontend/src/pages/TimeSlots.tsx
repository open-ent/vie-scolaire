import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useStructure } from "../components/StructureContext";
import { Classe, defaultTimeSlot, endOfHalfDay, endTimes, sortClasses, TimeSlot, unassociated } from "../lib/timeSlots";
import { timeSlotService } from "../services/settings.service";

/** Plages horaires : profil de l'établissement, fin de demi-journée, et profils associés à des classes. */
export const TimeSlots = () => {
  const { t } = useTranslation("viescolaire");
  const structure = useStructure();
  const qc = useQueryClient();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [adding, setAdding] = useState(false);
  // profil choisi mais pas encore associé à une classe : il n'existe côté serveur qu'à la première classe
  const [pending, setPending] = useState<string | null>(null);

  const slots = useQuery({ queryKey: ["timeSlots", structure.id], queryFn: () => timeSlotService.list(structure.id) });
  const classes = useQuery({ queryKey: ["classes", structure.id], queryFn: () => timeSlotService.classes(structure.id) });
  // classes associées à chaque profil (une requête par profil, comme l'AngularJS)
  const audiences = useQuery({
    queryKey: ["timeSlotAudiences", structure.id, (slots.data ?? []).map((s) => s._id).join(",")],
    enabled: !!slots.data,
    queryFn: async () => {
      const out: Record<string, string[]> = {};
      await Promise.all((slots.data ?? []).map(async (s) => (out[s._id] = (await timeSlotService.audience(s._id)) ?? [])));
      return out;
    },
  });

  const list = slots.data ?? [];
  const current = defaultTimeSlot(list);
  const allClasses = classes.data ?? [];
  const byId = new Map(allClasses.map((c) => [c.id, c]));
  const audience = audiences.data ?? {};
  const associated = new Set(Object.values(audience).flat());
  const withClasses = list.filter((s) => (audience[s._id] ?? []).length > 0 || s._id === pending);
  const addable = list.filter((s) => (audience[s._id] ?? []).length === 0 && s._id !== pending);

  const run = async (action: () => Promise<unknown>, okText: string) => {
    try {
      await action();
      setMessage({ ok: true, text: okText });
    } catch {
      setMessage({ ok: false, text: t("viescolaire.error.sauvegarde", { defaultValue: "Une erreur est survenue lors de la sauvegarde." }) });
    }
    await qc.invalidateQueries({ queryKey: ["timeSlots", structure.id] });
    await qc.invalidateQueries({ queryKey: ["timeSlotAudiences", structure.id] });
  };

  const classesOf = (s: TimeSlot): Classe[] => sortClasses((audience[s._id] ?? []).map((id) => byId.get(id)).filter((c): c is Classe => !!c));

  return (
    <section data-vsco-time-slots>
      <h2 className="h4 mb-16">{t("viescolaire.time.slots", { defaultValue: "Plages horaires" })}</h2>
      {message && (
        <p className={message.ok ? "text-success" : "text-danger"} role={message.ok ? "status" : "alert"} data-vsco-message>
          {message.text}
        </p>
      )}
      {slots.isError && (
        <p className="text-danger" role="alert">
          {t("viescolaire.error.sync.time.slots", { defaultValue: "Une erreur est survenue lors de la récupération des plages horaires." })}
        </p>
      )}

      <div className="mb-16" style={{ maxWidth: 480 }}>
        <label htmlFor="vsco-slot-profile" className="form-label">
          {t("viescolaire.choice.schedule", { defaultValue: "Choisir l'horaire de l'établissement" })}
        </label>
        <select
          id="vsco-slot-profile"
          className="form-select"
          value={current?._id ?? ""}
          onChange={(e) => run(() => timeSlotService.setDefault(e.target.value, structure.id), t("viescolaire.save.time.slot.profil", { defaultValue: "Le profil de plages horaires a bien été enregistré" }))}
          data-vsco-slot-profile
        >
          <option value="" disabled>
            {t("viescolaire.time.slots.structure", { defaultValue: "Plages horaires de l'établissement" })}
          </option>
          {list.map((s) => (
            <option key={s._id} value={s._id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {current && (
        <>
          <table className="table mb-16" style={{ maxWidth: 520 }} data-vsco-slot-schedule>
            <thead>
              <tr>
                <th>{t("viescolaire.label", { defaultValue: "Libellé" })}</th>
                <th>{t("viescolaire.start.date", { defaultValue: "Début" })}</th>
                <th>{t("viescolaire.end.date", { defaultValue: "Fin" })}</th>
              </tr>
            </thead>
            <tbody>
              {(current.slots ?? []).map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td>{s.startHour}</td>
                  <td>{s.endHour}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mb-24" style={{ maxWidth: 320 }}>
            <label htmlFor="vsco-half-day" className="form-label">
              {t("viescolaire.choice.end.half.day", { defaultValue: "Choisir la fin de la demi-journée" })}
            </label>
            <select
              id="vsco-half-day"
              className="form-select"
              value={endOfHalfDay(current)}
              onChange={(e) => run(() => timeSlotService.setEndOfHalfDay(current._id, structure.id, e.target.value), t("viescolaire.save.end.of.half.day", { defaultValue: "La fin de demi-journée a bien été enregistrée" }))}
              data-vsco-half-day
            >
              {endTimes(current).map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      <h3 className="h5 mb-8">{t("viescolaire.association.description", { defaultValue: "Associer un profil de plages horaires à des classes" })}</h3>
      <div className="d-flex gap-8 align-items-center mb-16">
        <button type="button" className="btn btn-secondary" disabled={adding || addable.length === 0} onClick={() => setAdding(true)} data-vsco-slot-add>
          {t("viescolaire.association.add", { defaultValue: "Ajouter une association" })}
        </button>
        {adding && (
          <select
            className="form-select"
            style={{ maxWidth: 360 }}
            defaultValue=""
            aria-label={t("viescolaire.time.slots.structure", { defaultValue: "Plages horaires" })}
            onChange={(e) => {
              setAdding(false);
              if (e.target.value) setPending(e.target.value);
            }}
            data-vsco-slot-add-select
          >
            <option value="" disabled>
              {t("viescolaire.time.slots.structure", { defaultValue: "Plages horaires de l'établissement" })}
            </option>
            {addable.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div data-vsco-slot-audiences>
        {withClasses.map((s) => (
          <div key={s._id} className="card p-16 mb-8" data-vsco-slot-audience={s._id}>
            <div className="d-flex justify-content-between align-items-center mb-8">
              <strong>{s.name}</strong>
              <button
                type="button"
                className="btn btn-link"
                onClick={() => run(() => timeSlotService.dissociateAll(s._id), t("viescolaire.association.deleted", { defaultValue: "Les associations ont bien été supprimées" }))}
                data-vsco-slot-remove-all
              >
                {t("viescolaire.association.remove", { defaultValue: "Supprimer l'association" })}
              </button>
            </div>
            <ul className="list-inline mb-8">
              {classesOf(s).map((c) => (
                <li key={c.id} className="list-inline-item me-16">
                  {c.name}{" "}
                  <button
                    type="button"
                    className="btn btn-link p-0"
                    aria-label={`${t("viescolaire.utils.delete", { defaultValue: "Retirer" })} ${c.name}`}
                    onClick={() => run(() => timeSlotService.dissociate(c.id), t("viescolaire.association.deleted", { defaultValue: "Les associations ont bien été supprimées" }))}
                    data-vsco-slot-remove-class={c.id}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            {unassociated(allClasses, associated).length > 0 && (
              <select
                className="form-select"
                style={{ maxWidth: 320 }}
                value=""
                aria-label={t("viescolaire.select.classes", { defaultValue: "Sélectionner des classes" })}
                onChange={(e) => {
                  if (!e.target.value) return;
                  setPending(null);
                  run(() => timeSlotService.associate(s._id, e.target.value), t("viescolaire.association.saved", { defaultValue: "L'association a bien été enregistrée" }));
                }}
                data-vsco-slot-add-class
              >
                <option value="">{t("viescolaire.select.classes", { defaultValue: "Sélectionner des classes" })}</option>
                {unassociated(allClasses, associated).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};
