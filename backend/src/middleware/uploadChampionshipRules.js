const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const publicDir = require('../utils/publicDir');
const rulesDir = path.join(publicDir, 'media', 'campeonatos', 'reglamentos');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdirSync(rulesDir, { recursive: true });
    cb(null, rulesDir);
  },
  filename: (req, file, cb) => {
    const randomName = crypto.randomBytes(16).toString('hex');
    cb(null, `${randomName}.pdf`);
  },
});

const fileFilter = (req, file, cb) => {
  const extension = path.extname(file.originalname).toLowerCase();

  if (extension !== '.pdf' || file.mimetype !== 'application/pdf') {
    cb(new Error('El reglamento debe ser un PDF'));
    return;
  }

  cb(null, true);
};

const uploadChampionshipRules = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

module.exports = uploadChampionshipRules;
