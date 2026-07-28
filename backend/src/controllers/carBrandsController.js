const fs = require('fs/promises');
const path = require('path');
const pool = require('../config/db');
const publicDir = require('../utils/publicDir');

const capitalizeValue = value =>
  String(value || '')
    .trim()
    .toLocaleLowerCase('es-AR')
    .replace(/(^|\s|-|\/)(\p{L})/gu, (match, separator, letter) => `${separator}${letter.toLocaleUpperCase('es-AR')}`);

const toPublicLogoPath = file => file ? `/media/autos/marcas/${file.filename}` : '';

const deleteLogo = async logo => {
  if (!String(logo || '').startsWith('/media/autos/marcas/')) return;
  const absolutePath = path.resolve(publicDir, String(logo).replace(/^[/\\]+/, ''));
  const logosDir = path.resolve(publicDir, 'media', 'autos', 'marcas');
  if (!absolutePath.startsWith(`${logosDir}${path.sep}`)) return;

  try {
    await fs.unlink(absolutePath);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn(`No se pudo eliminar el logo anterior ${logo}:`, err.message);
    }
  }
};

const getAll = async (req, res, next) => {
  try {
    const [rows] = await pool.query('SELECT id, marca, logo FROM autos_marcas ORDER BY marca ASC');
    res.json({ data: rows, total: rows.length });
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const marca = capitalizeValue(req.body.marca);
    if (!marca) return res.status(400).json({ error: 'La marca es requerida' });
    if (!req.file) return res.status(400).json({ error: 'El logo de la marca es requerido' });

    const logo = toPublicLogoPath(req.file);
    const [result] = await pool.query(
      'INSERT INTO autos_marcas (marca, logo) VALUES (?, ?)',
      [marca, logo]
    );
    res.status(201).json({
      data: { id: result.insertId, marca, logo },
      message: 'Marca creada',
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'La marca ya está cargada' });
    }
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const marca = capitalizeValue(req.body.marca);
    if (!marca) return res.status(400).json({ error: 'La marca es requerida' });

    const [[current]] = await pool.query('SELECT logo FROM autos_marcas WHERE id = ?', [req.params.id]);
    if (!current) return res.status(404).json({ error: 'Marca no encontrada' });

    const logo = req.file ? toPublicLogoPath(req.file) : current.logo;
    await pool.query(
      'UPDATE autos_marcas SET marca=?, logo=? WHERE id=?',
      [marca, logo, req.params.id]
    );
    if (req.file && current.logo !== logo) await deleteLogo(current.logo);
    res.json({
      data: { id: req.params.id, marca, logo },
      message: 'Marca actualizada',
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'La marca ya está cargada' });
    }
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    const [[current]] = await pool.query('SELECT logo FROM autos_marcas WHERE id = ?', [req.params.id]);
    if (!current) return res.status(404).json({ error: 'Marca no encontrada' });

    const [result] = await pool.query('DELETE FROM autos_marcas WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Marca no encontrada' });
    await deleteLogo(current.logo);
    res.json({ message: 'Marca eliminada' });
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({ error: 'No se puede eliminar una marca que tiene autos cargados' });
    }
    next(err);
  }
};

module.exports = { getAll, create, update, remove };
