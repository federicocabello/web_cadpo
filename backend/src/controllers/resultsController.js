const pool = require('../config/db');
const ensureResultAchievements = require('../utils/ensureResultAchievements');
const fs = require('fs/promises');
const path = require('path');
const publicDir = require('../utils/publicDir');
const ensureChampionshipExclusions = require('../utils/ensureChampionshipExclusions');

let appealsSchemaPromise;
const APPEAL_SESSIONS = new Set(['qualy_sprint', 'sprint', 'qualy_final', 'final']);

const ensureAppealsSchema = () => {
  if (!appealsSchemaPromise) {
    appealsSchemaPromise = pool.query(`CREATE TABLE IF NOT EXISTS resultado_apelaciones (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      idcampeonato INT NOT NULL,
      ronda SMALLINT UNSIGNED NOT NULL,
      tanda VARCHAR(30) NOT NULL,
      idpiloto INT NOT NULL,
      motivo TEXT NOT NULL,
      video VARCHAR(500) NULL,
      video_nombre VARCHAR(255) NULL,
      creado TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      actualizado TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_resultado_apelaciones_fecha (idcampeonato, ronda, tanda),
      KEY idx_resultado_apelaciones_piloto (idpiloto)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`).catch(error => {
      appealsSchemaPromise = null;
      throw error;
    });
  }
  return appealsSchemaPromise;
};

const appealVideoPath = file => file ? `/media/resultados/apelaciones/${file.filename}` : null;
const removeAppealVideo = async mediaPath => {
  const relativePath = String(mediaPath || '').replace(/^[/\\]+/, '');
  const absolutePath = path.resolve(publicDir, relativePath);
  const videosDir = path.resolve(publicDir, 'media', 'resultados', 'apelaciones');
  if (!absolutePath.startsWith(`${videosDir}${path.sep}`)) return;
  await fs.unlink(absolutePath).catch(error => {
    if (error.code !== 'ENOENT') throw error;
  });
};

const validateAppealData = async ({ championshipId, round, driverId, session, reason }) => {
  if (!Number.isInteger(championshipId) || championshipId < 1 || !Number.isInteger(round) || round < 1) {
    throw Object.assign(new Error('Campeonato o fecha inválidos'), { statusCode: 400 });
  }
  if (!Number.isInteger(driverId) || driverId < 1) {
    throw Object.assign(new Error('Seleccioná un piloto'), { statusCode: 400 });
  }
  if (!APPEAL_SESSIONS.has(session)) {
    throw Object.assign(new Error('Seleccioná una tanda válida'), { statusCode: 400 });
  }
  if (!reason) throw Object.assign(new Error('Ingresá el motivo de la apelación'), { statusCode: 400 });
  const [[result]] = await pool.query(
    'SELECT id FROM resultados WHERE idcampeonato = ? AND ronda = ? AND idpiloto = ? LIMIT 1',
    [championshipId, round, driverId],
  );
  if (!result) throw Object.assign(new Error('El piloto no tiene resultados cargados en esta fecha'), { statusCode: 400 });
};

const RESULT_FIELDS = [
  'idcampeonato',
  'fecha',
  'ronda',
  'idcircuito',
  'idpiloto',
  'pole_sprint',
  'ganador_sprint',
  'pole_final',
  'ganador_final',
  'campeon',
  'presentismo',
  'pos_qualy_sprint',
  'pts_qualy_sprint',
  'desc_sancion_qualy_sprint',
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
  'desc_sancion_qualy_final',
  'pos_final',
  'pts_final',
  'rec_tiempo_final',
  'rec_pos_final',
  'aps_final',
  'kg_final',
  'kg_sancion_final',
  'desc_sancion_final',
  'sanciones_detalle',
];

const TEXT_FIELDS = new Set([
  'pos_qualy_sprint',
  'desc_sancion_qualy_sprint',
  'pos_sprint',
  'desc_sancion_sprint',
  'pos_qualy_final',
  'desc_sancion_qualy_final',
  'pos_final',
  'desc_sancion_final',
]);
const DECIMAL_FIELDS = new Set(['pts_sprint', 'pts_final']);
const BALLAST_FIELDS = new Set(['kg_sprint', 'kg_sancion_sprint', 'kg_final', 'kg_sancion_final']);
const BOOLEAN_FIELDS = new Set(['pole_sprint', 'ganador_sprint', 'pole_final', 'ganador_final', 'campeon']);

const normalizeValue = (field, value) => {
  if (field === 'sanciones_detalle') {
    if (!value) return null;
    if (typeof value === 'string') {
      try { return JSON.stringify(JSON.parse(value)); } catch { return null; }
    }
    return JSON.stringify(value);
  }
  if (TEXT_FIELDS.has(field)) return String(value ?? '').trim();
  if (field === 'fecha') return value;
  if (BOOLEAN_FIELDS.has(field)) return value === true || value === 1 || value === '1' ? 1 : 0;
  const normalizedValue = DECIMAL_FIELDS.has(field)
    ? String(value ?? 0).replace(',', '.')
    : value;
  const number = Number(normalizedValue ?? 0);
  if (!Number.isFinite(number)) return 0;
  return BALLAST_FIELDS.has(field) ? Math.trunc(number) : number;
};

const getAll = async (req, res, next) => {
  try {
    await Promise.all([ensureResultAchievements(), ensureChampionshipExclusions()]);
    const { idcampeonato, ronda } = req.query;
    let query = `
      SELECT r.*,
             p.nombre AS piloto, p.localidad, p.provincia AS piloto_provincia, p.ig,
             ci.nombre AS circuito, ci.variante,
             ci.imagen AS circuito_imagen, ci.trazado AS circuito_trazado,
             ci.localidad AS circuito_localidad, ci.provincia AS circuito_provincia,
             a.modelo, am.marca, am.logo AS auto_logo,
             CASE WHEN exclusion.idpiloto IS NULL THEN 0 ELSE 1 END AS excluido
      FROM resultados r
      JOIN pilotos p ON r.idpiloto = p.id
      JOIN circuitos ci ON r.idcircuito = ci.id
      LEFT JOIN inscriptos i ON i.idcampeonato = r.idcampeonato AND i.idpiloto = r.idpiloto
      LEFT JOIN autos a ON a.id = i.idauto
      LEFT JOIN autos_marcas am ON am.id = a.marca
      LEFT JOIN campeonato_pilotos_excluidos exclusion
        ON exclusion.idcampeonato = r.idcampeonato AND exclusion.idpiloto = r.idpiloto
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
    await ensureResultAchievements();
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
    await ensureResultAchievements();
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
    await ensureResultAchievements();
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
    await ensureResultAchievements();
    const changes = Array.isArray(req.body.changes) ? req.body.changes : [];
    if (!changes.length) {
      return res.status(400).json({ error: 'No hay cambios para guardar' });
    }

    await connection.beginTransaction();

    const championChanges = changes.filter(change => !change?.delete && Number(change?.data?.campeon) === 1);
    for (const change of championChanges) {
      let championshipId = Number(change.data.idcampeonato);
      if (!championshipId && change.id) {
        const [[currentResult]] = await connection.query('SELECT idcampeonato FROM resultados WHERE id = ?', [change.id]);
        championshipId = Number(currentResult?.idcampeonato);
      }
      if (championshipId) await connection.query('UPDATE resultados SET campeon = 0 WHERE idcampeonato = ?', [championshipId]);
    }

    for (const change of changes) {
      if (change?.delete) {
        if (change.id) {
          await connection.query('DELETE FROM resultados WHERE id = ?', [change.id]);
        }
        continue;
      }

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

const getAppeals = async (req, res, next) => {
  try {
    await ensureAppealsSchema();
    const championshipId = Number(req.query.idcampeonato);
    const round = Number(req.query.ronda);
    const conditions = [];
    const params = [];
    if (Number.isInteger(championshipId) && championshipId > 0) {
      conditions.push('a.idcampeonato = ?');
      params.push(championshipId);
    }
    if (Number.isInteger(round) && round > 0) {
      conditions.push('a.ronda = ?');
      params.push(round);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [rows] = await pool.query(
      `SELECT a.id, a.idcampeonato, a.ronda, a.tanda, a.idpiloto, a.motivo,
              a.video, a.video_nombre, a.creado, a.actualizado,
              p.nombre AS piloto
       FROM resultado_apelaciones a
       INNER JOIN pilotos p ON p.id = a.idpiloto
       ${where}
       ORDER BY a.ronda DESC,
                FIELD(a.tanda, 'qualy_sprint', 'sprint', 'qualy_final', 'final'),
                p.nombre ASC, a.id ASC`,
      params,
    );
    res.json({ data: rows, total: rows.length });
  } catch (error) {
    next(error);
  }
};

const createAppeal = async (req, res, next) => {
  let saved = false;
  try {
    await ensureAppealsSchema();
    const championshipId = Number(req.body.idcampeonato);
    const round = Number(req.body.ronda);
    const driverId = Number(req.body.idpiloto);
    const session = String(req.body.tanda || '').trim().toLowerCase();
    const reason = String(req.body.motivo || '').trim().slice(0, 10000);
    await validateAppealData({ championshipId, round, driverId, session, reason });
    const video = appealVideoPath(req.file);
    const videoName = req.file ? path.basename(String(req.file.originalname || '')).slice(0, 255) : null;
    const [result] = await pool.query(
      `INSERT INTO resultado_apelaciones
       (idcampeonato, ronda, tanda, idpiloto, motivo, video, video_nombre)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [championshipId, round, session, driverId, reason, video, videoName],
    );
    saved = true;
    const [[created]] = await pool.query(
      `SELECT a.*, p.nombre AS piloto
       FROM resultado_apelaciones a INNER JOIN pilotos p ON p.id = a.idpiloto
       WHERE a.id = ?`,
      [result.insertId],
    );
    res.status(201).json({ data: created, message: 'Apelación agregada' });
  } catch (error) {
    if (req.file && !saved) await removeAppealVideo(appealVideoPath(req.file)).catch(() => {});
    next(error);
  }
};

const updateAppeal = async (req, res, next) => {
  let saved = false;
  try {
    await ensureAppealsSchema();
    const appealId = Number(req.params.appealId);
    const [[current]] = await pool.query('SELECT * FROM resultado_apelaciones WHERE id = ?', [appealId]);
    if (!current) {
      if (req.file) await removeAppealVideo(appealVideoPath(req.file));
      return res.status(404).json({ error: 'Apelación no encontrada' });
    }
    const championshipId = Number(req.body.idcampeonato || current.idcampeonato);
    const round = Number(req.body.ronda || current.ronda);
    const driverId = Number(req.body.idpiloto || current.idpiloto);
    const session = String(req.body.tanda || current.tanda).trim().toLowerCase();
    const reason = String(req.body.motivo ?? current.motivo).trim().slice(0, 10000);
    await validateAppealData({ championshipId, round, driverId, session, reason });
    const video = req.file ? appealVideoPath(req.file) : current.video;
    const videoName = req.file ? path.basename(String(req.file.originalname || '')).slice(0, 255) : current.video_nombre;
    await pool.query(
      `UPDATE resultado_apelaciones
       SET idcampeonato = ?, ronda = ?, tanda = ?, idpiloto = ?, motivo = ?, video = ?, video_nombre = ?
       WHERE id = ?`,
      [championshipId, round, session, driverId, reason, video, videoName, appealId],
    );
    saved = true;
    if (req.file && current.video && current.video !== video) {
      await removeAppealVideo(current.video).catch(error => console.warn('No se pudo eliminar el video anterior de la apelación:', error.message));
    }
    const [[updated]] = await pool.query(
      `SELECT a.*, p.nombre AS piloto
       FROM resultado_apelaciones a INNER JOIN pilotos p ON p.id = a.idpiloto
       WHERE a.id = ?`,
      [appealId],
    );
    res.json({ data: updated, message: 'Apelación actualizada' });
  } catch (error) {
    if (req.file && !saved) await removeAppealVideo(appealVideoPath(req.file)).catch(() => {});
    next(error);
  }
};

const removeAppeal = async (req, res, next) => {
  try {
    await ensureAppealsSchema();
    const appealId = Number(req.params.appealId);
    const [[appeal]] = await pool.query('SELECT video FROM resultado_apelaciones WHERE id = ?', [appealId]);
    if (!appeal) return res.status(404).json({ error: 'Apelación no encontrada' });
    await pool.query('DELETE FROM resultado_apelaciones WHERE id = ?', [appealId]);
    if (appeal.video) await removeAppealVideo(appeal.video);
    res.json({ message: 'Apelación eliminada' });
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    await ensureResultAchievements();
    const [result] = await pool.query('DELETE FROM resultados WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Resultado no encontrado' });
    res.json({ message: 'Resultado eliminado' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll, getById, create, update, saveBulk, getAppeals, createAppeal, updateAppeal, removeAppeal, remove };
