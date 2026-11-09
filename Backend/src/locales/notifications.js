// Texts of the notifications the Backend writes for the admin / trainer / routine
// features, in the language each person chose in Settings (User.language).
// Everything the screens show is translated in the app itself (Frontend/i18n);
// these are the ones that are stored as plain text and must be written in the
// right language when they are created.

import { prisma } from "../config/index.js";
import { createNotification } from "../services/communication.service.js";

const TEXTS = {
  es: {
    ROUTINE_PROPOSAL: ({ trainer }) => ({
      title: "Tu entrenador te preparó una rutina",
      body: `${trainer ?? "Tu entrenador"} te preparó una rutina. Esta es la rutina que te prepararon, ¿la aceptás?`,
    }),
    ROUTINE_REQUEST_REJECTED: () => ({
      title: "Tu pedido de rutina no pudo tomarse",
      body: "Un entrenador no pudo armar tu rutina esta vez. Podés volver a pedirla.",
    }),
    ROUTINE_ANSWERED: ({ member, accepted }) => ({
      title: accepted ? "Aceptaron tu rutina" : "No aceptaron tu rutina",
      body: accepted ? `${member} aceptó la rutina que le armaste.` : `${member} no aceptó la rutina que le armaste.`,
    }),
    REPORT_PENALTY: ({ points }) => ({
      title: "Se aplicó una penalización",
      body: `Se aceptó una denuncia en tu contra. Se descontaron ${points} puntos de tu cuenta.`,
    }),
    REPORT_NO_PENALTY: () => ({
      title: "Denuncia revisada",
      body: "Se aceptó una denuncia en tu contra. Esta vez no se descontaron puntos, pero las próximas denuncias aceptadas empezarán a restarte puntos.",
    }),
    POINTS_RETURNED: ({ points }) => ({
      title: "Puntos devueltos",
      body: `Se eliminó una denuncia en tu contra. Te devolvimos ${points} puntos.`,
    }),
  },
  en: {
    ROUTINE_PROPOSAL: ({ trainer }) => ({
      title: "Your trainer prepared a routine",
      body: `${trainer ?? "Your trainer"} prepared a routine for you. This is the routine they prepared, do you accept it?`,
    }),
    ROUTINE_REQUEST_REJECTED: () => ({
      title: "Your routine request could not be taken",
      body: "A trainer could not build your routine this time. You can ask for it again.",
    }),
    ROUTINE_ANSWERED: ({ member, accepted }) => ({
      title: accepted ? "Your routine was accepted" : "Your routine was not accepted",
      body: accepted ? `${member} accepted the routine you built.` : `${member} did not accept the routine you built.`,
    }),
    REPORT_PENALTY: ({ points }) => ({
      title: "A penalty was applied",
      body: `A report against you was accepted. ${points} points were deducted from your account.`,
    }),
    REPORT_NO_PENALTY: () => ({
      title: "Report reviewed",
      body: "A report against you was accepted. No points were deducted this time, but further accepted reports will start reducing your points.",
    }),
    POINTS_RETURNED: ({ points }) => ({
      title: "Points returned",
      body: `A report against you was removed. ${points} points were given back to your account.`,
    }),
  },
};

async function languageOf(userId) {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { language: true } });
    return user?.language === "en" ? "en" : "es";
  } catch {
    return "es";
  }
}

/** Creates the in-app notification `key` for `userId` in their language. */
export async function notifyLocalized(userId, key, params = {}) {
  const lang = await languageOf(userId);
  const { title, body } = TEXTS[lang][key](params);
  return createNotification(userId, title, body);
}
