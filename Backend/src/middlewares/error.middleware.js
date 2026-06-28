export const notFoundHandler = (req, res) => {
  return res.status(404).json({
    success: false,
    message: "Route not found",
  });
};

export const errorHandler = (error, req, res, next) => {
  // Siempre registramos el error completo en la consola del servidor
  console.error(error);

  const statusCode = error.statusCode || 500;

  return res.status(statusCode).json({
    success: false,
    message: error.message || "Internal server error",
    // CORRECCIÓN: Si estamos en desarrollo, exponemos el 'stack' para debuggear fácil.
    // En producción (cuando NODE_ENV === 'production'), 'stack' será undefined y no se enviará en el JSON.
    ...(process.env.NODE_ENV !== "production" && { stack: error.stack }),
  });
};

export default errorHandler;