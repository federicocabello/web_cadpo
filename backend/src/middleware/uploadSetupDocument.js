const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const publicDir = require('../utils/publicDir');

const documentsDir = path.join(publicDir, 'media', 'puesta-a-punto', 'documentos');

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    fs.mkdirSync(documentsDir, { recursive: true });
    callback(null, documentsDir);
  },
  filename: (req, file, callback) => {
    callback(null, `${Date.now()}-${crypto.randomBytes(12).toString('hex')}.pdf`);
  },
});

const uploadSetupDocument = multer({
  storage,
  fileFilter: (req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (extension !== '.pdf' || file.mimetype !== 'application/pdf') {
      callback(new Error('El documento debe estar en formato PDF'));
      return;
    }
    callback(null, true);
  },
  limits: { fileSize: 40 * 1024 * 1024 },
});

module.exports = uploadSetupDocument;
