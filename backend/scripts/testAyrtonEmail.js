const path = require('path');

require('dotenv').config({
  path: path.resolve(__dirname, '../.env'),
  quiet: true,
});

const { notifyInteraction } = require('../src/services/ayrtonAudit');

notifyInteraction({
  sessionId: 'prueba-utf8-real',
  question: '¿Cuándo es la próxima clasificación y quién está primero?',
  answer: 'Prueba de codificación: inscripción, campeón, posición, último y también ñ.',
  durationMs: 1250,
}).then(result => {
  if (!result.sent) throw new Error('El SMTP no está configurado');
  console.log('Correo de prueba UTF-8 enviado desde un archivo real.');
}).catch(error => {
  console.error(`Falló la prueba: ${error.message}`);
  process.exitCode = 1;
});
