const multer = require('multer');

module.exports = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 9 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.fieldname !== 'chunk') return cb(new Error('Bloque de repetición inválido'));
    cb(null, true);
  },
});
