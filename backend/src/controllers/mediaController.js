const fs = require('fs/promises');
const path = require('path');
const slugify = require('../utils/slugify');

const publicDir = path.resolve(__dirname, '../../../frontend/public');
const imageExtensions = new Set(['.avif', '.webp', '.jpg', '.jpeg', '.png']);

const toPublicUrl = filePath => {
  const relative = path.relative(publicDir, filePath).replace(/\\/g, '/');
  return `/${relative}`;
};

const getChampionshipImages = async (req, res, next) => {
  try {
    const { categoria, temporada } = req.query;

    if (!categoria || !temporada) {
      return res.status(400).json({ error: 'categoria y temporada son requeridos' });
    }

    const categorySlug = slugify(categoria);
    const seasonSlug = `temporada-${slugify(temporada)}`;
    const targetDir = path.join(publicDir, 'media', 'campeonatos', categorySlug, seasonSlug);

    let files = [];
    try {
      files = await fs.readdir(targetDir, { withFileTypes: true });
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }

    const images = files
      .filter(file => file.isFile() && imageExtensions.has(path.extname(file.name).toLowerCase()))
      .map(file => toPublicUrl(path.join(targetDir, file.name)));

    res.json({
      data: images,
      total: images.length,
      path: `/media/campeonatos/${categorySlug}/${seasonSlug}`,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = { getChampionshipImages };
