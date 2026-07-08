const pool = require('../config/db');

// ── GET /api/resultados?idcampeonato=X&ronda=Y ────────────────────────────────
const getAll = async (req, res, next) => {
  try {
    const { idcampeonato, ronda } = req.query;
    let query = `
      SELECT r.id, r.ronda, r.fecha, r.posicion, r.dq,
             r.apercibimientos, r.recargo_tiempo, r.recargo_posiciones,
             r.idcampeonato,
             p.id AS idpiloto, p.nombre AS piloto, p.localidad,
             ci.id AS idcircuito, ci.nombre AS circuito,
             ci.localidad AS circuito_localidad, ci.provincia
      FROM resultados r
      JOIN pilotos p   ON r.idpiloto   = p.id
      JOIN circuitos ci ON r.idcircuito = ci.id
    `;
    const params = [];
    const conditions = [];

    if (idcampeonato) { conditions.push('r.idcampeonato = ?'); params.push(idcampeonato); }
    if (ronda)        { conditions.push('r.ronda = ?');        params.push(ronda); }
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY r.ronda ASC, r.posicion ASC';

    const [rows] = await pool.query(query, params);
    res.json({ data: rows, total: rows.length });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/resultados/:id ───────────────────────────────────────────────────
const getById = async (req, res, next) => {
  try {
    const [[row]] = await pool.query(
      `SELECT r.*, p.nombre AS piloto, ci.nombre AS circuito
       FROM resultados r
       JOIN pilotos p   ON r.idpiloto   = p.id
       JOIN circuitos ci ON r.idcircuito = ci.id
       WHERE r.id = ?`,
      [req.params.id]
    );
    if (!row) return res.status(404).json({ error: 'Resultado no encontrado' });
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/resultados ──────────────────────────────────────────────────────
const create = async (req, res, next) => {
  try {
    const { idcampeonato, fecha, ronda, idcircuito, posicion, idpiloto, dq, apercibimientos, recargo_tiempo, recargo_posiciones } = req.body;
    if (!idcampeonato || !fecha || !ronda || !idcircuito || !posicion || !idpiloto) {
      return res.status(400).json({ error: 'Faltan campos requeridos: idcampeonato, fecha, ronda, idcircuito, posicion, idpiloto' });
    }
    const [result] = await pool.query(
      `INSERT INTO resultados (idcampeonato, fecha, ronda, idcircuito, posicion, idpiloto, dq, apercibimientos, recargo_tiempo, recargo_posiciones)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [idcampeonato, fecha, ronda, idcircuito, posicion, idpiloto,
       dq || 0, apercibimientos || 0, recargo_tiempo || 0, recargo_posiciones || 0]
    );
    res.status(201).json({ data: { id: result.insertId, ...req.body }, message: 'Resultado registrado' });
  } catch (err) {
    next(err);
  }
};

// ── PUT /api/resultados/:id ───────────────────────────────────────────────────
const update = async (req, res, next) => {
  try {
    const { idcampeonato, fecha, ronda, idcircuito, posicion, idpiloto, dq, apercibimientos, recargo_tiempo, recargo_posiciones } = req.body;
    const [result] = await pool.query(
      `UPDATE resultados SET idcampeonato=?, fecha=?, ronda=?, idcircuito=?, posicion=?,
       idpiloto=?, dq=?, apercibimientos=?, recargo_tiempo=?, recargo_posiciones=?
       WHERE id=?`,
      [idcampeonato, fecha, ronda, idcircuito, posicion, idpiloto,
       dq ?? 0, apercibimientos ?? 0, recargo_tiempo ?? 0, recargo_posiciones ?? 0,
       req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Resultado no encontrado' });
    res.json({ message: 'Resultado actualizado', data: { id: req.params.id, ...req.body } });
  } catch (err) {
    next(err);
  }
};

// ── DELETE /api/resultados/:id ────────────────────────────────────────────────
const remove = async (req, res, next) => {
  try {
    const [result] = await pool.query('DELETE FROM resultados WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Resultado no encontrado' });
    res.json({ message: 'Resultado eliminado' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll, getById, create, update, remove };
