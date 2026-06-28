export const notFoundHandler = (req, res) => {
  return res.status(404).json({
    success: false,
    message: "Route not found",
  });
};

export const errorHandler = (error, req, res, next) => {
  const statusCode = error.statusCode || 500;

  // Log full error details only in development
  if (process.env.NODE_ENV !== "production") {
    console.error("[Error]", error);
  } else {
    // In production, log minimal info (status and message without stack)
    console.error("[Error]", { statusCode, message: error.message });
  }

  // Determine the response message
  let message = error.message || "Internal server error";

  // For 5xx errors (server errors), return generic message to avoid leaking internals
  if (statusCode >= 500) {
    message = "Internal server error";
  }

  return res.status(statusCode).json({
    success: false,
    message,
    // Include stack trace only in development
    ...(process.env.NODE_ENV !== "production" && { stack: error.stack }),
  });
};

export default errorHandler;