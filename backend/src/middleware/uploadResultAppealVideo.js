const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const publicDir = require('../utils/publicDir');
const appealVideosDir = path.join(publicDir, 'media', 'resultados', 'apelaciones');
const allowedExtensions = new Set(['.mp4', '.webm', '.mov', '.avi', '.mkv']);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(appealVideosDir, { recursive: true });
    cb(null, appealVideosDir);
  },
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(12).toString('hex')}${extension}`);
  },
});

module.exports = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (!allowedExtensions.has(extension)) {
      cb(new Error('Formato de video no permitido. Usá MP4, WEBM, MOV, AVI o MKV.'));
      return;
    }
    cb(null, true);
  },
});
