// Codes insérables dans les modèles de publipostage : clés i18n du module massmailing (texte du code, puis sa description),
// extraites des gabarits AngularJS « sniplet-template-form-<type>-codes.html ».

export interface CodeSection {
  title: string;
  codes: Array<{ code: string; label: string }>;
}

export type TemplateType = "MAIL" | "PDF" | "SMS";

export const CODES: Record<TemplateType, CodeSection[]> = {
  "MAIL": [
    {
      "title": "massmailing.codes.for.absences",
      "codes": [
        {
          "code": "massmailing.codes.child.name",
          "label": "massmailing.codes.students.name.label"
        },
        {
          "code": "massmailing.codes.class.name",
          "label": "massmailing.codes.class.label"
        },
        {
          "code": "massmailing.codes.absence.number",
          "label": "massmailing.codes.absences.number.label"
        },
        {
          "code": "massmailing.codes.lateness.number",
          "label": "massmailing.codes.lateness.number.label"
        },
        {
          "code": "massmailing.codes.summary",
          "label": "massmailing.codes.summary.label"
        },
        {
          "code": "massmailing.codes.mail.info",
          "label": "massmailing.codes.today.date"
        },
        {
          "code": "massmailing.codes.today.date.label",
          "label": "massmailing.codes.address.legal.responsible"
        },
        {
          "code": "massmailing.codes.address.legal.responsible.label",
          "label": "massmailing.codes.zipcode.city.legal.responsible"
        },
        {
          "code": "massmailing.codes.zipcode.city.legal.responsible.label",
          "label": "massmailing.codes.legal.name"
        },
        {
          "code": "massmailing.codes.legal.name.label",
          "label": "massmailing.codes.unique.punishment.sanction"
        },
        {
          "code": "massmailing.codes.punishment.type",
          "label": "massmailing.codes.punishment.type.label"
        },
        {
          "code": "massmailing.codes.sanction.type",
          "label": "massmailing.codes.sanction.type.label"
        },
        {
          "code": "massmailing.codes.punishment.responsible",
          "label": "massmailing.codes.punishment.responsible.label"
        },
        {
          "code": "massmailing.codes.punishment.description",
          "label": "massmailing.codes.punishment.description.label"
        },
        {
          "code": "massmailing.codes.punishment.date",
          "label": "massmailing.codes.punishment.date.label"
        },
        {
          "code": "massmailing.codes.punishment.day.number",
          "label": "massmailing.codes.punishment.day.number.label"
        },
        {
          "code": "massmailing.codes.multiple.punishments.sanctions",
          "label": "massmailing.codes.punishment.summary"
        }
      ]
    }
  ],
  "PDF": [
    {
      "title": "massmailing.codes.for.absences",
      "codes": [
        {
          "code": "massmailing.codes.child.name",
          "label": "massmailing.codes.students.name.label"
        },
        {
          "code": "massmailing.codes.class.name",
          "label": "massmailing.codes.class.label"
        },
        {
          "code": "massmailing.codes.absence.number",
          "label": "massmailing.codes.absences.number.label"
        },
        {
          "code": "massmailing.codes.lateness.number",
          "label": "massmailing.codes.lateness.number.label"
        },
        {
          "code": "massmailing.codes.summary",
          "label": "massmailing.codes.summary.label"
        },
        {
          "code": "massmailing.codes.mail.info",
          "label": "massmailing.codes.today.date"
        },
        {
          "code": "massmailing.codes.today.date.label",
          "label": "massmailing.codes.address.legal.responsible"
        },
        {
          "code": "massmailing.codes.address.legal.responsible.label",
          "label": "massmailing.codes.zipcode.city.legal.responsible"
        },
        {
          "code": "massmailing.codes.zipcode.city.legal.responsible.label",
          "label": "massmailing.codes.legal.name"
        },
        {
          "code": "massmailing.codes.legal.name.label",
          "label": "massmailing.codes.unique.punishment.sanction"
        },
        {
          "code": "massmailing.codes.punishment.type",
          "label": "massmailing.codes.punishment.type.label"
        },
        {
          "code": "massmailing.codes.sanction.type",
          "label": "massmailing.codes.sanction.type.label"
        },
        {
          "code": "massmailing.codes.punishment.responsible",
          "label": "massmailing.codes.punishment.responsible.label"
        },
        {
          "code": "massmailing.codes.punishment.description",
          "label": "massmailing.codes.punishment.description.label"
        },
        {
          "code": "massmailing.codes.punishment.date",
          "label": "massmailing.codes.punishment.date.label"
        },
        {
          "code": "massmailing.codes.punishment.day.number",
          "label": "massmailing.codes.punishment.day.number.label"
        },
        {
          "code": "massmailing.codes.multiple.punishments.sanctions",
          "label": "massmailing.codes.punishment.summary"
        }
      ]
    }
  ],
  "SMS": [
    {
      "title": "massmailing.codes.for.absences",
      "codes": [
        {
          "code": "massmailing.codes.child.name",
          "label": "massmailing.codes.students.name.label"
        },
        {
          "code": "massmailing.codes.class.name",
          "label": "massmailing.codes.class.label"
        },
        {
          "code": "massmailing.codes.absence.number",
          "label": "massmailing.codes.absences.number.label"
        },
        {
          "code": "massmailing.codes.lateness.number",
          "label": "massmailing.codes.lateness.number.label"
        },
        {
          "code": "massmailing.codes.unique.punishment.sanction",
          "label": "massmailing.codes.punishment.type"
        },
        {
          "code": "massmailing.codes.punishment.type.label",
          "label": "massmailing.codes.sanction.type"
        },
        {
          "code": "massmailing.codes.sanction.type.label",
          "label": "massmailing.codes.punishment.responsible"
        },
        {
          "code": "massmailing.codes.punishment.responsible.label",
          "label": "massmailing.codes.punishment.description"
        },
        {
          "code": "massmailing.codes.punishment.description.label",
          "label": "massmailing.codes.punishment.date"
        },
        {
          "code": "massmailing.codes.punishment.date.label",
          "label": "massmailing.codes.punishment.day.number"
        }
      ]
    }
  ]
};
