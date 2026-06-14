import dayjs from "dayjs";

export const now = () => dayjs();

export const nowIso = () =>
  dayjs().toISOString();

export const formatDate = (
  date,
  format = "YYYY-MM-DD"
) => {
  return dayjs(date).format(format);
};

export const diffMinutes = (
  start,
  end
) => {
  return dayjs(end).diff(
    dayjs(start),
    "minute"
  );
};

export const diffHours = (
  start,
  end
) => {
  return dayjs(end).diff(
    dayjs(start),
    "hour"
  );
};

export const addMinutes = (
  date,
  minutes
) => {
  return dayjs(date)
    .add(minutes, "minute")
    .toDate();
};

export const addHours = (
  date,
  hours
) => {
  return dayjs(date)
    .add(hours, "hour")
    .toDate();
};

export const isBefore = (
  first,
  second
) => {
  return dayjs(first).isBefore(second);
};

export const isAfter = (
  first,
  second
) => {
  return dayjs(first).isAfter(second);
};