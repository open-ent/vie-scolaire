/**
 * Explications affichées en tête de chaque onglet et de chaque rubrique : à quoi ça sert, qui s'en sert, avec un
 * exemple quand il aide. Écrites pour quelqu'un qui n'a jamais ouvert l'écran (aucun sigle sans sa signification).
 */
export interface Hint {
  text: string;
  example?: string;
  /** Étapes à suivre, affichées en liste sous le texte (ex. comment créer une grille). */
  steps?: string[];
  /** Lien utile vers l'écran où se fait l'action. */
  link?: { href: string; label: string };
  /** Droit nécessaire pour agir (nom d'affichage de l'action) : sans lui, ni étapes ni lien, seulement `otherwise`. */
  needs?: string;
  otherwise?: string;
}

export const HINTS: Record<string, Hint> = {
  // ── onglets principaux ──
  "tab.ecole": {
    text: "Les réglages de base de l'établissement, partagés par toutes les applications de vie scolaire (absences, notes, cahier de textes, emploi du temps) : l'année, ses périodes, les horaires, qui enseigne quoi.",
  },
  "tab.competences": {
    text: "Les réglages de l'application Compétences : comment les élèves sont évalués (niveaux de maîtrise, compétences du socle commun) et ce qui figure sur les bulletins et les bilans de fin de cycle.",
  },
  "tab.presences": {
    text: "Les réglages de l'application Présences : les motifs d'absence et de retard proposés lors de l'appel, les alertes envoyées à la vie scolaire, les courriers adressés aux familles.",
  },
  "tab.diary": {
    text: "Les réglages du cahier de textes : les types de devoirs et de séances que les enseignants peuvent choisir, et les classes qui tiennent un cahier de textes.",
  },
  "tab.edt": {
    text: "Les réglages de l'emploi du temps : préparer l'année, importer les emplois du temps fournis par l'Éducation nationale, nommer les types de cours.",
  },

  // ── Établissement ──
  "school.annee": {
    text: "Les dates de début et de fin de l'année scolaire. Toutes les applications s'en servent pour savoir de quelle période elles parlent (emploi du temps, absences, notes).",
    example: "Du 1er septembre 2026 au 5 juillet 2027.",
  },
  "school.periodes": {
    text: "Le découpage de l'année de chaque classe : année entière, semestres ou trimestres. Il sert aux notes, aux bulletins et au suivi des absences. « Fin de saisie » est la date après laquelle les enseignants ne peuvent plus saisir de notes pour la période ; « Visibilité des bulletins » ouvre le bulletin aux familles et ferme la saisie.",
    example: "Trimestre 1 du 1er septembre au 30 novembre, saisie des notes jusqu'au 5 décembre, conseil de classe le 8 décembre.",
  },
  "school.exclusions": {
    text: "Les périodes où l'établissement est fermé (vacances, examens, ponts). Les cours de l'emploi du temps sont masqués sur ces dates et aucun appel n'est demandé.",
    example: "Vacances de la Toussaint, du 17 au 31 octobre.",
  },
  "school.creneaux": {
    text: "La grille horaire de l'établissement (créneaux d'une heure, récréations, pause du midi). La fin de demi-journée sépare le matin de l'après-midi : elle sert à compter les absences en demi-journées. Une grille différente peut être associée à certaines classes qui n'ont pas les mêmes horaires.",
    example: "Matin jusqu'à 12 h 00 ; la 6e SEGPA suit une grille particulière.",
    steps: [
      "Pour créer une grille particulière, ouvrir la page « Profils de créneaux horaires » de l'administration de la vie scolaire, puis cliquer sur « Créer » : la fenêtre « Nouveau profil de créneau » demande le nom du profil, puis ses créneaux (libellé, heure de début, heure de fin).",
      "Autre possibilité : dans l'ancienne administration, rubrique « Gestion des établissements » puis « Calendrier », ajouter une grille puis ses créneaux (avec modification et suppression).",
      "Revenir ici : le choix de la grille de l'établissement propose la nouvelle grille ; pour qu'une classe la suive, cliquer sur « Ajouter une association », choisir la grille puis les classes.",
    ],
    link: { href: "/dashboard/viescolaire-admin/creneaux", label: "Ouvrir la page « Profils de créneaux horaires »" },
    needs: "time.slot.manage",
    otherwise: "Pour créer une grille particulière, il faut le droit de gérer les plages horaires : demandez-le à l'administrateur de la vie scolaire de l'établissement.",
  },
  "school.services": {
    text: "Qui enseigne quoi, à quelle classe. Un service associe une matière, une classe (ou un groupe) et un enseignant ; les appels, les notes et l'emploi du temps s'en servent. Un co-enseignant partage le service avec le titulaire. Un remplaçant prend la place du titulaire pour une durée donnée, avec les mêmes droits. Une sous-matière détaille une matière (latin et grec pour Lettres classiques).",
    example: "Mathématiques – 6A – Mme Martin ; remplacée par M. Durand du 3 au 14 novembre.",
  },
  "school.regroupements": {
    text: "Des ensembles de classes réunies sous un nom (un niveau, un cycle) pour retrouver des informations par niveau plutôt que classe par classe.",
    example: "Le regroupement « 6e » réunit 6A, 6B et 6C.",
  },
  "school.trombinoscope": {
    text: "Les photos des élèves, affichées dans l'ENT pour reconnaître les élèves. Vous pouvez reprendre les avatars des profils, ou importer une archive de photos prises par l'établissement ; les photos que l'ENT n'a pas su rattacher à un élève sont à rapprocher à la main.",
    example: "Une archive avec un dossier par classe et des fichiers « NOM Prénom.jpg ».",
  },

  // ── Compétences ──
  "comp.levels": {
    text: "L'échelle des niveaux de maîtrise utilisée pour évaluer les élèves : un libellé, une lettre et une couleur par niveau. Vous pouvez aussi choisir comment est calculé le niveau d'une compétence évaluée plusieurs fois (le meilleur niveau, ou la moyenne).",
    example: "Niveau 1 « Maîtrise insuffisante », niveau 4 « Très bonne maîtrise ».",
  },
  "comp.visibilityAverage": {
    text: "Décide si le niveau calculé automatiquement apparaît, pour chaque domaine, sur le bilan de fin de cycle (la synthèse de ce que l'élève maîtrise à la fin d'un cycle d'enseignement).",
  },
  "comp.visibilityDnb": {
    text: "Décide si le barème du diplôme national du brevet (sur 400 points) apparaît sur le bilan de fin de cycle.",
  },
  "comp.items": {
    text: "Les compétences du socle commun que les enseignants peuvent évaluer. Vous pouvez masquer celles que l'établissement n'utilise pas, en ajouter, ou les renommer ; « Réinitialiser » revient à la liste d'origine.",
  },
  "comp.links": {
    text: "Le cycle d'enseignement de chaque classe (cycle 3 : CM1 à 6e, cycle 4 : 5e à 3e). Il détermine les compétences et le bilan de fin de cycle de la classe.",
  },
  "comp.projects": {
    text: "Les projets pédagogiques inscrits sur les bulletins : les enseignements pratiques interdisciplinaires (travaux menés par plusieurs matières), l'accompagnement personnalisé et les parcours éducatifs (avenir, citoyen, santé, artistique et culturel).",
    example: "Parcours avenir, 3e A, coordonné par M. Durand.",
  },
  "comp.services": {
    text: "Pour chaque service d'enseignement : la modalité (le code officiel de la matière), son coefficient, et si elle est évaluée. Les petits yeux choisissent quels enseignants apparaissent sur les bulletins.",
  },
  "comp.subjects": {
    text: "Un titre de matière différent de celui de l'administration, pour qu'il apparaisse sous cette forme sur les bulletins.",
    example: "« ARTS PLASTIQUES » devient « Arts plastiques ».",
  },
  "comp.absences": {
    text: "Reprend dans les bulletins les absences et retards enregistrés dans l'application Présences, pour une période donnée.",
  },
  "comp.opinions": {
    text: "La liste des avis que le conseil de classe peut choisir pour chaque élève sur le bulletin.",
    example: "Félicitations, Encouragements, Mise en garde travail.",
  },
  "comp.program": {
    text: "Les domaines et sous-domaines du programme proposés pour le bilan périodique, afin de décrire ce qui a été travaillé pendant la période.",
  },
  "comp.order": {
    text: "L'ordre dans lequel les matières apparaissent sur les bulletins et les relevés de notes (par glisser-déposer, ou avec les flèches).",
  },

  // ── Cahier de textes ──
  "cdt.init": {
    text: "À faire une fois, en début de vie du cahier de textes : crée les types de devoirs et de séances par défaut pour que les enseignants puissent commencer à l'utiliser.",
  },
  "cdt.homework": {
    text: "Les types de travail à faire que l'enseignant choisit lorsqu'il donne un devoir à ses élèves.",
    example: "Exercice, Leçon à apprendre, Devoir sur table, Exposé.",
  },
  "cdt.session": {
    text: "Les types de séance que l'enseignant choisit lorsqu'il note le contenu d'un cours.",
    example: "Cours, Travaux dirigés, Évaluation, Sortie pédagogique.",
  },
  "cdt.audience": {
    text: "Active ou désactive le cahier de textes pour chaque classe ou groupe. Une classe désactivée n'apparaît plus dans la recherche du cahier de textes (l'enseignant ne peut plus y saisir de séance).",
  },

  // ── Emploi du temps ──
  "edt.init": {
    text: "Prépare l'année : reprend les dates de l'année scolaire et y ajoute les vacances de la zone choisie. Attention : l'action met à jour les dates dans toutes les applications de vie scolaire.",
    example: "Zone B, du 1er septembre 2026 au 4 juillet 2027.",
  },
  "edt.import": {
    text: "Importe les emplois du temps de l'établissement depuis deux fichiers fournis par le logiciel d'emploi du temps de l'Éducation nationale (STS-Web). Un rapport est conservé après chaque import.",
  },
  "edt.labels": {
    text: "Les étiquettes qui qualifient un cours dans l'emploi du temps (par exemple pour distinguer un cours en demi-classe ou en visioconférence), avec une abréviation et une couleur.",
  },

  // ── Présences ──
  "presences.absence": {
    text: "Les raisons d'absence proposées lors de l'appel. Pour chacune, vous précisez si elle demande une régularisation (un justificatif), si elle compte dans le bulletin, et dans quels cas elle déclenche une alerte. Un motif déjà utilisé ne peut être que masqué.",
    example: "Maladie (justificatif demandé), Rendez-vous médical, Transport.",
  },
  "presences.lateness": {
    text: "Les raisons de retard proposées lors de l'appel, avec les mêmes réglages que pour les absences.",
    example: "Réveil, Transport, Rendez-vous.",
  },
  "presences.multiple-slots": {
    text: "Permet de faire un seul appel pour plusieurs créneaux consécutifs d'un même cours, par exemple deux heures de suite.",
  },
  "presences.action": {
    text: "Les suites que la vie scolaire peut noter à propos d'une absence ou d'un retard, avec une abréviation de dix caractères au plus.",
    example: "Appel téléphonique aux parents, Courrier, Convocation.",
  },
  "presences.alert": {
    text: "Les seuils au-delà desquels la vie scolaire reçoit une alerte sur un élève : nombre d'absences non régularisées, de retards, d'incidents ou de punitions. Les cases d'exclusion retirent certains événements du décompte.",
    example: "Alerte à 5 absences non régularisées.",
  },
  "presences.statistics": {
    text: "La façon dont les absences sont comptées dans les statistiques : par jour, par demi-journée ou par créneau horaire.",
  },
  "presences.discipline": {
    text: "Les motifs de discipline (comportement) qu'un enseignant peut signaler dans l'application Présences.",
  },
  "presences.incidents": {
    text: "Les listes utilisées pour déclarer un incident : types d'incident, lieux, types de personnes impliquées, niveaux de gravité (avec une couleur) et partenaires extérieurs.",
    example: "Type « Bagarre », lieu « Cour », gravité « Grave ».",
  },
  "presences.punishment": {
    text: "Les types de punition et de sanction, avec leur catégorie, que la vie scolaire peut attribuer à un élève.",
    example: "Retenue, Travail supplémentaire, Exclusion temporaire.",
  },
  "presences.massmailing": {
    text: "Les modèles de messages envoyés aux familles pour signaler une absence, un retard ou une punition, par courriel, SMS ou courrier PDF. Les codes à insérer sont remplacés automatiquement lors de l'envoi.",
    example: "« Bonjour, votre enfant [nom de l'enfant] était absent le [date]. »",
  },
};

/** Explication d'un écran ou d'une rubrique ; vide si elle n'existe pas. */
export const hintOf = (id: string): Hint | undefined => HINTS[id];
