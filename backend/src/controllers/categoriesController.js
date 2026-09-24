const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const pool = require('../config/db');
const publicDir = require('../utils/publicDir');
const slugify = require('../utils/slugify');

const galleryImageExtensions = new Set(['.avif', '.webp', '.jpg', '.jpeg', '.png']);

const toPublicLogoPath = file => {
  if (!file) return '';

  return `/media/categorias/logos/${file.filename}`;
};

const normalizeCategoryValue = value => String(value || '').trim();

const getGalleryDirectories = (category, championship) => {
  const categorySlug = slugify(category.categoria);
  const seasonSlug = `temporada-${slugify(championship.temporada)}`;
  return {
    formulario: {
      directory: path.join(publicDir, 'media', 'inscripciones', categorySlug, seasonSlug),
      publicPath: `/media/inscripciones/${categorySlug}/${seasonSlug}`,
    },
    categoria: {
      directory: path.join(publicDir, 'media', 'categorias', 'galerias', categorySlug, seasonSlug),
      publicPath: `/media/categorias/galerias/${categorySlug}/${seasonSlug}`,
    },
  };
};

const listGalleryImages = async (gallery, source) => {
  let entries = [];
  try {
    entries = await fs.readdir(gallery.directory, { withFileTypes: true });
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  return entries
    .filter(entry => entry.isFile() && galleryImageExtensions.has(path.extname(entry.name).toLowerCase()))
    .map(entry => ({ filename: entry.name, url: `${gallery.publicPath}/${entry.name}`, source }))
    .sort((a, b) => a.filename.localeCompare(b.filename));
};

const listSeasonImages = async galleries => {
  const [formImages, categoryImages] = await Promise.all([
    listGalleryImages(galleries.formulario, 'formulario'),
    listGalleryImages(galleries.categoria, 'categoria'),
  ]);
  return [...categoryImages, ...formImages];
};

const getCategoryAndChampionship = async (categoryId, championshipId) => {
  const [[category]] = await pool.query('SELECT id, categoria, logo FROM categorias WHERE id = ?', [categoryId]);
  if (!category) return {};
  const [[championship]] = await pool.query(
    'SELECT id, idcategoria, temporada, anio FROM campeonatos WHERE id = ? AND idcategoria = ?',
    [championshipId, categoryId],
  );
  return { category, championship };
};

const getAll = async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT id, categoria, logo FROM categorias ORDER BY categoria ASC');
    res.json({ data: rows, total: rows.length });
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const [[row]] = await pool.query('SELECT id, categoria, logo FROM categorias WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Categoría no encontrada' });

    res.json({ data: row });
  } catch (err) {
    next(err);
  }
};

const getGallery = async (req, res, next) => {
  try {
    const [[category]] = await pool.query('SELECT id, categoria, logo FROM categorias WHERE id = ?', [req.params.id]);
    if (!category) return res.status(404).json({ error: 'Categoría no encontrada' });
    const [championships] = await pool.query(
      `SELECT id, temporada, anio
       FROM campeonatos
       WHERE idcategoria = ?
       ORDER BY anio DESC, CAST(temporada AS UNSIGNED) DESC, id DESC`,
      [req.params.id],
    );
    const seasons = await Promise.all(championships.map(async championship => {
      const galleries = getGalleryDirectories(category, championship);
      return { ...championship, images: await listSeasonImages(galleries), path: galleries.categoria.publicPath };
    }));
    res.json({ data: { category, seasons } });
  } catch (error) {
    next(error);
  }
};

const uploadGalleryImages = async (req, res, next) => {
  try {
    const { category, championship } = await getCategoryAndChampionship(req.params.id, req.params.championshipId);
    if (!category) return res.status(404).json({ error: 'Categoría no encontrada' });
    if (!championship) return res.status(400).json({ error: 'La temporada no pertenece a la categoría seleccionada' });
    if (!req.files?.length) return res.status(400).json({ error: 'Seleccioná al menos una foto' });
    const galleries = getGalleryDirectories(category, championship);
    const gallery = galleries.categoria;
    await fs.mkdir(gallery.directory, { recursive: true });
    await Promise.all(req.files.map(file => {
      const extension = path.extname(file.originalname).toLowerCase();
      const filename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${extension}`;
      return fs.writeFile(path.join(gallery.directory, filename), file.buffer);
    }));
    const images = await listSeasonImages(galleries);
    res.status(201).json({ data: images, path: gallery.publicPath, message: `${req.files.length} foto${req.files.length === 1 ? '' : 's'} cargada${req.files.length === 1 ? '' : 's'}` });
  } catch (error) {
    next(error);
  }
};

const removeGalleryImage = async (req, res, next) => {
  try {
    const { category, championship } = await getCategoryAndChampionship(req.params.id, req.params.championshipId);
    if (!category || !championship) return res.status(404).json({ error: 'Categoría o temporada no encontrada' });
    const filename = path.basename(String(req.params.filename || ''));
    if (!filename || filename !== req.params.filename || !galleryImageExtensions.has(path.extname(filename).toLowerCase())) {
      return res.status(400).json({ error: 'Nombre de imagen inválido' });
    }
    const galleries = getGalleryDirectories(category, championship);
    const source = req.query.source === 'formulario' ? 'formulario' : 'categoria';
    const gallery = galleries[source];
    try {
      await fs.unlink(path.join(gallery.directory, filename));
    } catch (error) {
      if (error.code === 'ENOENT') return res.status(404).json({ error: 'Imagen no encontrada' });
      throw error;
    }
    res.json({ data: await listSeasonImages(galleries), message: 'Foto eliminada' });
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const categoria = normalizeCategoryValue(req.body.categoria);
    if (!categoria) return res.status(400).json({ error: 'categoria es requerida' });

    const logo = toPublicLogoPath(req.file);
    const [result] = await pool.query(
      'INSERT INTO categorias (categoria, logo) VALUES (?, ?)',
      [categoria, logo]
    );

    res.status(201).json({
      data: { id: result.insertId, categoria, logo },
      message: 'Categoría creada',
    });
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const categoria = normalizeCategoryValue(req.body.categoria);
    if (!categoria) return res.status(400).json({ error: 'categoria es requerida' });

    const [[current]] = await pool.query('SELECT logo FROM categorias WHERE id = ?', [req.params.id]);
    if (!current) return res.status(404).json({ error: 'Categoría no encontrada' });

    const logo = req.file ? toPublicLogoPath(req.file) : current.logo;
    const [result] = await pool.query(
      'UPDATE categorias SET categoria=?, logo=? WHERE id=?',
      [categoria, logo || '', req.params.id]
    );

    if (!result.affectedRows) return res.status(404).json({ error: 'Categoría no encontrada' });

    res.json({
      message: 'Categoría actualizada',
      data: { id: req.params.id, categoria, logo },
    });
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    const [result] = await pool.query('DELETE FROM categorias WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Categoría no encontrada' });

    res.json({ message: 'Categoría eliminada' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll, getById, getGallery, uploadGalleryImages, removeGalleryImage, create, update, remove };
