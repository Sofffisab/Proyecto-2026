export const notFoundHandler = (
  req,
  res
) => {
  return res.status(404).json({
    success: false,
    message: "Route not found",
  });
};

export const errorHandler = (
  error,
  req,
  res,
  next
) => {
  console.error(error);

  const statusCode =
    error.statusCode || 500;

  return res.status(statusCode).json({
    success: false,
    message:
      error.message ||
      "Internal server error",
  });
};

export default errorHandler;