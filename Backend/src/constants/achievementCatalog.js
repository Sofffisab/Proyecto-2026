// Personal badge catalog (no leaderboard). Used by prisma/seed.js AND by
// gamification.service.js#ensureAchievementCatalog, which creates whatever is
// missing in the database, so badges work even if the seed never ran.
// metric = what `threshold` is compared against (see achievementMetrics.service.js).

const a = (name, description, category, metric, threshold, pointsRequired = 0) => ({
  name, description, category, metric, threshold, ...(pointsRequired ? { pointsRequired } : {}),
});

export const ACHIEVEMENT_CATALOG = [
  // Gym visits (total number of times they came)
  a("Primera visita", "Viniste al gimnasio por primera vez.", "CONSISTENCY", "GYM_VISITS", 1),
  a("5 visitas", "Viniste 5 veces al gimnasio.", "CONSISTENCY", "GYM_VISITS", 5),
  a("10 visitas", "Viniste 10 veces al gimnasio.", "CONSISTENCY", "GYM_VISITS", 10),
  a("25 visitas", "Viniste 25 veces al gimnasio.", "CONSISTENCY", "GYM_VISITS", 25),
  a("50 visitas", "Viniste 50 veces al gimnasio.", "CONSISTENCY", "GYM_VISITS", 50),
  a("100 visitas", "Cien veces en el gimnasio. ¡Un clásico!", "CONSISTENCY", "GYM_VISITS", 100),
  // Consistency — day streaks
  a("3 días seguidos", "Fuiste al gimnasio 3 días consecutivos.", "CONSISTENCY", "STREAK_DAYS", 3),
  a("7 días seguidos", "Una semana entera sin faltar.", "CONSISTENCY", "STREAK_DAYS", 7),
  a("14 días seguidos", "Dos semanas sin faltar.", "CONSISTENCY", "STREAK_DAYS", 14),
  a("30 días seguidos", "Un mes entero sin faltar ni un día.", "CONSISTENCY", "STREAK_DAYS", 30),
  // Consistency — week streaks
  a("4 semanas seguidas", "Un mes yendo al menos una vez por semana.", "CONSISTENCY", "STREAK_WEEKS", 4),
  a("12 semanas seguidas", "Tres meses de constancia semanal.", "CONSISTENCY", "STREAK_WEEKS", 12),
  // Consistency — month streaks
  a("3 meses seguidos", "Tres meses seguidos entrenando.", "CONSISTENCY", "STREAK_MONTHS", 3),
  a("6 meses seguidos", "Medio año de constancia.", "CONSISTENCY", "STREAK_MONTHS", 6),
  a("12 meses seguidos", "Un año entero de constancia.", "CONSISTENCY", "STREAK_MONTHS", 12),
  // Social
  a("Primer desafío social", "Completaste tu primer desafío social con otro miembro.", "SOCIAL", "SOCIAL_INTERACTIONS", 1),
  a("5 amigos", "Completaste 5 interacciones sociales.", "SOCIAL", "SOCIAL_INTERACTIONS", 5),
  a("Socialite", "Completaste 10 interacciones sociales.", "SOCIAL", "SOCIAL_INTERACTIONS", 10),
  a("25 interacciones", "Completaste 25 interacciones sociales.", "SOCIAL", "SOCIAL_INTERACTIONS", 25),
  a("Alma del gimnasio", "Completaste 50 interacciones sociales.", "SOCIAL", "SOCIAL_INTERACTIONS", 50),
  // Machine usage
  a("Primera máquina", "Usaste una máquina por primera vez.", "MACHINE", "MACHINE_USES", 1),
  a("10 usos de máquina", "Registraste 10 usos de máquina.", "MACHINE", "MACHINE_USES", 10),
  a("25 usos de máquina", "Registraste 25 usos de máquina.", "MACHINE", "MACHINE_USES", 25),
  a("50 usos de máquina", "Registraste 50 usos de máquina.", "MACHINE", "MACHINE_USES", 50),
  a("100 usos de máquina", "Registraste 100 usos de máquina.", "MACHINE", "MACHINE_USES", 100),
  a("Explorador", "Probaste 5 máquinas distintas.", "MACHINE", "MACHINES_TRIED", 5),
  a("Todoterreno", "Probaste 10 máquinas distintas.", "MACHINE", "MACHINES_TRIED", 10),
  // Trainer help
  a("Primera ayuda", "Un entrenador te ayudó por primera vez.", "TRAINER", "TRAINER_ASSISTANCES", 1),
  a("5 ayudas", "Un entrenador te ayudó 5 veces.", "TRAINER", "TRAINER_ASSISTANCES", 5),
  a("15 ayudas", "Un entrenador te ayudó 15 veces.", "TRAINER", "TRAINER_ASSISTANCES", 15),
  // Points
  a("100 puntos", "Llegaste a 100 puntos.", "POINTS", "TOTAL_POINTS", 0, 100),
  a("500 puntos", "Llegaste a 500 puntos.", "POINTS", "TOTAL_POINTS", 0, 500),
  a("1.000 puntos", "Llegaste a 1.000 puntos.", "POINTS", "TOTAL_POINTS", 0, 1000),
  a("2.500 puntos", "Llegaste a 2.500 puntos.", "POINTS", "TOTAL_POINTS", 0, 2500),
];
