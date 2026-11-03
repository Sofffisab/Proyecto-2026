/**
 * Spanish message catalog. All user-facing text lives here, keyed in
 * English, so the codebase itself stays English and messages stay swappable
 * for a real i18n setup. Plain strings are used as-is; functions build the
 * string from variable parts.
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

  // 403 shown when a member's profile is incomplete (profileCompletion.middleware.js)
  PROFILE_INCOMPLETE:
    "Debes completar tu perfil (datos médicos, fecha de nacimiento, dirección, objetivo principal, nivel actual, días que entrenás por semana y tipo de entrenamiento) antes de continuar.",
};

// Reason codes for createTrainerComplaintSchema — enum values, kept as
// English keys (wire format). COMPLAINT_REASON_LABELS_ES is for display only.
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

// Social blocks ("Bloquear persona" in Settings), block.service.js
export const BLOCK_MESSAGES = {
  NAME_REQUIRED: "Escribí el nombre de la persona que querés bloquear.",
  NOT_FOUND: "No encontramos a ninguna persona con ese nombre. Escribí nombre y apellido tal como figura en su perfil.",
  AMBIGUOUS: "Hay más de una persona con ese nombre, así que no podemos bloquearla sin riesgo de equivocarnos. Pedile ayuda a un entrenador.",
  CANNOT_BLOCK_SELF: "No podés bloquearte a vos mismo.",
};

// Exit pop-up feedback + denuncias, denuncia.service.js
export const DENUNCIA_MESSAGES = {
  SESSION_NOT_FOUND: "No encontramos esa visita al gimnasio.",
  SESSION_NOT_YOURS: "Esa visita no es tuya.",
  SESSION_NOT_FINISHED: "Primero tenés que registrar tu salida del gimnasio.",
  TRAINER_NOT_PRESENT: "Ese entrenador no estaba en el gimnasio durante tu visita.",
  MEMBER_NOT_PRESENT: "Esa persona no estaba en el gimnasio durante tu visita.",
  MACHINE_NOT_FOUND: "No encontramos esa máquina.",
  CANNOT_REPORT_SELF: "No podés denunciarte a vos mismo.",
};
