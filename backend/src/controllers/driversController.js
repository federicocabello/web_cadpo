const pool = require('../config/db');

// ── GET /api/pilotos ──────────────────────────────────────────────────────────
const getAll = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.id, p.nombre, p.localidad, p.telefono,
              COUNT(DISTINCT i.idcampeonato) AS campeonatos_disputados
       FROM pilotos p
       LEFT JOIN inscriptos i ON p.id = i.idpiloto
       GROUP BY p.id
       ORDER BY p.nombre ASC`
    );
    res.json({ data: rows, total: rows.length });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/pilotos/:id ──────────────────────────────────────────────────────
const getById = async (req, res, next) => {
  try {
    // Datos del piloto
    const [[piloto]] = await pool.query(
      'SELECT id, nombre, localidad, telefono FROM pilotos WHERE id = ?',
      [req.params.id]
    );
    if (!piloto) return res.status(404).json({ error: 'Piloto no encontrado' });

    // Historial de campeonatos
    const [historial] = await pool.query(
      `SELECT c.id AS idcampeonato, c.temporada, c.anio,
              cat.categoria,
              a.marca, a.modelo, a.logo AS auto_logo,
              i.numero, i.pago,
              t.posicion, t.puntos, t.victorias, t.apercibimientos,
              t.campeon, t.expulsado
       FROM inscriptos i
       JOIN campeonatos c  ON i.idcampeonato = c.id
       JOIN categorias cat ON c.idcategoria  = cat.id
       JOIN autos a        ON i.idauto       = a.id
       LEFT JOIN tablas t  ON t.idcampeonato = i.idcampeonato AND t.idpiloto = i.idpiloto
       WHERE i.idpiloto = ?
       ORDER BY c.anio DESC, c.temporada DESC`,
      [req.params.id]
    );

    res.json({ data: { ...piloto, historial } });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/pilotos ─────────────────────────────────────────────────────────
const create = async (req, res, next) => {
  try {
    const { nombre, localidad, telefono } = req.body;
    if (!nombre || !telefono) {
      return res.status(400).json({ error: 'nombre y telefono son requeridos' });
    }
    const [result] = await pool.query(
      'INSERT INTO pilotos (nombre, localidad, telefono) VALUES (?, ?, ?)',
      [nombre, localidad || '', telefono]
    );
    res.status(201).json({ data: { id: result.insertId, nombre, localidad, telefono }, message: 'Piloto registrado' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya existe un piloto con ese teléfono' });
    }
    next(err);
  }
};

// ── PUT /api/pilotos/:id ──────────────────────────────────────────────────────
const update = async (req, res, next) => {
  try {
    const { nombre, localidad, telefono } = req.body;
    const [result] = await pool.query(
      'UPDATE pilotos SET nombre=?, localidad=?, telefono=? WHERE id=?',
      [nombre, localidad, telefono, req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Piloto no encontrado' });
    res.json({ message: 'Piloto actualizado', data: { id: req.params.id, ...req.body } });
  } catch (err) {
    next(err);
  }
};

// ── DELETE /api/pilotos/:id ───────────────────────────────────────────────────
const remove = async (req, res, next) => {
  try {
    const [result] = await pool.query('DELETE FROM pilotos WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Piloto no encontrado' });
    res.json({ message: 'Piloto eliminado' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll, getById, create, update, remove };
