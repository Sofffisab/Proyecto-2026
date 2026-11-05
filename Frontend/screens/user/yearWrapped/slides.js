// YearWrapped/frontend/slides.js
// Convierte el payload del backend en la lista de diapositivas + textos.
// Función PURA (sin React): acá vive todo el "tono" (divertido pero serio).
//
// Forma de cada slide:
//   { id, theme, kicker, big?, unit?, headline, body?, extra? }
//   extra: { type: 'list' | 'bar' | 'stats' | 'gift', ... }

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export const plural = (n, uno, varios) => (n === 1 ? uno : varios);

/** "2026-08-14" -> "jueves 14 de agosto" (sin Intl, sin zonas horarias). */
export function formatDayLong(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${DIAS[dow]} ${d} de ${MESES[m - 1]}`;
}

const pick = (n, tiers) => tiers.find(([max]) => n <= max)[1];

/** Si hay 3 metas o menos se muestran todas; si hay más, solo 3 (ya vienen ordenadas por dificultad). */
export function pickGoalsToShow(goals) {
  const items = goals?.items ?? [];
  return items.length <= 3 ? items : items.slice(0, 3);
}

export function buildSlides(data) {
  const {
    year,
    firstName,
    totalPoints = 0,
    friendsMade = 0,
    achievementsUnlocked = 0,
    gymDays = 0,
    goalsCompleted = { count: 0, items: [] },
    machinesUsed = 0,
    totalMachines = null,
    topMachine = null,
    mostIntenseDay = null,
    distinctRoutines = 0,
    gift = { percent: 50, concept: 'cuota de enero' },
  } = data;

  const slides = [];

  // 1 — Intro
  slides.push({
    id: 'intro',
    theme: 'night',
    kicker: `TU ${year}`,
    headline: firstName ? `${firstName}, repasemos tu año en el gym.` : 'Repasemos tu año en el gym.',
    body: 'Con datos reales, sin trampa. Tocá para avanzar.',
    extra: { type: 'intro' },
  });

  // 2 — Días de gym
  const pct = Math.round((gymDays / 365) * 100);
  slides.push({
    id: 'gymDays',
    theme: 'teal',
    kicker: 'CONSTANCIA',
    big: gymDays,
    unit: plural(gymDays, 'día en el gym', 'días en el gym'),
    headline: pick(gymDays, [
      [0, 'Este año no pisaste el gym.'],
      [29, 'Pocos, pero cada uno cuenta.'],
      [99, `Eso es el ${pct}% del año.`],
      [199, `El ${pct}% de tus días fueron de entrenamiento.`],
      [Infinity, 'Prácticamente vivís acá.'],
    ]),
    body: pick(gymDays, [
      [0, 'No pasa nada: el mejor momento para arrancar es enero.'],
      [29, 'La constancia se construye de a uno. Vos ya empezaste.'],
      [99, 'Hay un hábito formándose, y se nota.'],
      [199, 'Eso no es suerte, es disciplina.'],
      [Infinity, 'Podríamos cobrarte alquiler. Es un halago.'],
    ]),
  });

  // 3 — Puntos
  slides.push({
    id: 'points',
    theme: 'mint',
    kicker: 'PUNTOS GANADOS',
    big: totalPoints,
    unit: plural(totalPoints, 'punto', 'puntos'),
    headline: pick(totalPoints, [
      [0, 'Todavía no sumaste puntos.'],
      [999, 'Un buen arranque.'],
      [9999, 'Sumaste puntos como quien no quiere la cosa.'],
      [Infinity, 'Tu cuenta de puntos hace ruido.'],
    ]),
    body: 'Cada check-in, cada rutina y cada logro sumó. Acá está el total del año.',
  });

  // 4 — Amigos
  slides.push({
    id: 'friends',
    theme: 'paper',
    kicker: 'COMUNIDAD',
    big: friendsMade,
    unit: plural(friendsMade, 'amigo nuevo', 'amigos nuevos'),
    headline: pick(friendsMade, [
      [0, 'Todavía no sumaste amigos acá.'],
      [1, 'Uno solo, pero de los buenos.'],
      [9, 'El gym también es social.'],
      [Infinity, 'Sos el alma del gimnasio.'],
    ]),
    body: pick(friendsMade, [
      [0, 'Hay muchas máquinas para compartir. Animate a decir hola.'],
      [9, 'Entrenar acompañado es entrenar más tiempo.'],
      [Infinity, 'Si alguien pregunta por vos, ya sabemos por qué.'],
    ]),
  });

  // 5 — Logros
  slides.push({
    id: 'achievements',
    theme: 'night',
    kicker: 'LOGROS',
    big: achievementsUnlocked,
    unit: plural(achievementsUnlocked, 'logro desbloqueado', 'logros desbloqueados'),
    headline: pick(achievementsUnlocked, [
      [0, 'Todavía no desbloqueaste logros.'],
      [4, 'Ya tenés tus primeras medallas.'],
      [14, 'Tu vitrina se está llenando.'],
      [Infinity, 'Coleccionista nivel experto.'],
    ]),
    body: 'Cada uno marca algo que antes no podías hacer.',
  });

  // 6 — Metas
  const shownGoals = pickGoalsToShow(goalsCompleted);
  const goalCount = goalsCompleted.count ?? 0;
  slides.push({
    id: 'goals',
    theme: 'teal',
    kicker: 'METAS ALCANZADAS',
    big: goalCount,
    unit: plural(goalCount, 'meta cumplida', 'metas cumplidas'),
    headline:
      goalCount === 0
        ? 'Ninguna meta cerrada todavía.'
        : goalCount <= 3
          ? 'Pocas, pero ganadas a pulmón:'
          : `Fueron ${goalCount}. Estas 3 se llevan el aplauso:`,
    body: goalCount === 0 ? 'Las metas grandes llevan tiempo. Seguí: ya estás en camino.' : undefined,
    extra: goalCount > 0 ? { type: 'list', items: shownGoals.map((g) => g.label) } : undefined,
  });

  // 7 — Máquinas
  slides.push({
    id: 'machines',
    theme: 'mint',
    kicker: 'MÁQUINAS',
    big: machinesUsed,
    unit: plural(machinesUsed, 'máquina distinta', 'máquinas distintas'),
    headline: pick(machinesUsed, [
      [0, 'Todavía no probaste ninguna máquina.'],
      [5, 'Fiel a tus favoritas.'],
      [15, 'Un explorador del gimnasio.'],
      [Infinity, 'Probaste casi todo el salón.'],
    ]),
    body: topMachine ? `Tu preferida: ${topMachine.name}, con ${topMachine.count} ${plural(topMachine.count, 'uso', 'usos')}.` : undefined,
    extra: totalMachines ? { type: 'bar', value: machinesUsed, total: totalMachines, caption: `de ${totalMachines} que tiene el gimnasio` } : undefined,
  });

  // 8 — Día más intenso
  if (mostIntenseDay) {
    slides.push({
      id: 'intense',
      theme: 'night',
      kicker: 'TU DÍA MÁS INTENSO',
      headline: formatDayLong(mostIntenseDay.date),
      body: 'Ese día no fuiste a entrenar: fuiste a dejar huella.',
      extra: {
        type: 'stats',
        items: [
          { value: mostIntenseDay.minutes, label: 'minutos' },
          { value: mostIntenseDay.machines, label: plural(mostIntenseDay.machines, 'máquina', 'máquinas') },
          { value: mostIntenseDay.points, label: 'puntos' },
        ],
      },
    });
  }

  // 9 — Rutinas
  slides.push({
    id: 'routines',
    theme: 'light',
    kicker: 'RUTINAS',
    big: distinctRoutines,
    unit: plural(distinctRoutines, 'rutina distinta', 'rutinas distintas'),
    headline: pick(distinctRoutines, [
      [0, 'Todavía no armaste una rutina.'],
      [2, 'Vas por lo seguro, y funciona.'],
      [6, 'Variar también es un plan.'],
      [Infinity, 'Tu cuerpo nunca sabe qué viene.'],
    ]),
    body: 'Cambiar de estímulo es parte de progresar.',
  });

  // 10 — Resumen
  slides.push({
    id: 'recap',
    theme: 'paper',
    kicker: `TU ${year} EN NÚMEROS`,
    headline: 'Un año, resumido.',
    extra: {
      type: 'recap',
      items: [
        { value: gymDays, label: 'días de gym' },
        { value: totalPoints, label: 'puntos' },
        { value: friendsMade, label: 'amigos' },
        { value: achievementsUnlocked, label: 'logros' },
        { value: goalCount, label: 'metas' },
        { value: machinesUsed, label: 'máquinas' },
      ],
    },
  });

  // 11 — Regalo (final)
  slides.push({
    id: 'gift',
    theme: 'night',
    kicker: 'ANTES DE IRTE',
    headline: 'Tenemos un regalo para vos...',
    extra: { type: 'gift', percent: gift.percent, concept: gift.concept, validUntil: gift.validUntil },
  });

  return slides;
}
