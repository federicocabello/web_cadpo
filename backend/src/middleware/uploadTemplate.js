const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const publicDir = require('../utils/publicDir');
const templateDir = path.join(publicDir, 'media', 'plantillas');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(templateDir, { recursive: true });
    cb(null, templateDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${crypto.randomBytes(10).toString('hex')}.zip`);
  },
});

module.exports = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname).toLowerCase() !== '.zip') {
      cb(new Error('La plantilla debe subirse en formato ZIP.'));
      return;
    }
    cb(null, true);
  },
});
