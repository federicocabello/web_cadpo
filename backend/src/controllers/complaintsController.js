const pool = require('../config/db');

const developmentComplaintsEnabled = String(process.env.NODE_ENV || '').toLowerCase() === 'development'
  && String(process.env.COMPLAINTS_FORCE_OPEN || '').toLowerCase() === 'true';
const complaintClosingExpression = developmentComplaintsEnabled
  ? "TIMESTAMP(DATE_ADD(CURDATE(), INTERVAL 1 DAY), '23:45:00')"
  : "TIMESTAMP(DATE_ADD(DATE(cal.fecha), INTERVAL 1 DAY), '23:45:00')";

let schemaPromise;
const ensureSchema = () => {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS denuncias (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          idcampeonato INT NOT NULL,
          ronda INT NOT NULL,
          idpiloto_denunciado INT NOT NULL,
          tanda VARCHAR(20) NOT NULL,
          minuto_repeticion VARCHAR(20) NOT NULL,
          descripcion VARCHAR(1000) NULL,
          visto TINYINT(1) NOT NULL DEFAULT 0,
          creado TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          actualizado TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_denuncias_campeonato_fecha (idcampeonato, ronda),
          KEY idx_denuncias_piloto (idpiloto_denunciado)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);
      const [columns] = await pool.query("SHOW COLUMNS FROM denuncias LIKE 'visto'");
      if (!columns.length) await pool.query('ALTER TABLE denuncias ADD COLUMN visto TINYINT(1) NOT NULL DEFAULT 0 AFTER descripcion');
    })().catch(error => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
};

const eventSelect = `
  SELECT cal.idcampeonato, cal.ronda, cal.fecha,
         ${complaintClosingExpression} AS cierre_denuncias,
         c.temporada, c.anio, c.reglamento, cat.categoria, cat.logo AS categoria_logo,
         ci.nombre AS circuito, ci.variante
  FROM calendario cal
  JOIN campeonatos c ON c.id = cal.idcampeonato
  JOIN categorias cat ON cat.id = c.idcategoria
  JOIN circuitos ci ON ci.id = cal.idcircuito
`;

const normalizeSession = value => {
  const session = String(value || '').trim().toLocaleUpperCase('es-AR');
  return session === 'SPRINT' || session === 'FINAL' ? session : '';
};

const normalizeReplayMinute = value => {
  const input = String(value ?? '').trim().replace(/\s+/g, '');
  const match = input.match(/^(\d+)(?:[.,:](\d{1,2}))?$/);
  if (!match) return '';
  const minutes = Number(match[1]);
  const seconds = Number(match[2] || 0);
  if (!Number.isSafeInteger(minutes) || minutes < 0 || seconds > 59) return '';
  return `${minutes}.${String(seconds).padStart(2, '0')}`;
};

const loadDrivers = async idcampeonato => {
  const [drivers] = await pool.query(
    `SELECT DISTINCT p.id, p.nombre,
            CASE
              WHEN COALESCE(i.tipo_inscripcion, '') IN ('extra', 'extra-sin-diseno') THEN 0
              ELSE COALESCE(i.numero, 0)
            END AS numero
     FROM inscriptos i
     JOIN pilotos p ON p.id = i.idpiloto
     WHERE i.idcampeonato = ?
     ORDER BY p.nombre ASC`,
    [idcampeonato],
  );
  return drivers;
};

const getContext = async (req, res, next) => {
  try {
    await ensureSchema();
    const [openEvents] = await pool.query(developmentComplaintsEnabled ? `
      ${eventSelect}
      WHERE EXISTS (
        SELECT 1 FROM inscriptos i WHERE i.idcampeonato = cal.idcampeonato
      )
      ORDER BY ABS(TIMESTAMPDIFF(SECOND, cal.fecha, NOW())) ASC
      LIMIT 1
    ` : `
      ${eventSelect}
      WHERE NOW() >= cal.fecha
        AND NOW() <= ${complaintClosingExpression}
      ORDER BY cal.fecha DESC
    `);
    const [nextEvents] = await pool.query(`
      ${eventSelect}
      WHERE cal.fecha > NOW()
      ORDER BY cal.fecha ASC
      LIMIT 1
    `);
    const events = await Promise.all(openEvents.map(async event => ({
      ...event,
      pilotos: await loadDrivers(event.idcampeonato),
    })));
    res.json({ data: { eventos: events, proxima: nextEvents[0] || null } });
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    await ensureSchema();
    const idcampeonato = Number(req.body.idcampeonato);
    const ronda = Number(req.body.ronda);
    const idpiloto = Number(req.body.idpiloto_denunciado);
    const tanda = normalizeSession(req.body.tanda);
    const minuto = normalizeReplayMinute(req.body.minuto_repeticion);
    const descripcion = String(req.body.descripcion || '').trim().slice(0, 1000);
    if (!idcampeonato || !ronda || !idpiloto || !tanda || !minuto) {
      return res.status(400).json({ error: 'Completá el piloto denunciado, la tanda y el minuto de la repetición' });
    }

    const [[event]] = await pool.query(`
      SELECT cal.idcampeonato
      FROM calendario cal
      WHERE cal.idcampeonato = ? AND cal.ronda = ?
        ${developmentComplaintsEnabled ? '' : `AND NOW() >= cal.fecha
        AND NOW() <= ${complaintClosingExpression}`}
      LIMIT 1
    `, [idcampeonato, ronda]);
    if (!event) return res.status(409).json({ error: 'El período para realizar denuncias está cerrado' });

    const [[driver]] = await pool.query(
      'SELECT idpiloto FROM inscriptos WHERE idcampeonato = ? AND idpiloto = ? LIMIT 1',
      [idcampeonato, idpiloto],
    );
    if (!driver) return res.status(400).json({ error: 'El piloto seleccionado no pertenece a este campeonato' });

    const [result] = await pool.query(
      `INSERT INTO denuncias
       (idcampeonato, ronda, idpiloto_denunciado, tanda, minuto_repeticion, descripcion)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [idcampeonato, ronda, idpiloto, tanda, minuto, descripcion || null],
    );
    res.status(201).json({ data: { id: result.insertId }, message: 'La denuncia anónima fue enviada correctamente' });
  } catch (error) {
    next(error);
  }
};

const adminSelect = `
  SELECT d.id, d.idcampeonato, d.ronda, d.idpiloto_denunciado, d.tanda,
         d.minuto_repeticion, d.descripcion, d.visto, d.creado, d.actualizado,
         p.nombre AS piloto, c.temporada, c.anio, cat.categoria,
         cat.logo AS categoria_logo, ci.nombre AS circuito, cal.fecha
  FROM denuncias d
  JOIN pilotos p ON p.id = d.idpiloto_denunciado
  JOIN campeonatos c ON c.id = d.idcampeonato
  JOIN categorias cat ON cat.id = c.idcategoria
  LEFT JOIN calendario cal ON cal.idcampeonato = d.idcampeonato AND cal.ronda = d.ronda
  LEFT JOIN circuitos ci ON ci.id = cal.idcircuito
`;

const getAdmin = async (req, res, next) => {
  try {
    await ensureSchema();
    const params = [];
    const where = [];
    if (req.query.idcampeonato) {
      where.push('d.idcampeonato = ?');
      params.push(req.query.idcampeonato);
    }
    if (req.query.ronda) {
      where.push('d.ronda = ?');
      params.push(req.query.ronda);
    }
    const [rows] = await pool.query(`${adminSelect}${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY d.creado DESC, d.id DESC`, params);
    res.json({ data: rows.map(row => ({ ...row, visto: Boolean(row.visto) })), total: rows.length });
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    await ensureSchema();
    const idcampeonato = Number(req.body.idcampeonato);
    const ronda = Number(req.body.ronda);
    const idpiloto = Number(req.body.idpiloto_denunciado);
    const tanda = normalizeSession(req.body.tanda);
    const minuto = normalizeReplayMinute(req.body.minuto_repeticion);
    const descripcion = String(req.body.descripcion || '').trim().slice(0, 1000);
    if (!idcampeonato || !ronda || !idpiloto || !tanda || !minuto) {
      return res.status(400).json({ error: 'Los datos de la denuncia no son válidos' });
    }
    const [[driver]] = await pool.query(
      'SELECT idpiloto FROM inscriptos WHERE idcampeonato = ? AND idpiloto = ? LIMIT 1',
      [idcampeonato, idpiloto],
    );
    if (!driver) return res.status(400).json({ error: 'El piloto seleccionado no pertenece a este campeonato' });
    const [result] = await pool.query(
      `UPDATE denuncias SET idcampeonato = ?, ronda = ?, idpiloto_denunciado = ?,
       tanda = ?, minuto_repeticion = ?, descripcion = ? WHERE id = ?`,
      [idcampeonato, ronda, idpiloto, tanda, minuto, descripcion || null, req.params.id],
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Denuncia no encontrada' });
    res.json({ message: 'Denuncia actualizada correctamente' });
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    await ensureSchema();
    const [result] = await pool.query('DELETE FROM denuncias WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Denuncia no encontrada' });
    res.json({ message: 'Denuncia eliminada correctamente' });
  } catch (error) {
    next(error);
  }
};

const markSeen = async (req, res, next) => {
  try {
    await ensureSchema();
    const visto = req.body.visto === true || req.body.visto === 1 || req.body.visto === '1' ? 1 : 0;
    const [result] = await pool.query('UPDATE denuncias SET visto = ? WHERE id = ?', [visto, req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Denuncia no encontrada' });
    res.json({ data: { id: Number(req.params.id), visto: Boolean(visto) }, message: visto ? 'Denuncia marcada como vista' : 'Denuncia marcada como pendiente' });
  } catch (error) {
    next(error);
  }
};

module.exports = { create, getAdmin, getContext, markSeen, remove, update };
