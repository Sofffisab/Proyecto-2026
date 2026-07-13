// Computes age in whole years. Not persisted on User, so always computed fresh.
export function calculateAge(birthday, now = new Date()) {
  if (!birthday) return null;

  const birthDate = new Date(birthday);
  if (Number.isNaN(birthDate.getTime())) return null;

  let age = now.getUTCFullYear() - birthDate.getUTCFullYear();

  const hasHadBirthdayThisYear =
    now.getUTCMonth() > birthDate.getUTCMonth() ||
    (now.getUTCMonth() === birthDate.getUTCMonth() && now.getUTCDate() >= birthDate.getUTCDate());

  if (!hasHadBirthdayThisYear) age -= 1;

  return age;
}

// True if today matches the birthday's month/day. Feb 29 falls back to
// Feb 28 on non-leap years so those users still get a yearly email.
export function isBirthdayToday(birthday, today = new Date()) {
  if (!birthday) return false;

  const birthDate = new Date(birthday);
  if (Number.isNaN(birthDate.getTime())) return false;

  const isFeb29 = birthDate.getUTCMonth() === 1 && birthDate.getUTCDate() === 29;
  const isNonLeapYear = !isLeapYear(today.getUTCFullYear());

  if (isFeb29 && isNonLeapYear) {
    return today.getUTCMonth() === 1 && today.getUTCDate() === 28;
  }

  return today.getUTCMonth() === birthDate.getUTCMonth() && today.getUTCDate() === birthDate.getUTCDate();
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}
