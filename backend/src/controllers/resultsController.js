const pool = require('../config/db');

const RESULT_FIELDS = [
  'idcampeonato',
  'fecha',
  'ronda',
  'idcircuito',
  'idpiloto',
  'presentismo',
  'pos_qualy_sprint',
  'pts_qualy_sprint',
  'pos_sprint',
  'pts_sprint',
  'rec_tiempo_sprint',
  'rec_pos_sprint',
  'aps_sprint',
  'kg_sprint',
  'kg_sancion_sprint',
  'desc_sancion_sprint',
  'pos_qualy_final',
  'pts_qualy_final',
  'pos_final',
  'pts_final',
  'rec_tiempo_final',
  'rec_pos_final',
  'aps_final',
  'kg_final',
  'kg_sancion_final',
  'desc_sancion_final',
];

const TEXT_FIELDS = new Set([
  'pos_qualy_sprint',
  'pos_sprint',
  'desc_sancion_sprint',
  'pos_qualy_final',
  'pos_final',
  'desc_sancion_final',
]);
const DECIMAL_FIELDS = new Set(['pts_sprint', 'pts_final']);

const normalizeValue = (field, value) => {
  if (TEXT_FIELDS.has(field)) return String(value ?? '').trim();
  if (field === 'fecha') return value;
  const normalizedValue = DECIMAL_FIELDS.has(field)
    ? String(value ?? 0).replace(',', '.')
    : value;
  const number = Number(normalizedValue ?? 0);
  return Number.isFinite(number) ? number : 0;
};

const getAll = async (req, res, next) => {
  try {
    const { idcampeonato, ronda } = req.query;
    let query = `
      SELECT r.*,
             p.nombre AS piloto, p.localidad, p.provincia AS piloto_provincia,
             ci.nombre AS circuito, ci.variante,
             ci.localidad AS circuito_localidad, ci.provincia AS circuito_provincia
      FROM resultados r
      JOIN pilotos p ON r.idpiloto = p.id
      JOIN circuitos ci ON r.idcircuito = ci.id
    `;
    const params = [];
    const conditions = [];

    if (idcampeonato) {
      conditions.push('r.idcampeonato = ?');
      params.push(idcampeonato);
    }
    if (ronda) {
      conditions.push('r.ronda = ?');
      params.push(ronda);
    }
    if (conditions.length) query += ` WHERE ${conditions.join(' AND ')}`;
    query += ' ORDER BY r.ronda ASC, p.nombre ASC';

    const [rows] = await pool.query(query, params);
    res.json({ data: rows, total: rows.length });
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const [[row]] = await pool.query(
      `SELECT r.*, p.nombre AS piloto, ci.nombre AS circuito, ci.variante
       FROM resultados r
       JOIN pilotos p ON r.idpiloto = p.id
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

const create = async (req, res, next) => {
  try {
    const required = ['idcampeonato', 'fecha', 'ronda', 'idcircuito', 'idpiloto'];
    if (required.some(field => !req.body[field])) {
      return res.status(400).json({ error: 'Faltan datos del campeonato, fecha, ronda, circuito o piloto' });
    }

    const values = RESULT_FIELDS.map(field => normalizeValue(field, req.body[field]));
    const placeholders = RESULT_FIELDS.map(() => '?').join(', ');
    const [result] = await pool.query(
      `INSERT INTO resultados (${RESULT_FIELDS.join(', ')}) VALUES (${placeholders})`,
      values
    );
    res.status(201).json({
      data: { id: result.insertId, ...req.body },
      message: 'Resultado registrado',
    });
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const fields = RESULT_FIELDS.filter(field =>
      Object.prototype.hasOwnProperty.call(req.body, field)
    );
    if (!fields.length) {
      return res.status(400).json({ error: 'No hay campos válidos para actualizar' });
    }

    const assignments = fields.map(field => `${field} = ?`).join(', ');
    const values = fields.map(field => normalizeValue(field, req.body[field]));
    const [result] = await pool.query(
      `UPDATE resultados SET ${assignments} WHERE id = ?`,
      [...values, req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Resultado no encontrado' });
    res.json({ message: 'Resultado actualizado', data: { id: req.params.id, ...req.body } });
  } catch (err) {
    next(err);
  }
};

const saveBulk = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const changes = Array.isArray(req.body.changes) ? req.body.changes : [];
    if (!changes.length) {
      return res.status(400).json({ error: 'No hay cambios para guardar' });
    }

    await connection.beginTransaction();

    for (const change of changes) {
      const data = change?.data || {};
      if (change.id) {
        const fields = RESULT_FIELDS.filter(field =>
          Object.prototype.hasOwnProperty.call(data, field)
        );
        if (!fields.length) continue;

        const assignments = fields.map(field => `${field} = ?`).join(', ');
        const values = fields.map(field => normalizeValue(field, data[field]));
        const [result] = await connection.query(
          `UPDATE resultados SET ${assignments} WHERE id = ?`,
          [...values, change.id]
        );
        if (!result.affectedRows) {
          const error = new Error(`No se encontró el resultado ${change.id}`);
          error.statusCode = 404;
          throw error;
        }
        continue;
      }

      const required = ['idcampeonato', 'fecha', 'ronda', 'idcircuito', 'idpiloto'];
      if (required.some(field => !data[field])) {
        const error = new Error('Un resultado nuevo no tiene todos los datos de fecha y piloto');
        error.statusCode = 400;
        throw error;
      }

      const values = RESULT_FIELDS.map(field => normalizeValue(field, data[field]));
      const placeholders = RESULT_FIELDS.map(() => '?').join(', ');
      await connection.query(
        `INSERT INTO resultados (${RESULT_FIELDS.join(', ')}) VALUES (${placeholders})`,
        values
      );
    }

    await connection.commit();
    res.json({ message: 'Resultados actualizados', total: changes.length });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
};

const remove = async (req, res, next) => {
  try {
    const [result] = await pool.query('DELETE FROM resultados WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Resultado no encontrado' });
    res.json({ message: 'Resultado eliminado' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll, getById, create, update, saveBulk, remove };
