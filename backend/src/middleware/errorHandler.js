const errorHandler = (err, req, res, next) => {
  console.error('Error:', err.message);

  const uploadTooLarge = err.code === 'LIMIT_FILE_SIZE';
  const statusCode = uploadTooLarge ? 413 : err.statusCode || 500;
  const message = uploadTooLarge ? 'El bloque enviado supera el tamaño permitido' : err.message || 'Error interno del servidor';

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
