const pool = require('../config/db');

const toPublicRulesPath = file => {
  if (!file) return '';

  return `/media/campeonatos/reglamentos/${file.filename}`;
};

const normalizeServerUrl = value => {
  const serverUrl = String(value || '').trim();
  if (!serverUrl) return '';

  try {
    const parsed = new URL(serverUrl);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : '';
  } catch {
    return '';
  }
};

const optionalNumber = value => {
  if (value === undefined || value === null || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const championshipPlatforms = new Set([
  'rFactor',
  'Automobilista',
  'ACTC 2Pez',
  'Simulador V3',
  'Assetto Corsa',
]);

const normalizePlatform = value => {
  const platform = String(value || '').trim();
  return championshipPlatforms.has(platform) ? platform : '';
};

const championshipSelect = `
  SELECT c.id, c.temporada, c.anio, c.plataforma, c.reglamento, c.puerto, c.n_server, c.servidor,
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
    const { idcategoria, temporada, anio, puerto, n_server, servidor } = req.body;
    const plataforma = normalizePlatform(req.body.plataforma);
    if (!idcategoria || !temporada || !anio || !plataforma) {
      return res.status(400).json({ error: 'Categoría, temporada, año y plataforma son requeridos' });
    }

    const reglamento = toPublicRulesPath(req.file);
    const [result] = await pool.query(
      'INSERT INTO campeonatos (idcategoria, temporada, anio, plataforma, reglamento, puerto, n_server, servidor) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [idcategoria, temporada, anio, plataforma, reglamento, optionalNumber(puerto), optionalNumber(n_server), normalizeServerUrl(servidor)]
    );

    res.status(201).json({ data: { id: result.insertId, idcategoria, temporada, anio, plataforma, reglamento, puerto, n_server, servidor }, message: 'Campeonato creado' });
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const { idcategoria, temporada, anio, puerto, n_server, servidor } = req.body;
    const plataforma = normalizePlatform(req.body.plataforma);
    if (!idcategoria || !temporada || !anio || !plataforma) {
      return res.status(400).json({ error: 'Categoría, temporada, año y plataforma son requeridos' });
    }

    const [[current]] = await pool.query('SELECT reglamento FROM campeonatos WHERE id = ?', [req.params.id]);
    if (!current) return res.status(404).json({ error: 'Campeonato no encontrado' });

    const reglamento = req.file ? toPublicRulesPath(req.file) : current.reglamento;
    const [result] = await pool.query(
      'UPDATE campeonatos SET idcategoria=?, temporada=?, anio=?, plataforma=?, reglamento=?, puerto=?, n_server=?, servidor=? WHERE id=?',
      [idcategoria, temporada, anio, plataforma, reglamento || '', optionalNumber(puerto), optionalNumber(n_server), normalizeServerUrl(servidor), req.params.id]
    );

    if (!result.affectedRows) return res.status(404).json({ error: 'Campeonato no encontrado' });
    res.json({ message: 'Campeonato actualizado', data: { id: req.params.id, idcategoria, temporada, anio, plataforma, reglamento, puerto, n_server, servidor } });
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
