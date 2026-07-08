const pool = require('../config/db');

// ── GET /api/circuitos ────────────────────────────────────────────────────────
const getAll = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, nombre, localidad, provincia, pais, imagen FROM circuitos ORDER BY nombre ASC'
    );
    res.json({ data: rows, total: rows.length });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/circuitos/:id ────────────────────────────────────────────────────
const getById = async (req, res, next) => {
  try {
    const [[row]] = await pool.query('SELECT * FROM circuitos WHERE id = ?', [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Circuito no encontrado' });
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/circuitos ───────────────────────────────────────────────────────
const create = async (req, res, next) => {
  try {
    const { nombre, localidad, provincia, pais, imagen } = req.body;
    if (!nombre) return res.status(400).json({ error: 'nombre es requerido' });
    const [result] = await pool.query(
      'INSERT INTO circuitos (nombre, localidad, provincia, pais, imagen) VALUES (?, ?, ?, ?, ?)',
      [nombre, localidad || '', provincia || '', pais || '', imagen || '']
    );
    res.status(201).json({ data: { id: result.insertId, ...req.body }, message: 'Circuito creado' });
  } catch (err) {
    next(err);
  }
};

// ── PUT /api/circuitos/:id ────────────────────────────────────────────────────
const update = async (req, res, next) => {
  try {
    const { nombre, localidad, provincia, pais, imagen } = req.body;
    const [result] = await pool.query(
      'UPDATE circuitos SET nombre=?, localidad=?, provincia=?, pais=?, imagen=? WHERE id=?',
      [nombre, localidad, provincia, pais, imagen, req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Circuito no encontrado' });
    res.json({ message: 'Circuito actualizado', data: { id: req.params.id, ...req.body } });
  } catch (err) {
    next(err);
  }
};

// ── DELETE /api/circuitos/:id ─────────────────────────────────────────────────
const remove = async (req, res, next) => {
  try {
    const [result] = await pool.query('DELETE FROM circuitos WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Circuito no encontrado' });
    res.json({ message: 'Circuito eliminado' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll, getById, create, update, remove };
