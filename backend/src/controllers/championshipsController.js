const pool = require('../config/db');
const ensureResultAchievements = require('../utils/ensureResultAchievements');
const ensureChampionshipWarnings = require('../utils/ensureChampionshipWarnings');
const ensureChampionshipScoring = require('../utils/ensureChampionshipScoring');
const ensureChampionshipDebutBallast = require('../utils/ensureChampionshipDebutBallast');

let percentageRuleColumnPromise;
const ensurePercentageRuleColumn = () => {
  if (!percentageRuleColumnPromise) {
    percentageRuleColumnPromise = (async () => {
      const [columns] = await pool.query("SHOW COLUMNS FROM campeonatos LIKE 'regla_porcentaje'");
      if (!columns.length) {
        try {
          await pool.query('ALTER TABLE campeonatos ADD COLUMN regla_porcentaje DECIMAL(6,3) UNSIGNED NOT NULL DEFAULT 0 AFTER servidor');
        } catch (error) {
          if (error.errno !== 1060) throw error;
        }
      }
    })().catch(error => {
      percentageRuleColumnPromise = null;
      throw error;
    });
  }
  return percentageRuleColumnPromise;
};

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

const normalizePercentageRule = value => {
  const percentage = Number(value || 0);
  if (!Number.isFinite(percentage) || percentage < 0 || (percentage > 0 && percentage < 100) || percentage > 999.999) return null;
  return Math.round(percentage * 1000) / 1000;
};

const scoringFields = ['pts_qualy_sprint', 'pts_sprint', 'pts_qualy_final', 'pts_final'];

const getScoring = async (req, res, next) => {
  try {
    await ensureChampionshipScoring();
    const [rows] = await pool.query(
      `SELECT posicion, pts_qualy_sprint, pts_sprint, pts_qualy_final, pts_final
       FROM campeonato_puntajes WHERE idcampeonato = ? ORDER BY posicion ASC`,
      [req.params.id]
    );
    res.json({ data: rows });
  } catch (error) { next(error); }
};

const saveScoring = async (req, res, next) => {
  const championshipId = Number(req.params.id);
  const submittedRows = Array.isArray(req.body.puntajes) ? req.body.puntajes : [];
  if (!Number.isInteger(championshipId) || championshipId < 1) return res.status(400).json({ error: 'Campeonato inválido' });

  const rows = submittedRows.map(row => ({
    posicion: Number(row.posicion),
    ...Object.fromEntries(scoringFields.map(field => [field, Number(String(row[field] ?? 0).replace(',', '.'))])),
  }));
  if (rows.some(row => !Number.isInteger(row.posicion) || row.posicion < 1 || row.posicion > 999)) {
    return res.status(400).json({ error: 'Cada posición debe ser un número entero entre 1 y 999' });
  }
  if (new Set(rows.map(row => row.posicion)).size !== rows.length) {
    return res.status(400).json({ error: 'No puede repetirse una posición en la escala de puntos' });
  }
  if (rows.some(row => scoringFields.some(field => !Number.isFinite(row[field]) || row[field] < 0))) {
    return res.status(400).json({ error: 'Los puntajes deben ser números iguales o mayores que cero' });
  }

  let connection;
  try {
    await ensureChampionshipScoring();
    const [[championship]] = await pool.query('SELECT id FROM campeonatos WHERE id = ?', [championshipId]);
    if (!championship) return res.status(404).json({ error: 'Campeonato no encontrado' });
    connection = await pool.getConnection();
    await connection.beginTransaction();
    await connection.query('DELETE FROM campeonato_puntajes WHERE idcampeonato = ?', [championshipId]);
    for (const row of rows) {
      await connection.query(
        `INSERT INTO campeonato_puntajes
          (idcampeonato, posicion, pts_qualy_sprint, pts_sprint, pts_qualy_final, pts_final)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [championshipId, row.posicion, row.pts_qualy_sprint, row.pts_sprint, row.pts_qualy_final, row.pts_final]
      );
    }
    await connection.commit();
    const [savedRows] = await pool.query(
      `SELECT posicion, pts_qualy_sprint, pts_sprint, pts_qualy_final, pts_final
       FROM campeonato_puntajes WHERE idcampeonato = ? ORDER BY posicion ASC`,
      [championshipId]
    );
    res.json({ data: savedRows, message: 'Escala de puntajes guardada correctamente' });
  } catch (error) {
    if (connection) await connection.rollback();
    next(error);
  } finally {
    if (connection) connection.release();
  }
};

const getDebutBallasts = async (req, res, next) => {
  try {
    await ensureChampionshipDebutBallast();
    const [rows] = await pool.query(
      `SELECT ld.idpiloto, p.nombre AS piloto, ld.kilos
       FROM campeonato_lastres_debut ld
       JOIN pilotos p ON p.id = ld.idpiloto
       WHERE ld.idcampeonato = ?
       ORDER BY p.nombre ASC`,
      [req.params.id]
    );
    res.json({ data: rows });
  } catch (error) { next(error); }
};

const saveDebutBallasts = async (req, res, next) => {
  const championshipId = Number(req.params.id);
  const submittedRows = Array.isArray(req.body.lastres) ? req.body.lastres : [];
  if (!Number.isInteger(championshipId) || championshipId < 1) return res.status(400).json({ error: 'Campeonato inválido' });
  const rows = submittedRows.map(row => ({ idpiloto: Number(row.idpiloto), kilos: Number(String(row.kilos ?? 0).replace(',', '.')) }));
  if (rows.some(row => !Number.isInteger(row.idpiloto) || row.idpiloto < 1 || !Number.isFinite(row.kilos) || row.kilos < 0)) {
    return res.status(400).json({ error: 'El lastre debut debe ser un número igual o mayor que cero' });
  }
  if (new Set(rows.map(row => row.idpiloto)).size !== rows.length) return res.status(400).json({ error: 'No puede repetirse un piloto' });

  let connection;
  try {
    await ensureChampionshipDebutBallast();
    connection = await pool.getConnection();
    await connection.beginTransaction();
    await connection.query('DELETE FROM campeonato_lastres_debut WHERE idcampeonato = ?', [championshipId]);
    for (const row of rows.filter(item => item.kilos !== 0)) {
      await connection.query(
        'INSERT INTO campeonato_lastres_debut (idcampeonato, idpiloto, kilos) VALUES (?, ?, ?)',
        [championshipId, row.idpiloto, row.kilos]
      );
    }
    await connection.commit();
    const [savedRows] = await pool.query(
      'SELECT idpiloto, kilos FROM campeonato_lastres_debut WHERE idcampeonato = ? ORDER BY idpiloto ASC',
      [championshipId]
    );
    res.json({ data: savedRows, message: 'Lastres debut guardados correctamente' });
  } catch (error) {
    if (connection) await connection.rollback();
    next(error);
  } finally {
    if (connection) connection.release();
  }
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
  SELECT c.id, c.temporada, c.anio, c.plataforma, c.reglamento, c.puerto, c.n_server, c.servidor, c.regla_porcentaje,
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
    await ensurePercentageRuleColumn();
    const { status } = req.query;
    const having = status ? ' HAVING status = ?' : '';
    const params = status ? [status] : [];
    const [rows] = await pool.query(
      `${championshipSelect}
       GROUP BY c.id, cat.id, campeon.id
       ${having}
       ORDER BY COALESCE(MAX(cal.fecha), STR_TO_DATE(CONCAT(c.anio, '-01-01'), '%Y-%m-%d')) DESC,
                c.id DESC`,
      params
    );

    res.json({ data: rows, total: rows.length });
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    await ensurePercentageRuleColumn();
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
              p.id AS idpiloto, p.nombre, p.localidad, p.ig
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

const getLatestActiveStandings = async (req, res, next) => {
  try {
    await ensureResultAchievements();
    const [[championship]] = await pool.query(
      `SELECT c.id, c.temporada, c.anio,
              cat.categoria, cat.logo AS categoria_logo,
              COUNT(DISTINCT r.ronda) AS fechas_cumplidas,
              MAX(r.fecha) AS ultima_fecha_resultado,
              (SELECT MAX(cal.fecha) FROM calendario cal WHERE cal.idcampeonato = c.id) AS ultima_fecha_calendario,
              CASE
                WHEN (SELECT MAX(cal.fecha) FROM calendario cal WHERE cal.idcampeonato = c.id) IS NOT NULL
                  AND NOW() > (SELECT MAX(cal.fecha) FROM calendario cal WHERE cal.idcampeonato = c.id)
                THEN 1
                ELSE 0
              END AS finalizado
       FROM campeonatos c
       JOIN categorias cat ON cat.id = c.idcategoria
       JOIN resultados r ON r.idcampeonato = c.id
       GROUP BY c.id, c.temporada, c.anio, cat.id
       ORDER BY MAX(r.fecha) DESC, c.id DESC
       LIMIT 1`
    );

    if (!championship) return res.json({ data: null });

    const [[champion]] = await pool.query(
      `SELECT p.id AS idpiloto, p.nombre,
              am.marca, am.logo AS auto_logo
       FROM resultados r
       JOIN pilotos p ON p.id = r.idpiloto
       LEFT JOIN inscriptos i
         ON i.idcampeonato = r.idcampeonato AND i.idpiloto = r.idpiloto
       LEFT JOIN autos a ON a.id = i.idauto
       LEFT JOIN autos_marcas am ON am.id = a.marca
       WHERE r.idcampeonato = ? AND r.campeon = 1
       ORDER BY r.id DESC
       LIMIT 1`,
      [championship.id]
    );

    const [standings] = await pool.query(
      `SELECT p.id AS idpiloto, p.nombre,
              am.marca, am.logo AS auto_logo,
              SUM(
                COALESCE(r.presentismo, 0) +
                COALESCE(r.pts_qualy_sprint, 0) +
                COALESCE(r.pts_sprint, 0) +
                COALESCE(r.pts_qualy_final, 0) +
                COALESCE(r.pts_final, 0)
              ) AS puntos
       FROM resultados r
       JOIN pilotos p ON p.id = r.idpiloto
       LEFT JOIN inscriptos i
         ON i.idcampeonato = r.idcampeonato AND i.idpiloto = r.idpiloto
       LEFT JOIN autos a ON a.id = i.idauto
       LEFT JOIN autos_marcas am ON am.id = a.marca
       WHERE r.idcampeonato = ?
       GROUP BY p.id, p.nombre, am.id, am.marca, am.logo
       ORDER BY puntos DESC, p.nombre ASC
       LIMIT 12`,
      [championship.id]
    );

    res.json({
      data: {
        ...championship,
        campeon: champion || null,
        standings: standings.map((standing, index) => ({
          ...standing,
          posicion: index + 1,
          puntos: Number(standing.puntos || 0),
        })),
      },
    });
  } catch (err) {
    next(err);
  }
};

const getWarnings = async (req, res, next) => {
  try {
    await Promise.all([ensureResultAchievements(), ensureChampionshipWarnings()]);
    const championshipId = Number(req.params.id);
    if (!Number.isInteger(championshipId) || championshipId < 1) {
      return res.status(400).json({ error: 'Campeonato inválido' });
    }

    const [[championship]] = await pool.query('SELECT id FROM campeonatos WHERE id = ? LIMIT 1', [championshipId]);
    if (!championship) return res.status(404).json({ error: 'Campeonato no encontrado' });

    const [levels] = await pool.query(
      'SELECT cantidad, sancion FROM campeonato_apercibimientos WHERE idcampeonato = ? ORDER BY cantidad ASC',
      [championshipId]
    );
    const [drivers] = await pool.query(
      `SELECT p.id AS idpiloto, p.nombre,
              SUM(COALESCE(r.aps_sprint, 0) + COALESCE(r.aps_final, 0)) AS apercibimientos
       FROM resultados r
       JOIN pilotos p ON p.id = r.idpiloto
       WHERE r.idcampeonato = ?
       GROUP BY p.id, p.nombre
       HAVING apercibimientos > 0
       ORDER BY apercibimientos DESC, p.nombre ASC`,
      [championshipId]
    );
    const [fulfillments] = await pool.query(
      `SELECT idpiloto, cantidad, cumplida
       FROM campeonato_apercibimientos_cumplimientos
       WHERE idcampeonato = ?`,
      [championshipId]
    );
    const fulfillmentByDriverAndLevel = new Map(fulfillments.map(item => [
      `${item.idpiloto}:${item.cantidad}`,
      Boolean(Number(item.cumplida)),
    ]));

    res.json({
      data: {
        niveles: levels,
        pilotos: drivers.map(driver => {
          const warnings = Number(driver.apercibimientos || 0);
          return {
            ...driver,
            apercibimientos: warnings,
            sanciones_alcanzadas: levels
              .filter(level => Number(level.cantidad) <= warnings)
              .map(level => ({
                cantidad: Number(level.cantidad),
                sancion: level.sancion,
                cumplida: fulfillmentByDriverAndLevel.get(`${driver.idpiloto}:${level.cantidad}`) || false,
              })),
          };
        }),
      },
    });
  } catch (error) {
    next(error);
  }
};

const saveWarnings = async (req, res, next) => {
  const championshipId = Number(req.params.id);
  const submittedLevels = Array.isArray(req.body.niveles) ? req.body.niveles : [];
  const levels = submittedLevels.map(level => ({
    cantidad: Number(level.cantidad),
    sancion: String(level.sancion || '').trim(),
  }));

  if (!Number.isInteger(championshipId) || championshipId < 1) {
    return res.status(400).json({ error: 'Campeonato inválido' });
  }
  if (levels.length > 100) return res.status(400).json({ error: 'No se pueden cargar más de 100 niveles de apercibimientos' });
  if (levels.some(level => !Number.isInteger(level.cantidad) || level.cantidad < 1 || level.cantidad > 65535)) {
    return res.status(400).json({ error: 'Cada cantidad de apercibimientos debe ser un número entero mayor que cero' });
  }
  if (levels.some(level => !level.sancion || level.sancion.length > 500)) {
    return res.status(400).json({ error: 'Cada nivel debe tener una sanción de hasta 500 caracteres' });
  }
  if (new Set(levels.map(level => level.cantidad)).size !== levels.length) {
    return res.status(400).json({ error: 'No puede repetirse una cantidad de apercibimientos' });
  }

  const connection = await pool.getConnection();
  try {
    await ensureChampionshipWarnings();
    await connection.beginTransaction();
    const [[championship]] = await connection.query('SELECT id FROM campeonatos WHERE id = ? FOR UPDATE', [championshipId]);
    if (!championship) {
      await connection.rollback();
      return res.status(404).json({ error: 'Campeonato no encontrado' });
    }
    await connection.query('DELETE FROM campeonato_apercibimientos WHERE idcampeonato = ?', [championshipId]);
    if (levels.length) {
      const orderedLevels = [...levels].sort((a, b) => a.cantidad - b.cantidad);
      await connection.query(
        'INSERT INTO campeonato_apercibimientos (idcampeonato, cantidad, sancion) VALUES ?',
        [orderedLevels.map(level => [championshipId, level.cantidad, level.sancion])]
      );
      await connection.query(
        'DELETE FROM campeonato_apercibimientos_cumplimientos WHERE idcampeonato = ? AND cantidad NOT IN (?)',
        [championshipId, orderedLevels.map(level => level.cantidad)]
      );
    } else {
      await connection.query('DELETE FROM campeonato_apercibimientos_cumplimientos WHERE idcampeonato = ?', [championshipId]);
    }
    await connection.commit();
    const [rows] = await pool.query(
      'SELECT cantidad, sancion FROM campeonato_apercibimientos WHERE idcampeonato = ? ORDER BY cantidad ASC',
      [championshipId]
    );
    res.json({ data: rows, message: 'Escala de apercibimientos guardada correctamente' });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

const setWarningFulfillment = async (req, res, next) => {
  try {
    await ensureChampionshipWarnings();
    const championshipId = Number(req.params.id);
    const driverId = Number(req.body.idpiloto);
    const amount = Number(req.body.cantidad);
    const completed = req.body.cumplida === true || req.body.cumplida === 1 || req.body.cumplida === '1' ? 1 : 0;
    if (!Number.isInteger(championshipId) || championshipId < 1 || !Number.isInteger(driverId) || driverId < 1 || !Number.isInteger(amount) || amount < 1) {
      return res.status(400).json({ error: 'Datos de la sanción inválidos' });
    }

    const [[reached]] = await pool.query(
      `SELECT ca.cantidad
       FROM campeonato_apercibimientos ca
       JOIN (
         SELECT idpiloto, SUM(COALESCE(aps_sprint, 0) + COALESCE(aps_final, 0)) AS total
         FROM resultados
         WHERE idcampeonato = ? AND idpiloto = ?
         GROUP BY idpiloto
       ) acumulado ON acumulado.total >= ca.cantidad
       WHERE ca.idcampeonato = ? AND ca.cantidad = ?
       LIMIT 1`,
      [championshipId, driverId, championshipId, amount]
    );
    if (!reached) return res.status(400).json({ error: 'El piloto todavía no alcanzó ese nivel de apercibimientos' });

    await pool.query(
      `INSERT INTO campeonato_apercibimientos_cumplimientos
         (idcampeonato, idpiloto, cantidad, cumplida)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE cumplida = VALUES(cumplida), actualizado_en = CURRENT_TIMESTAMP`,
      [championshipId, driverId, amount, completed]
    );
    res.json({ data: { idcampeonato: championshipId, idpiloto: driverId, cantidad: amount, cumplida: Boolean(completed) }, message: completed ? 'Sanción marcada como cumplida' : 'Sanción marcada como pendiente' });
  } catch (error) {
    next(error);
  }
};

const savePrizes = async (req, res, next) => {
  const championshipId = Number(req.params.id);
  const submittedPrizes = Array.isArray(req.body.premios) ? req.body.premios : [];
  const normalizeBoolean = value => value === true || value === 1 || value === '1';
  const prizes = submittedPrizes.map(prize => ({
    posicion: Number(prize.posicion),
    efectivo: normalizeBoolean(prize.efectivo) ? 1 : 0,
    inscripcion: normalizeBoolean(prize.inscripcion) ? 1 : 0,
    trofeo: normalizeBoolean(prize.trofeo) ? 1 : 0,
  }));

  if (!Number.isInteger(championshipId) || championshipId < 1) {
    return res.status(400).json({ error: 'Campeonato inválido' });
  }
  if (prizes.length > 127) return res.status(400).json({ error: 'No se pueden cargar más de 127 posiciones premiadas' });
  if (prizes.some(prize => !Number.isInteger(prize.posicion) || prize.posicion < 1 || prize.posicion > 127)) {
    return res.status(400).json({ error: 'Cada posición premiada debe estar entre 1 y 127' });
  }
  if (new Set(prizes.map(prize => prize.posicion)).size !== prizes.length) {
    return res.status(400).json({ error: 'No puede repetirse una posición en los premios' });
  }
  if (prizes.some(prize => !prize.efectivo && !prize.inscripcion && !prize.trofeo)) {
    return res.status(400).json({ error: 'Seleccioná al menos un premio para cada posición' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [[championship]] = await connection.query('SELECT id FROM campeonatos WHERE id = ? FOR UPDATE', [championshipId]);
    if (!championship) {
      await connection.rollback();
      return res.status(404).json({ error: 'Campeonato no encontrado' });
    }
    await connection.query('DELETE FROM premios WHERE idcampeonato = ?', [championshipId]);
    if (prizes.length) {
      await connection.query(
        'INSERT INTO premios (idcampeonato, posicion, efectivo, inscripcion, trofeo) VALUES ?',
        [prizes.sort((a, b) => a.posicion - b.posicion).map(prize => [championshipId, prize.posicion, prize.efectivo, prize.inscripcion, prize.trofeo])]
      );
    }
    await connection.commit();
    const [rows] = await pool.query(
      'SELECT posicion, efectivo, inscripcion, trofeo FROM premios WHERE idcampeonato = ? ORDER BY posicion ASC',
      [championshipId]
    );
    res.json({ data: rows, message: 'Premios guardados correctamente' });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

const getEnrolled = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT i.numero, i.pago,
              p.id AS idpiloto, p.nombre, p.localidad, p.telefono, p.ig,
              a.id AS idauto, am.marca, a.modelo, am.logo AS auto_logo
       FROM inscriptos i
       JOIN pilotos p ON i.idpiloto = p.id
       JOIN autos a ON i.idauto = a.id
       JOIN autos_marcas am ON a.marca = am.id
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
    await ensurePercentageRuleColumn();
    const { idcategoria, temporada, anio, puerto, n_server, servidor } = req.body;
    const plataforma = normalizePlatform(req.body.plataforma);
    const parsedAnio = Number(anio);
    const percentageRule = normalizePercentageRule(req.body.regla_porcentaje);
    if (!idcategoria || !temporada || !parsedAnio || !plataforma) {
      return res.status(400).json({ error: 'Categoría, temporada, año y plataforma son requeridos' });
    }
    if (percentageRule === null) return res.status(400).json({ error: 'La regla debe ser 0 para desactivarla o un porcentaje igual o mayor a 100' });

    const reglamento = toPublicRulesPath(req.file);
    const [result] = await pool.query(
      'INSERT INTO campeonatos (idcategoria, temporada, anio, plataforma, reglamento, puerto, n_server, servidor, regla_porcentaje) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [idcategoria, temporada, parsedAnio, plataforma, reglamento, optionalNumber(puerto), optionalNumber(n_server), normalizeServerUrl(servidor), percentageRule]
    );

    res.status(201).json({ data: { id: result.insertId, idcategoria, temporada, anio: parsedAnio, plataforma, reglamento, puerto, n_server, servidor, regla_porcentaje: percentageRule }, message: 'Campeonato creado' });
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    await ensurePercentageRuleColumn();
    const { idcategoria, temporada, anio, puerto, n_server, servidor } = req.body;
    const plataforma = normalizePlatform(req.body.plataforma);
    const parsedAnio = Number(anio);
    const percentageRule = normalizePercentageRule(req.body.regla_porcentaje);
    if (!idcategoria || !temporada || !parsedAnio || !plataforma) {
      return res.status(400).json({ error: 'Categoría, temporada, año y plataforma son requeridos' });
    }
    if (percentageRule === null) return res.status(400).json({ error: 'La regla debe ser 0 para desactivarla o un porcentaje igual o mayor a 100' });

    const [[current]] = await pool.query('SELECT reglamento FROM campeonatos WHERE id = ?', [req.params.id]);
    if (!current) return res.status(404).json({ error: 'Campeonato no encontrado' });

    const reglamento = req.file ? toPublicRulesPath(req.file) : current.reglamento;
    const [result] = await pool.query(
      'UPDATE campeonatos SET idcategoria=?, temporada=?, anio=?, plataforma=?, reglamento=?, puerto=?, n_server=?, servidor=?, regla_porcentaje=? WHERE id=?',
      [idcategoria, temporada, parsedAnio, plataforma, reglamento || '', optionalNumber(puerto), optionalNumber(n_server), normalizeServerUrl(servidor), percentageRule, req.params.id]
    );

    if (!result.affectedRows) return res.status(404).json({ error: 'Campeonato no encontrado' });
    res.json({ message: 'Campeonato actualizado', data: { id: req.params.id, idcategoria, temporada, anio: parsedAnio, plataforma, reglamento, puerto, n_server, servidor, regla_porcentaje: percentageRule } });
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
  getLatestActiveStandings,
  getCalendar,
  getPrizes,
  savePrizes,
  getScoring,
  saveScoring,
  getDebutBallasts,
  saveDebutBallasts,
  getWarnings,
  saveWarnings,
  setWarningFulfillment,
  getEnrolled,
  create,
  update,
  remove,
};
