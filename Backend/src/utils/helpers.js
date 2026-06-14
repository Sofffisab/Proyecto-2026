export const isEmpty = (value) => {
  if (value === null || value === undefined) {
    return true;
  }

  if (typeof value === "string") {
    return value.trim() === "";
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  return false;
};

export const removeUndefined = (
  object
) => {
  return Object.fromEntries(
    Object.entries(object).filter(
      ([, value]) =>
        value !== undefined
    )
  );
};

export const pick = (
  object,
  fields
) => {
  return fields.reduce(
    (accumulator, field) => {
      if (field in object) {
        accumulator[field] =
          object[field];
      }

      return accumulator;
    },
    {}
  );
};

export const calculateAverage = (
  values = []
) => {
  if (!values.length) {
    return 0;
  }

  const total = values.reduce(
    (sum, value) => sum + value,
    0
  );

  return total / values.length;
};

export const paginate = ({
  page = 1,
  limit = 20,
}) => {
  const safePage = Math.max(
    Number(page),
    1
  );

  const safeLimit = Math.max(
    Number(limit),
    1
  );

  return {
    skip:
      (safePage - 1) * safeLimit,
    take: safeLimit,
  };
};