const pool = require('../config/db');

const championshipSelect = `
  SELECT c.id, c.temporada, c.anio, c.reglamento,
         cat.id AS idcategoria, cat.categoria, cat.logo AS categoria_logo,
         MIN(cal.fecha) AS primera_fecha,
         MAX(cal.fecha) AS ultima_fecha,
         COUNT(cal.ronda) AS rondas,
         CASE
           WHEN MIN(cal.fecha) IS NULL THEN 'upcoming'
           WHEN NOW() < MIN(cal.fecha) THEN 'upcoming'
           WHEN NOW() > MAX(cal.fecha) THEN 'completed'
           ELSE 'active'
         END AS status,
         campeon.nombre AS campeon_nombre
  FROM campeonatos c
  JOIN categorias cat ON c.idcategoria = cat.id
  LEFT JOIN calendario cal ON cal.idcampeonato = c.id
  LEFT JOIN tablas tabla_campeon ON tabla_campeon.idcampeonato = c.id AND tabla_campeon.campeon = 1
  LEFT JOIN pilotos campeon ON campeon.id = tabla_campeon.idpiloto
`;

const getAll = async (req, res, next) => {
  try {
    const { status } = req.query;
    const having = status ? ' HAVING status = ?' : '';
    const params = status ? [status] : [];
    const [rows] = await pool.query(
      `${championshipSelect}
       GROUP BY c.id, cat.id, campeon.id
       ${having}
       ORDER BY c.anio DESC, c.temporada DESC`,
      params
    );

    res.json({ data: rows, total: rows.length });
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const [[row]] = await pool.query(
      `${championshipSelect}
       WHERE c.id = ?
       GROUP BY c.id, cat.id, campeon.id`,
      [req.params.id]
    );

    if (!row) return res.status(404).json({ error: 'Campeonato no encontrado' });
    res.json({ data: row });
  } catch (err) {
    next(err);
  }
};

const getStandings = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT t.posicion, t.puntos, t.victorias, t.apercibimientos,
              t.expulsado, t.campeon,
              p.id AS idpiloto, p.nombre, p.localidad
       FROM tablas t
       JOIN pilotos p ON t.idpiloto = p.id
       WHERE t.idcampeonato = ?
       ORDER BY t.posicion ASC`,
      [req.params.id]
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
};

const getCalendar = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT cal.ronda, cal.fecha, cal.especial, cal.especialidad, cal.coronacion,
              CASE WHEN cal.fecha >= NOW() THEN 'upcoming' ELSE 'completed' END AS status,
              ci.id AS idcircuito, ci.nombre AS circuito,
              ci.localidad, ci.provincia, ci.pais, ci.imagen
       FROM calendario cal
       JOIN circuitos ci ON cal.idcircuito = ci.id
       WHERE cal.idcampeonato = ?
       ORDER BY cal.ronda ASC`,
      [req.params.id]
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
};

const getPrizes = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT posicion, efectivo, inscripcion, trofeo
       FROM premios
       WHERE idcampeonato = ?
       ORDER BY posicion ASC`,
      [req.params.id]
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
};

const getEnrolled = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT i.numero, i.pago,
              p.id AS idpiloto, p.nombre, p.localidad, p.telefono,
              a.id AS idauto, a.marca, a.modelo, a.logo AS auto_logo
       FROM inscriptos i
       JOIN pilotos p ON i.idpiloto = p.id
       JOIN autos a ON i.idauto = a.id
       WHERE i.idcampeonato = ?
       ORDER BY i.numero ASC`,
      [req.params.id]
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const { idcategoria, temporada, anio, reglamento } = req.body;
    if (!idcategoria || !temporada || !anio) {
      return res.status(400).json({ error: 'idcategoria, temporada y anio son requeridos' });
    }

    const [result] = await pool.query(
      'INSERT INTO campeonatos (idcategoria, temporada, anio, reglamento) VALUES (?, ?, ?, ?)',
      [idcategoria, temporada, anio, reglamento || '']
    );

    res.status(201).json({ data: { id: result.insertId, ...req.body }, message: 'Campeonato creado' });
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const { idcategoria, temporada, anio, reglamento } = req.body;
    const [result] = await pool.query(
      'UPDATE campeonatos SET idcategoria=?, temporada=?, anio=?, reglamento=? WHERE id=?',
      [idcategoria, temporada, anio, reglamento, req.params.id]
    );

    if (!result.affectedRows) return res.status(404).json({ error: 'Campeonato no encontrado' });
    res.json({ message: 'Campeonato actualizado', data: { id: req.params.id, ...req.body } });
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    const [result] = await pool.query('DELETE FROM campeonatos WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Campeonato no encontrado' });
    res.json({ message: 'Campeonato eliminado' });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAll,
  getById,
  getStandings,
  getCalendar,
  getPrizes,
  getEnrolled,
  create,
  update,
  remove,
};
