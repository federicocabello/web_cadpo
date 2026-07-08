const pool = require('../config/db');

// ── GET /api/autos ────────────────────────────────────────────────────────────
const getAll = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, marca, modelo, logo FROM autos ORDER BY marca ASC, modelo ASC'
    );
    res.json({ data: rows, total: rows.length });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/autos/:id ────────────────────────────────────────────────────────
const getById = async (req, res, next) => {
  try {
    const [[row]] = await pool.query('SELECT * FROM autos WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Auto no encontrado' });
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/autos ───────────────────────────────────────────────────────────
const create = async (req, res, next) => {
  try {
    const { marca, modelo, logo } = req.body;
    if (!marca || !modelo) return res.status(400).json({ error: 'marca y modelo son requeridos' });
    const [result] = await pool.query(
      'INSERT INTO autos (marca, modelo, logo) VALUES (?, ?, ?)',
      [marca, modelo, logo || '']
    );
    res.status(201).json({ data: { id: result.insertId, marca, modelo, logo }, message: 'Auto agregado' });
  } catch (err) {
    next(err);
  }
};

// ── PUT /api/autos/:id ────────────────────────────────────────────────────────
const update = async (req, res, next) => {
  try {
    const { marca, modelo, logo } = req.body;
    const [result] = await pool.query(
      'UPDATE autos SET marca=?, modelo=?, logo=? WHERE id=?',
      [marca, modelo, logo, req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Auto no encontrado' });
    res.json({ message: 'Auto actualizado', data: { id: req.params.id, ...req.body } });
  } catch (err) {
    next(err);
  }
};

// ── DELETE /api/autos/:id ─────────────────────────────────────────────────────
const remove = async (req, res, next) => {
  try {
    const [result] = await pool.query('DELETE FROM autos WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Auto no encontrado' });
    res.json({ message: 'Auto eliminado' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll, getById, create, update, remove };
