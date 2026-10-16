const pool = require('../config/db');
const { normalizeResponse } = require('./liveTimingController');

const CACHE_TTL_MS = 5000;
const REMOTE_TIMEOUT_MS = 12000;
const SERVER_MANAGER_URL = process.env.CLUB_SERVER_MANAGER_URL || 'http://rh.servegame.com:30000/';
const timingCaches = new Map();
let schemaPromise;

const ensureColumn = async (table, column, definition) => {
  const [[row]] = await pool.query(`
    SELECT COUNT(*) AS total
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?
  `, [table, column]);
  if (!Number(row?.total)) await pool.query(`ALTER TABLE \`${table}\` ADD COLUMN \`${column}\` ${definition}`);
};

const ensureSchema = () => {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await pool.query(`CREATE TABLE IF NOT EXISTS club_configuracion (
        id TINYINT UNSIGNED NOT NULL DEFAULT 1,
        idcategoria INT UNSIGNED NULL,
        idcircuito INT UNSIGNED NULL,
        servidor VARCHAR(500) NULL,
        activo TINYINT(1) NOT NULL DEFAULT 1,
        actualizado TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      await pool.query(`CREATE TABLE IF NOT EXISTS club_autos (
        idconfiguracion TINYINT UNSIGNED NOT NULL DEFAULT 1,
        idauto INT UNSIGNED NOT NULL,
        orden SMALLINT UNSIGNED NOT NULL DEFAULT 0,
        PRIMARY KEY (idconfiguracion, idauto),
        KEY idx_club_autos_orden (idconfiguracion, orden)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
      await ensureColumn('club_configuracion', 'nombre', 'VARCHAR(160) NULL AFTER `id`');
      await ensureColumn('club_configuracion', 'enlace_ingreso', 'VARCHAR(1000) NULL AFTER `servidor`');
      await ensureColumn('club_configuracion', 'orden', 'SMALLINT UNSIGNED NOT NULL DEFAULT 0 AFTER `activo`');
    })().catch(error => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
};

const parseServerUrl = value => {
  const raw = String(value || '').trim();
  if (!raw) return { publicUrl: '', timingUrl: '', serverNumber: null };

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return { error: 'Ingresá un enlace válido para el servidor CLUB' };
  }

  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) {
    return { error: 'El enlace del servidor debe comenzar con http:// o https://' };
  }

  const serverNumber = Number(parsed.searchParams.get('server'));
  if (!Number.isInteger(serverNumber) || serverNumber < 0) {
    return { error: 'El enlace debe incluir un número de servidor válido, por ejemplo ?server=1' };
  }

  const publicUrl = new URL('/live-timing', parsed.origin);
  publicUrl.searchParams.set('server', String(serverNumber));
  const timingUrl = new URL('/api/live-timings/leaderboard.json', parsed.origin);
  timingUrl.searchParams.set('server', String(serverNumber));
  return {
    publicUrl: publicUrl.toString(),
    timingUrl: timingUrl.toString(),
    serverNumber,
    origin: parsed.origin,
  };
};

const parseJoinUrl = value => {
  const raw = String(value || '').trim();
  if (!raw) return { error: 'Ingresá el enlace directo para acceder al servidor' };
  if (raw.length > 1000) return { error: 'El enlace directo es demasiado largo' };
  try {
    const parsed = new URL(raw);
    if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) throw new Error('invalid');
    return { url: raw };
  } catch {
    return { error: 'Ingresá un enlace directo válido que comience con http:// o https://' };
  }
};

const fetchWithTimeout = async (url, options = {}, timeoutMs = REMOTE_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

const loadConfigurations = async ({ onlyActive = false } = {}) => {
  await ensureSchema();
  const [configurations] = await pool.query(`
    SELECT cfg.id, cfg.nombre, cfg.idcategoria, cfg.idcircuito, cfg.servidor, cfg.enlace_ingreso,
           cfg.activo, cfg.orden, cfg.actualizado,
           cat.categoria, cat.logo AS categoria_logo,
           cir.nombre AS circuito, cir.variante, cir.localidad, cir.provincia, cir.pais,
           cir.imagen AS circuito_imagen, cir.trazado AS circuito_trazado
    FROM club_configuracion cfg
    LEFT JOIN categorias cat ON cat.id = cfg.idcategoria
    LEFT JOIN circuitos cir ON cir.id = cfg.idcircuito
    ${onlyActive ? 'WHERE cfg.activo = 1' : ''}
    ORDER BY cfg.orden ASC, cfg.id ASC
  `);
  if (!configurations.length) return [];

  const ids = configurations.map(configuration => Number(configuration.id));
  const [cars] = await pool.query(`
    SELECT ca.idconfiguracion, a.id, a.idcategoria, a.marca AS idmarca, am.marca, am.logo,
           a.modelo, a.imagen, ca.orden
    FROM club_autos ca
    JOIN autos a ON a.id = ca.idauto
    JOIN autos_marcas am ON am.id = a.marca
    WHERE ca.idconfiguracion IN (?)
    ORDER BY ca.idconfiguracion ASC, ca.orden ASC, am.marca ASC, a.modelo ASC
  `, [ids]);
  const carsByConfiguration = cars.reduce((groups, car) => {
    const key = String(car.idconfiguracion);
    if (!groups[key]) groups[key] = [];
    groups[key].push(car);
    return groups;
  }, {});

  return configurations.map(configuration => {
    const parsedServer = parseServerUrl(configuration.servidor);
    return {
      ...configuration,
      nombre: configuration.nombre || configuration.categoria || `CADPO CLUB ${configuration.id}`,
      activo: Boolean(configuration.activo),
      numero_servidor: parsedServer.serverNumber,
      autos: carsByConfiguration[String(configuration.id)] || [],
    };
  });
};

const getPublic = async (req, res, next) => {
  try {
    res.json({ data: await loadConfigurations({ onlyActive: true }) });
  } catch (error) {
    next(error);
  }
};

const getAdmin = async (req, res, next) => {
  try {
    res.json({ data: await loadConfigurations() });
  } catch (error) {
    next(error);
  }
};

const validatePayload = async body => {
  const nombre = String(body.nombre || '').trim().toLocaleUpperCase('es-AR').slice(0, 160);
  const idcategoria = Number(body.idcategoria);
  const idcircuito = Number(body.idcircuito);
  const autoIds = [...new Set((Array.isArray(body.autos) ? body.autos : []).map(Number).filter(Number.isInteger))];
  const activo = !['false', '0', 'off'].includes(String(body.activo).toLowerCase()) ? 1 : 0;
  const orden = Math.max(0, Math.min(65535, Math.trunc(Number(body.orden) || 0)));
  const parsedServer = parseServerUrl(body.servidor);
  const parsedJoinUrl = parseJoinUrl(body.enlace_ingreso);

  if (!nombre) return { error: 'Ingresá un nombre para identificar el servidor CLUB' };
  if (!idcategoria || !idcircuito) return { error: 'Seleccioná una categoría y un circuito' };
  if (!autoIds.length) return { error: 'Seleccioná al menos un auto para el servidor CLUB' };
  if (parsedServer.error) return { error: parsedServer.error };
  if (parsedJoinUrl.error) return { error: parsedJoinUrl.error };
  if (!parsedServer.publicUrl) return { error: 'Ingresá el enlace del servidor CLUB' };

  const [[[category]], [[circuit]], [cars]] = await Promise.all([
    pool.query('SELECT id FROM categorias WHERE id = ?', [idcategoria]),
    pool.query('SELECT id FROM circuitos WHERE id = ?', [idcircuito]),
    pool.query('SELECT id, idcategoria FROM autos WHERE id IN (?)', [autoIds]),
  ]);
  if (!category) return { error: 'La categoría seleccionada no existe' };
  if (!circuit) return { error: 'El circuito seleccionado no existe' };
  if (cars.length !== autoIds.length || cars.some(car => Number(car.idcategoria) !== idcategoria)) {
    return { error: 'Todos los autos deben pertenecer a la categoría seleccionada' };
  }

  return { nombre, idcategoria, idcircuito, autoIds, activo, orden, parsedServer, joinUrl: parsedJoinUrl.url };
};

const saveCars = async (connection, id, autoIds) => {
  await connection.query('DELETE FROM club_autos WHERE idconfiguracion = ?', [id]);
  for (let index = 0; index < autoIds.length; index += 1) {
    await connection.query(
      'INSERT INTO club_autos (idconfiguracion, idauto, orden) VALUES (?, ?, ?)',
      [id, autoIds[index], index],
    );
  }
};

const create = async (req, res, next) => {
  try {
    await ensureSchema();
    const payload = await validatePayload(req.body);
    if (payload.error) return res.status(400).json({ error: payload.error });

    const connection = await pool.getConnection();
    let id;
    try {
      await connection.beginTransaction();
      const [[row]] = await connection.query('SELECT COALESCE(MAX(id), 0) + 1 AS nextId FROM club_configuracion');
      id = Number(row.nextId);
      if (id > 255) throw new Error('Se alcanzó el límite de servidores CLUB configurables');
      await connection.query(`
        INSERT INTO club_configuracion (id, nombre, idcategoria, idcircuito, servidor, enlace_ingreso, activo, orden)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [id, payload.nombre, payload.idcategoria, payload.idcircuito, payload.parsedServer.publicUrl, payload.joinUrl, payload.activo, payload.orden]);
      await saveCars(connection, id, payload.autoIds);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    res.status(201).json({ data: (await loadConfigurations()).find(item => Number(item.id) === id), message: 'Servidor CLUB agregado' });
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    await ensureSchema();
    const id = Number(req.params.id || req.body.id || 1);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Servidor CLUB inválido' });
    const payload = await validatePayload(req.body);
    if (payload.error) return res.status(400).json({ error: payload.error });

    const [[existing]] = await pool.query('SELECT id FROM club_configuracion WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Servidor CLUB no encontrado' });

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query(`
        UPDATE club_configuracion
        SET nombre = ?, idcategoria = ?, idcircuito = ?, servidor = ?, enlace_ingreso = ?, activo = ?, orden = ?
        WHERE id = ?
      `, [payload.nombre, payload.idcategoria, payload.idcircuito, payload.parsedServer.publicUrl, payload.joinUrl, payload.activo, payload.orden, id]);
      await saveCars(connection, id, payload.autoIds);
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    timingCaches.delete(id);
    res.json({ data: (await loadConfigurations()).find(item => Number(item.id) === id), message: 'Servidor CLUB actualizado' });
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    await ensureSchema();
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Servidor CLUB inválido' });
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query('DELETE FROM club_autos WHERE idconfiguracion = ?', [id]);
      const [result] = await connection.query('DELETE FROM club_configuracion WHERE id = ?', [id]);
      if (!result.affectedRows) {
        await connection.rollback();
        return res.status(404).json({ error: 'Servidor CLUB no encontrado' });
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    timingCaches.delete(id);
    res.json({ message: 'Servidor CLUB eliminado' });
  } catch (error) {
    next(error);
  }
};

const stripHtml = value => String(value || '')
  .replace(/<[^>]*>/g, ' ')
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/\s+/g, ' ')
  .trim();

const discoverServers = async (req, res, next) => {
  try {
    const managerUrl = new URL(SERVER_MANAGER_URL);
    const response = await fetchWithTimeout(managerUrl.toString());
    if (!response.ok) throw new Error(`El Server Manager respondió ${response.status}`);
    const html = await response.text();
    const serverPattern = /<a[^>]+href=["'][^"']*set-server\?server=(\d+)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi;
    const discovered = [];
    let match;
    while ((match = serverPattern.exec(html))) {
      const number = Number(match[1]);
      const block = match[2];
      const nameMatch = block.match(/class=["'][^"']*name[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
      const statusMatch = block.match(/class=["'][^"']*status[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
      const name = stripHtml(nameMatch?.[1]) || `Servidor ${number}`;
      const status = stripHtml(statusMatch?.[1]) || 'Estado desconocido';
      discovered.push({
        numero: number,
        nombre: name,
        estado: status,
        online: /text-success/i.test(block) && !/offline/i.test(status),
        enlace: new URL(`/live-timing?server=${number}`, managerUrl.origin).toString(),
      });
    }

    const detailed = await Promise.all(discovered.map(async server => {
      if (!server.online) return server;
      try {
        const timingUrl = new URL('/api/live-timings/leaderboard.json', managerUrl.origin);
        timingUrl.searchParams.set('server', String(server.numero));
        const timingResponse = await fetchWithTimeout(timingUrl.toString(), { headers: { Accept: 'application/json' } }, 8000);
        if (!timingResponse.ok) return server;
        const timing = await timingResponse.json();
        const drivers = [...(timing.ConnectedDrivers || []), ...(timing.DisconnectedDrivers || [])];
        const cars = [...new Set(drivers.map(driver => driver?.CarInfo?.CarName || driver?.CarInfo?.CarModel).filter(Boolean))];
        return {
          ...server,
          nombre: timing.ServerName || server.nombre,
          circuito: timing.Track || '',
          variante: timing.TrackConfig || '',
          sesion: normalizeResponse(timing).session,
          conectados: (timing.ConnectedDrivers || []).length,
          autos_remotos: cars,
        };
      } catch (_error) {
        return server;
      }
    }));

    const configured = await loadConfigurations();
    const configuredNumbers = new Map(configured.map(item => [Number(item.numero_servidor), Number(item.id)]));
    res.json({
      data: detailed.map(server => ({ ...server, idconfiguracion: configuredNumbers.get(server.numero) || null })),
      source: managerUrl.origin,
    });
  } catch (error) {
    error.statusCode = error.statusCode || 502;
    error.message = error.name === 'AbortError'
      ? 'El Server Manager no respondió a tiempo'
      : `No se pudieron consultar los servidores: ${error.message}`;
    next(error);
  }
};

const getLiveTiming = async (req, res, next) => {
  const id = Number(req.params.id || req.query.id);
  try {
    const configurations = await loadConfigurations({ onlyActive: true });
    const configuration = id
      ? configurations.find(item => Number(item.id) === id)
      : configurations[0];
    if (!configuration) return res.status(404).json({ error: 'El servidor CLUB no está habilitado' });
    const parsedServer = parseServerUrl(configuration.servidor);
    if (parsedServer.error || !parsedServer.timingUrl) return res.status(422).json({ error: 'El servidor CLUB no tiene un enlace válido' });

    const cached = timingCaches.get(Number(configuration.id));
    if (cached?.data && cached.source === parsedServer.timingUrl && Date.now() - cached.time < CACHE_TTL_MS) {
      return res.json({ data: cached.data, cached: true });
    }

    const response = await fetchWithTimeout(parsedServer.timingUrl, { headers: { Accept: 'application/json' } });
    if (!response.ok) {
      const error = new Error(`El servidor CLUB respondió ${response.status}`);
      error.statusCode = 502;
      throw error;
    }

    const data = normalizeResponse(await response.json());
    timingCaches.set(Number(configuration.id), { data, time: Date.now(), source: parsedServer.timingUrl });
    res.json({ data, cached: false });
  } catch (error) {
    const cached = id ? timingCaches.get(id) : null;
    if (cached?.data && Date.now() - cached.time < 30000) {
      return res.json({ data: cached.data, cached: true, recovering: true });
    }
    error.statusCode = error.statusCode || 503;
    error.message = error.name === 'AbortError'
      ? 'El servidor CLUB no respondió a tiempo'
      : `Tiempos del CLUB no disponibles: ${error.message}`;
    next(error);
  }
};

module.exports = {
  create,
  discoverServers,
  getAdmin,
  getLiveTiming,
  getPublic,
  remove,
  update,
};
