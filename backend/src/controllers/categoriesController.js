const pool = require('../config/db');

const toPublicLogoPath = file => {
  if (!file) return '';

  return `/media/categorias/logos/${file.filename}`;
};

const capitalizeValue = value =>
  String(value || '')
    .trim()
    .toLocaleLowerCase('es-AR')
    .replace(/(^|\s|-|\/)(\p{L})/gu, (match, separator, letter) => `${separator}${letter.toLocaleUpperCase('es-AR')}`);

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

const create = async (req, res, next) => {
  try {
    const categoria = capitalizeValue(req.body.categoria);
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
    const categoria = capitalizeValue(req.body.categoria);
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

module.exports = { getAll, getById, create, update, remove };
