// Error messages the API returns, in the language the app is using.
//
// Services throw their messages in one language (mostly English, a few in
// Spanish). The app sends `Accept-Language: es | en` with every request and the
// error handler (middlewares/error.middleware.js) swaps the message for its
// translation here. A message that is not listed (for example one with a
// dynamic part) is returned as it was written.

const EN_TO_ES = {
  "A user cannot challenge themselves": "No podés desafiarte a vos mismo",
  "Accept the request before building the routine": "Aceptá el pedido antes de armar la rutina",
  "Account disabled": "Cuenta desactivada",
  "Add at least one exercise": "Agregá al menos un ejercicio",
  "Administrators cannot be reported through this endpoint": "No se puede denunciar a administradores desde acá",
  "Already logged today": "Ya registraste esto hoy",
  "An active challenge already exists between these users": "Ya hay un desafío activo entre estas personas",
  "An exercise is repeated": "Hay un ejercicio repetido",
  "Another trainer is already helping this person": "Otro entrenador ya está ayudando a esta persona",
  "Assistance request not found": "No se encontró el pedido de ayuda",
  "Authentication required": "Hace falta iniciar sesión",
  "Cannot delete user with active challenges. Complete or cancel them first.": "No se puede eliminar un usuario con desafíos activos. Completalos o cancelalos primero.",
  "Cannot delete user with pending assistance requests. Resolve them first.": "No se puede eliminar un usuario con pedidos de ayuda pendientes. Resolvelos primero.",
  "Cannot report yourself": "No podés denunciarte a vos mismo",
  "Challenge cannot be accepted in its current state": "El desafío no se puede aceptar en su estado actual",
  "Challenge cannot be cancelled in its current state": "El desafío no se puede cancelar en su estado actual",
  "Challenge must be ACCEPTED by the partner before it can be completed": "La otra persona tiene que aceptar el desafío antes de completarlo",
  "Challenge not found": "No se encontró el desafío",
  "Current password is incorrect": "La contraseña actual es incorrecta",
  "Custom exercise limit reached": "Llegaste al límite de ejercicios personalizados",
  "Denuncia not found": "No se encontró la denuncia",
  "Email already in use": "Ese email ya está en uso",
  "Forbidden": "No tenés permiso para hacer esto",
  "Forbidden: Only the assigned trainer can complete this": "Solo el entrenador asignado puede completar esto",
  "Forbidden: Only the assigned trainer can reject this request": "Solo el entrenador asignado puede rechazar este pedido",
  "Forbidden: Only the challenged partner can accept": "Solo la persona desafiada puede aceptar",
  "Forbidden: goal does not belong to this user": "Esa meta no pertenece a este usuario",
  "Forbidden: this assistance is not assigned to you": "Esta ayuda no está asignada a vos",
  "Forbidden: this request is not assigned to you": "Este pedido no está asignado a vos",
  "Forbidden: this request was addressed to another trainer": "Este pedido era para otro entrenador",
  "General routine not found": "No se encontró la rutina",
  "Goal not found": "No se encontró la meta",
  "Invalid QR payload": "El código QR no es válido",
  "Invalid availability value": "Valor de disponibilidad inválido",
  "Invalid credentials": "Email o contraseña incorrectos",
  "Invalid machine token": "El código de la máquina no es válido",
  "Invalid or expired code": "El código es inválido o ya venció",
  "Invalid or expired refresh token": "La sesión venció, iniciá sesión de nuevo",
  "Invalid or expired reset code": "El código es inválido o ya venció",
  "Invalid signature": "Firma inválida",
  "Invalid token": "Token inválido",
  "Invalid trainer selection": "Entrenador inválido",
  "Machine conflict not found": "No se encontró el conflicto de máquina",
  "Machine not found": "No se encontró la máquina",
  "Missing machineId in QR payload": "Al QR le falta el identificador de la máquina",
  "Missing userId in QR payload": "Al QR le falta el identificador del usuario",
  "No active challenge between these users": "No hay un desafío activo entre estas personas",
  "No active check-in session": "No tenés una visita al gym en curso",
  "No completed assistance found for this trainer": "No hay ayudas completadas de este entrenador",
  "Note not found": "No se encontró la nota",
  "Notification not found or does not belong to this user": "No se encontró la notificación",
  "One of the exercises does not exist": "Uno de los ejercicios no existe",
  "One or both users have machine tracking disabled and cannot be matched for a station challenge": "Una de las personas (o las dos) desactivó el seguimiento de máquinas y no se puede armar un desafío en una estación",
  "One or both users have social challenges disabled": "Una de las personas (o las dos) desactivó los desafíos sociales",
  "Only accepted reports can be removed": "Solo se pueden eliminar denuncias aceptadas",
  "Only completed interactions can be rated": "Solo se pueden calificar interacciones completadas",
  "Only pending reports can be escalated": "Solo se pueden escalar denuncias pendientes",
  "Only trainers can help members": "Solo los entrenadores pueden ayudar a socios",
  "Password updated": "Contraseña actualizada",
  "Points must be a non-zero number": "Los puntos deben ser un número distinto de cero",
  "Progress entry not found": "No se encontró el registro de progreso",
  "Provided partnerId does not match this challenge match-up": "La otra persona no coincide con este desafío",
  "QR expired": "El código QR venció",
  "QR payload is missing a type": "Al QR le falta el tipo",
  "Rating must be between 1 and 5": "La calificación debe estar entre 1 y 5",
  "Realtime service unavailable": "El servicio en tiempo real no está disponible",
  "Redemption not found": "No se encontró el canje",
  "Report not found": "No se encontró la denuncia",
  "Reported user not found": "No se encontró a la persona denunciada",
  "Request is not pending": "El pedido ya no está pendiente",
  "Request must be accepted before completion": "El pedido tiene que estar aceptado antes de completarlo",
  "Review request not found": "No se encontró el pedido de revisión",
  "Reward not found": "No se encontró el premio",
  "Routine not found": "No se encontró la rutina",
  "Routine request not found": "No se encontró el pedido de rutina",
  "Session does not belong to this user": "Esa visita no pertenece a este usuario",
  "Session must be completed before rating a trainer": "La visita tiene que estar terminada para calificar a un entrenador",
  "Session not found": "No se encontró la visita",
  "The exercise catalog is empty. Run the seed first.": "El catálogo de ejercicios está vacío",
  "The exercises of this routine are no longer available": "Los ejercicios de esta rutina ya no están disponibles",
  "The first user does not have an active gym session": "La primera persona no está en el gym",
  "The first user is mid-exercise and cannot be assigned a challenge right now": "La primera persona está en medio de un ejercicio y no se le puede asignar un desafío ahora",
  "The second user does not have an active gym session": "La segunda persona no está en el gym",
  "The second user is mid-exercise and cannot be assigned a challenge right now": "La segunda persona está en medio de un ejercicio y no se le puede asignar un desafío ahora",
  "There is no routine waiting for your answer": "No hay ninguna rutina esperando tu respuesta",
  "This QR code does not belong to a user": "Este código QR no pertenece a un usuario",
  "This account already has a password set": "Esta cuenta ya tiene una contraseña",
  "This conflict was already resolved": "Este conflicto ya fue resuelto",
  "This interaction has expired": "Esta interacción venció",
  "This interaction was already completed": "Esta interacción ya se completó",
  "This invitation has expired": "Esta invitación venció",
  "This invitation is no longer open": "Esta invitación ya no está abierta",
  "This person is not in the gym right now": "Esta persona no está en el gym ahora",
  "This report was already reviewed": "Esta denuncia ya fue revisada",
  "This request was already reviewed": "Este pedido ya fue revisado",
  "Token has been revoked": "El token fue revocado",
  "Too many authentication attempts": "Demasiados intentos de inicio de sesión. Esperá un momento.",
  "Too many requests": "Demasiados pedidos. Esperá un momento.",
  "Trainer account is disabled": "La cuenta del entrenador está desactivada",
  "Trainer is currently busy and cannot be assigned new assistance": "El entrenador está ocupado y no se le puede asignar otra ayuda",
  "Trainer not found": "No se encontró al entrenador",
  "Unauthorized": "No autorizado",
  "Unknown report kind": "Tipo de denuncia desconocido",
  "Unknown report state": "Estado de denuncia desconocido",
  "User is not a trainer": "El usuario no es entrenador",
  "User not found": "No se encontró al usuario",
  "User unavailable": "Usuario no disponible",
  "You already have a routine request in progress": "Ya tenés un pedido de rutina en curso",
  "You cannot change your own role. Ask another admin.": "No podés cambiar tu propio rol. Pedile a otro admin.",
  "You cannot deactivate your own account": "No podés desactivar tu propia cuenta",
  "You have already rated this trainer for this session": "Ya calificaste a este entrenador en esta visita",
  "You must be checked in to the gym": "Tenés que haber ingresado al gym",
  "Internal server error": "Error interno del servidor",
  "Not authorized to view this report": "No tenés permiso para ver esta denuncia",
  "Invalid year": "Año inválido",
  "Denuncia not found (es)": "Denuncia no encontrada",
};

// Messages that were written in Spanish in the code: give the English version too.
const ES_TO_EN = {
  "Año inválido": "Invalid year",
  "Denuncia no encontrada": "Denuncia not found",
  "No autorizado para ver esta denuncia": "Not authorized to view this report",
};
delete EN_TO_ES["Denuncia not found (es)"];

const ES_FROM_ES = new Set([...Object.values(EN_TO_ES), ...Object.keys(ES_TO_EN)]);

/**
 * "es" | "en" from the Accept-Language header. Only the app sends it; any other
 * client (scripts, tests, browsers) keeps getting the messages exactly as written.
 */
export function languageFromRequest(req) {
  const header = String(req?.headers?.["accept-language"] ?? "").toLowerCase();
  if (header.startsWith("es")) return "es";
  return "en";
}

/** The message in `lang`; unknown messages come back unchanged. */
export function translateMessage(message, lang) {
  if (typeof message !== "string") return message;
  if (lang === "es") {
    if (EN_TO_ES[message]) return EN_TO_ES[message];
    return message;
  }
  // English requested: Spanish originals get their English version, English ones stay.
  if (ES_TO_EN[message]) return ES_TO_EN[message];
  if (ES_FROM_ES.has(message)) {
    const entry = Object.entries(EN_TO_ES).find(([, es]) => es === message);
    if (entry) return entry[0];
  }
  return message;
}
