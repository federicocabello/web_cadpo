const errorHandler = (err, req, res, next) => {
  console.error('Error:', err.message);

  const uploadTooLarge = err.code === 'LIMIT_FILE_SIZE';
  const tooManyFiles = err.code === 'LIMIT_FILE_COUNT';
  const statusCode = uploadTooLarge || tooManyFiles ? 413 : err.statusCode || 500;
  const message = uploadTooLarge
    ? 'El bloque enviado supera el tamaño permitido'
    : tooManyFiles ? 'Se pueden enviar hasta 20 archivos por carga' : err.message || 'Error interno del servidor';

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
