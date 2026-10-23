// src/utils/schedule.js
//
// Pure date/format helpers for the weekly routine schedule. A day is always
// identified by a local-time "YYYY-MM-DD" key (never a UTC ISO string, so a
// day can't shift when the device is in a negative-offset timezone).

// Rough estimate used to show "60 min" on each schedule row (the user can't
// type a duration anywhere in the design).
const MINUTES_PER_SET = 3;

const pad = (n) => String(n).padStart(2, '0');

export function toDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fromDateKey(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Monday of the week that contains `date`, shifted by `weekOffset` weeks. */
export function getWeekStart(date, weekOffset = 0) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysSinceMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - daysSinceMonday + weekOffset * 7);
  return start;
}

/** The 7 dates (Monday -> Sunday) of a week. */
export function getWeekDays(weekStart) {
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + i);
    return day;
  });
}

const capitalize = (text) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : text);

/** { weekday, day, month } already localized for `language`. */
export function getDateParts(date, language) {
  return {
    weekday: date.toLocaleDateString(language, { weekday: 'long' }),
    day: date.getDate(),
    month: date.toLocaleDateString(language, { month: 'long' }),
  };
}

export { capitalize };

export function estimateMinutes(exercises) {
  return exercises.reduce((total, ex) => total + (Number(ex.sets) || 0) * MINUTES_PER_SET, 0);
}

/** Title shown for a routine: own title, default-routine i18n key, or a fallback. */
export function resolveRoutineTitle(routine, t) {
  if (routine?.titleKey) return t(routine.titleKey);
  return routine?.title || t('user.routines.defaultDayTitle');
}
