// Frontend/screens/user/yearWrapped/slides.js
// Turns the backend payload into the list of slides + texts.
// PURE function (no React): the whole "tone" (fun but serious) lives here.
// Every text comes from the i18n files (user.wrappedSlides.*) through `t`, so
// the Wrapped follows the language chosen in Settings.
//
// Shape of each slide:
//   { id, theme, kicker, big?, unit?, headline, body?, extra? }
//   extra: { type: 'list' | 'bar' | 'stats' | 'gift', ... }

const K = 'user.wrappedSlides';
const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTH_KEYS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

/** "2026-08-14" -> "jueves 14 de agosto" / "Thursday, August 14" (no Intl, no time zones). */
export function formatDayLong(isoDate, t) {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return t(`${K}.dayLong`, {
    weekday: t(`${K}.days.${DAY_KEYS[dow]}`),
    day: d,
    month: t(`${K}.months.${MONTH_KEYS[m - 1]}`),
  });
}

/** If there are 3 goals or fewer all are shown; otherwise only 3 (already sorted by difficulty). */
export function pickGoalsToShow(goals) {
  const items = goals?.items ?? [];
  return items.length <= 3 ? items : items.slice(0, 3);
}

const pick = (n, tiers) => tiers.find(([max]) => n <= max)[1];

export function buildSlides(data, t) {
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
    gift = { percent: 50, concept: '' },
  } = data;

  // "1 día" / "2 días": `${K}.<key>.one` / `.other`
  const unit = (n, key) => t(`${K}.${key}.${n === 1 ? 'one' : 'other'}`);
  const tier = (n, key, tiers) => t(`${K}.${key}.${pick(n, tiers)}`);

  const slides = [];

  // 1 — Intro
  slides.push({
    id: 'intro',
    theme: 'night',
    kicker: t(`${K}.intro.kicker`, { year }),
    headline: firstName ? t(`${K}.intro.headlineNamed`, { name: firstName }) : t(`${K}.intro.headline`),
    body: t(`${K}.intro.body`),
    extra: { type: 'intro' },
  });

  // 2 — Gym days
  const pct = Math.round((gymDays / 365) * 100);
  const dayTiers = [[0, 'none'], [29, 'few'], [99, 'some'], [199, 'many'], [Infinity, 'live']];
  slides.push({
    id: 'gymDays',
    theme: 'teal',
    kicker: t(`${K}.gymDays.kicker`),
    big: gymDays,
    unit: unit(gymDays, 'gymDays.unit'),
    headline: t(`${K}.gymDays.headline.${pick(gymDays, dayTiers)}`, { pct }),
    body: t(`${K}.gymDays.body.${pick(gymDays, dayTiers)}`),
  });

  // 3 — Points
  slides.push({
    id: 'points',
    theme: 'mint',
    kicker: t(`${K}.points.kicker`),
    big: totalPoints,
    unit: unit(totalPoints, 'points.unit'),
    headline: tier(totalPoints, 'points.headline', [[0, 'none'], [999, 'low'], [9999, 'mid'], [Infinity, 'high']]),
    body: t(`${K}.points.body`),
  });

  // 4 — Friends
  slides.push({
    id: 'friends',
    theme: 'paper',
    kicker: t(`${K}.friends.kicker`),
    big: friendsMade,
    unit: unit(friendsMade, 'friends.unit'),
    headline: tier(friendsMade, 'friends.headline', [[0, 'none'], [1, 'one'], [9, 'some'], [Infinity, 'many']]),
    body: tier(friendsMade, 'friends.body', [[0, 'none'], [9, 'some'], [Infinity, 'many']]),
  });

  // 5 — Achievements
  slides.push({
    id: 'achievements',
    theme: 'night',
    kicker: t(`${K}.achievements.kicker`),
    big: achievementsUnlocked,
    unit: unit(achievementsUnlocked, 'achievements.unit'),
    headline: tier(achievementsUnlocked, 'achievements.headline', [[0, 'none'], [4, 'few'], [14, 'some'], [Infinity, 'many']]),
    body: t(`${K}.achievements.body`),
  });

  // 6 — Goals
  const shownGoals = pickGoalsToShow(goalsCompleted);
  const goalCount = goalsCompleted.count ?? 0;
  slides.push({
    id: 'goals',
    theme: 'teal',
    kicker: t(`${K}.goals.kicker`),
    big: goalCount,
    unit: unit(goalCount, 'goals.unit'),
    headline:
      goalCount === 0
        ? t(`${K}.goals.headline.none`)
        : goalCount <= 3
          ? t(`${K}.goals.headline.few`)
          : t(`${K}.goals.headline.many`, { count: goalCount }),
    body: goalCount === 0 ? t(`${K}.goals.body`) : undefined,
    extra: goalCount > 0 ? { type: 'list', items: shownGoals.map((g) => g.label) } : undefined,
  });

  // 7 — Machines
  slides.push({
    id: 'machines',
    theme: 'mint',
    kicker: t(`${K}.machines.kicker`),
    big: machinesUsed,
    unit: unit(machinesUsed, 'machines.unit'),
    headline: tier(machinesUsed, 'machines.headline', [[0, 'none'], [5, 'few'], [15, 'some'], [Infinity, 'many']]),
    body: topMachine
      ? t(`${K}.machines.favorite`, { name: topMachine.name, count: topMachine.count, uses: unit(topMachine.count, 'machines.use') })
      : undefined,
    extra: totalMachines
      ? { type: 'bar', value: machinesUsed, total: totalMachines, caption: t(`${K}.machines.barCaption`, { total: totalMachines }) }
      : undefined,
  });

  // 8 — Most intense day
  if (mostIntenseDay) {
    slides.push({
      id: 'intense',
      theme: 'night',
      kicker: t(`${K}.intense.kicker`),
      headline: formatDayLong(mostIntenseDay.date, t),
      body: t(`${K}.intense.body`),
      extra: {
        type: 'stats',
        items: [
          { value: mostIntenseDay.minutes, label: t(`${K}.intense.minutes`) },
          { value: mostIntenseDay.machines, label: unit(mostIntenseDay.machines, 'intense.machine') },
          { value: mostIntenseDay.points, label: t(`${K}.intense.points`) },
        ],
      },
    });
  }

  // 9 — Routines
  slides.push({
    id: 'routines',
    theme: 'light',
    kicker: t(`${K}.routines.kicker`),
    big: distinctRoutines,
    unit: unit(distinctRoutines, 'routines.unit'),
    headline: tier(distinctRoutines, 'routines.headline', [[0, 'none'], [2, 'few'], [6, 'some'], [Infinity, 'many']]),
    body: t(`${K}.routines.body`),
  });

  // 10 — Recap
  slides.push({
    id: 'recap',
    theme: 'paper',
    kicker: t(`${K}.recap.kicker`, { year }),
    headline: t(`${K}.recap.headline`),
    extra: {
      type: 'recap',
      items: [
        { value: gymDays, label: t(`${K}.recap.gymDays`) },
        { value: totalPoints, label: t(`${K}.recap.points`) },
        { value: friendsMade, label: t(`${K}.recap.friends`) },
        { value: achievementsUnlocked, label: t(`${K}.recap.achievements`) },
        { value: goalCount, label: t(`${K}.recap.goals`) },
        { value: machinesUsed, label: t(`${K}.recap.machines`) },
      ],
    },
  });

  // 11 — Gift (final)
  slides.push({
    id: 'gift',
    theme: 'night',
    kicker: t(`${K}.gift.kicker`),
    headline: t(`${K}.gift.headline`),
    extra: { type: 'gift', percent: gift.percent, concept: gift.concept, conceptCode: gift.conceptCode, validUntil: gift.validUntil },
  });

  return slides;
}
