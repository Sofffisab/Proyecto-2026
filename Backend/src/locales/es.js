/**
 * Spanish message catalog.
 *
 * All text the end user actually sees (notification titles/bodies, complaint
 * reasons, location labels) lives here, keyed in English. Code imports a key
 * — never a literal Spanish string — so the codebase itself stays 100%
 * English and every user-facing message stays in one place, ready to swap
 * for a real i18n library (or add an `en.js` sibling) without touching any
 * business logic.
 *
 * Plain strings are used as-is; functions take the variable parts and return
 * the built string.
 */
export const MESSAGES = {
  // Student location shown to a trainer (communication.service.js, gym.service.js)
  LOCATION_UNKNOWN: "ubicación desconocida",
  LOCATION_GYM_UNTRACKED_MACHINE: "en el gimnasio (máquina no rastreada por preferencia del usuario)",
  LOCATION_JUST_CHECKED_IN: "entrada del gimnasio (recién ingresó)",

  // "A student needs your attention" alert (communication.service.js)
  TRAINER_ATTENTION_NEEDED_TITLE: "Un alumno necesita tu atención",
  studentNeedsHelpFirstTime: (studentName, location) =>
    `${studentName} acaba de entrar al gimnasio y todavía no lo/la ayudaste. Está en: ${location}.`,
  studentNeedsHelpReturning: (studentName, daysSinceLastAssistance, location) =>
    `${studentName} acaba de entrar al gimnasio — hace ${daysSinceLastAssistance} día(s) que no lo/la ayudás. Está en: ${location}.`,

  // Machine conflict alert sent to every trainer (machineConflict.service.js)
  MACHINE_CONFLICT_TITLE: "Conducta extraña: 2 personas en la misma máquina",
  machineConflictBody: (machineName) =>
    `Se detectaron 2 usos abiertos simultáneos en "${machineName}". Verificá en persona quién está realmente usándola.`,

  // Auto-generated complaint reasons (complaint.service.js)
  COMPLAINT_REASON_NO_HELP: "El entrenador no brindó la ayuda solicitada",
  COMPLAINT_REASON_MACHINE_CONFLICT: "Uso simultáneo de la misma máquina sin verificación de un entrenador",

  // 403 shown when a member must finish their profile before continuing (profileCompletion.middleware.js)
  PROFILE_INCOMPLETE:
    "Debes completar tu perfil (datos médicos, fecha de nacimiento, dirección, objetivo principal, nivel actual, días que entrenás por semana y tipo de entrenamiento) antes de continuar.",
};

// Complaint reason codes accepted by createTrainerComplaintSchema
// (validators/progress.schemas.js). Kept separate from MESSAGES because
// these are enum *values*, not free text — English keys are the wire
// format; ES_LABELS is only for anything that needs to display them.
export const COMPLAINT_REASON_CODES = {
  MACHINE_DAMAGE: "MACHINE_DAMAGE",
  MISCONDUCT: "MISCONDUCT",
  RULE_VIOLATION: "RULE_VIOLATION",
  OTHER: "OTHER",
};

export const COMPLAINT_REASON_LABELS_ES = {
  [COMPLAINT_REASON_CODES.MACHINE_DAMAGE]: "Daño de máquina",
  [COMPLAINT_REASON_CODES.MISCONDUCT]: "Mal comportamiento",
  [COMPLAINT_REASON_CODES.RULE_VIOLATION]: "Incumplimiento de normas",
  [COMPLAINT_REASON_CODES.OTHER]: "Otro",
};

export default MESSAGES;
