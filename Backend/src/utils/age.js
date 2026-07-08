/**
 * Computes age in whole years from a birthday, as of `now`.
 *
 * This is intentionally the single source of truth for "age" in the app.
 * We never persist an `age` integer on the User model — only `birthday`.
 * A stored age field would go stale the instant a birthday passes (or
 * require a nightly script to patch every row); computing it on every read
 * instead means it is always correct, for every user, with zero drift.
 *
 * @param {Date|string|null|undefined} birthday
 * @param {Date} [now] - Injectable for tests; defaults to current time.
 * @returns {number|null} Age in whole years, or null if no birthday is set.
 */
export function calculateAge(birthday, now = new Date()) {
  if (!birthday) return null;

  const birthDate = new Date(birthday);
  if (Number.isNaN(birthDate.getTime())) return null;

  let age = now.getFullYear() - birthDate.getFullYear();

  const hasHadBirthdayThisYear =
    now.getMonth() > birthDate.getMonth() ||
    (now.getMonth() === birthDate.getMonth() && now.getDate() >= birthDate.getDate());

  if (!hasHadBirthdayThisYear) age -= 1;

  return age;
}

/**
 * Whether `date`'s month/day matches `today`'s month/day (i.e. it's their
 * birthday today), regardless of year. Handles Feb 29 birthdays on non-leap
 * years by treating them as Feb 28 so leap-year users still get a yearly
 * email instead of one every four years.
 *
 * @param {Date|string|null|undefined} birthday
 * @param {Date} [today]
 * @returns {boolean}
 */
export function isBirthdayToday(birthday, today = new Date()) {
  if (!birthday) return false;

  const birthDate = new Date(birthday);
  if (Number.isNaN(birthDate.getTime())) return false;

  const isFeb29 = birthDate.getMonth() === 1 && birthDate.getDate() === 29;
  const isNonLeapYear = !isLeapYear(today.getFullYear());

  if (isFeb29 && isNonLeapYear) {
    return today.getMonth() === 1 && today.getDate() === 28;
  }

  return today.getMonth() === birthDate.getMonth() && today.getDate() === birthDate.getDate();
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}
