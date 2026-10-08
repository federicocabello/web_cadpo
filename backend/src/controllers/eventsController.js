const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const pool = require('../config/db');
const publicDir = require('../utils/publicDir');
const slugify = require('../utils/slugify');
const ensureEventMultipliers = require('../utils/ensureEventMultipliers');

const eventBannerExtensions = new Set(['.avif', '.webp', '.jpg', '.jpeg', '.png']);
const pendingCircuitName = 'A CONFIRMAR';

const isPendingCircuitValue = value => {
  const normalized = String(value || '').trim().toLocaleUpperCase('es-AR').replace(/[_-]+/g, ' ');
  return normalized === 'PENDING' || normalized === pendingCircuitName;
};

const resolveCircuitId = async (database, value) => {
  if (!isPendingCircuitValue(value)) {
    const circuitId = Number(value);
    return Number.isInteger(circuitId) && circuitId > 0 ? circuitId : null;
  }

  const [[existing]] = await database.query(
    'SELECT id FROM circuitos WHERE UPPER(TRIM(nombre)) = ? AND COALESCE(variante, \'\') = \'\' ORDER BY id ASC LIMIT 1',
    [pendingCircuitName]
  );
  if (existing?.id) return Number(existing.id);

  const [result] = await database.query(
    'INSERT INTO circuitos (nombre, localidad, provincia, pais, imagen, trazado, variante) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [pendingCircuitName, '', '', '', '', '', '']
  );
  return Number(result.insertId);
};

const getEventGallery = async (idcampeonato, ronda, verifyEvent = true) => {
  const championshipId = Number(idcampeonato);
  const round = Number(ronda);
  if (!Number.isInteger(championshipId) || championshipId < 1 || !Number.isInteger(round) || round < 1) return null;
  if (verifyEvent) {
    const [[event]] = await pool.query('SELECT 1 FROM calendario WHERE idcampeonato = ? AND ronda = ? LIMIT 1', [championshipId, round]);
    if (!event) return null;
  }
  const relativePath = path.posix.join('media', 'fechas', `campeonato-${championshipId}`, `fecha-${round}`);
  return {
    directory: path.join(publicDir, ...relativePath.split('/')),
    publicPath: `/${relativePath}`,
  };
};

const listEventBanners = async gallery => {
  let entries = [];
  try { entries = await fs.readdir(gallery.directory, { withFileTypes: true }); } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  return entries
    .filter(entry => entry.isFile() && eventBannerExtensions.has(path.extname(entry.name).toLowerCase()))
    .map(entry => ({ filename: entry.name, url: `${gallery.publicPath}/${entry.name}` }))
    .sort((a, b) => a.filename.localeCompare(b.filename));
};

const attachEventBanners = rows => Promise.all(rows.map(async row => {
  const gallery = await getEventGallery(row.idcampeonato, row.ronda, false);
  return { ...withMediaFields(row), banners: await listEventBanners(gallery) };
}));

const moveEventGallery = async (oldChampionshipId, oldRound, newChampionshipId, newRound) => {
  if (String(oldChampionshipId) === String(newChampionshipId) && String(oldRound) === String(newRound)) return;
  const oldGallery = await getEventGallery(oldChampionshipId, oldRound, false);
  const newGallery = await getEventGallery(newChampionshipId, newRound, false);
  let entries = [];
  try { entries = await fs.readdir(oldGallery.directory, { withFileTypes: true }); } catch (error) {
    if (error.code === 'ENOENT') return;
    throw error;
  }
  const files = entries.filter(entry => entry.isFile() && eventBannerExtensions.has(path.extname(entry.name).toLowerCase()));
  if (!files.length) return;
  await fs.mkdir(newGallery.directory, { recursive: true });
  await Promise.all(files.map(async entry => {
    const source = path.join(oldGallery.directory, entry.name);
    let target = path.join(newGallery.directory, entry.name);
    try { await fs.access(target); target = path.join(newGallery.directory, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${path.extname(entry.name)}`); } catch {}
    await fs.rename(source, target);
  }));
  await fs.rm(oldGallery.directory, { recursive: true, force: true });
};

const baseSelect = `
  SELECT cal.idcampeonato, cal.ronda, cal.fecha, cal.especial,
         cal.especialidad, cal.coronacion, cal.transmision,
         cal.multiplicador_sprint, cal.multiplicador_final,
         CONCAT(cal.idcampeonato, '-', cal.ronda) AS id,
         CASE
           WHEN cal.fecha >= NOW() THEN 'upcoming'
           ELSE 'completed'
         END AS status,
         ci.id AS idcircuito, ci.nombre AS circuito,
         ci.localidad, ci.provincia, ci.pais, ci.imagen, ci.trazado, ci.variante,
         c.temporada, c.anio, c.plataforma, c.reglamento, c.puerto, c.n_server, c.servidor,
         cat.id AS idcategoria, cat.categoria, cat.logo AS categoria_logo
  FROM calendario cal
  JOIN circuitos ci ON cal.idcircuito = ci.id
  JOIN campeonatos c ON cal.idcampeonato = c.id
  JOIN categorias cat ON c.idcategoria = cat.id
`;

const getAll = async (req, res, next) => {
  try {
    await ensureEventMultipliers();
    const { idcampeonato, status } = req.query;
    const params = [];
    const conditions = [];

    if (idcampeonato) {
      conditions.push('cal.idcampeonato = ?');
      params.push(idcampeonato);
    }
    if (status === 'upcoming') conditions.push('cal.fecha >= NOW()');
    if (status === 'completed') conditions.push('cal.fecha < NOW()');

    const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
    const order = status === 'completed' ? ' ORDER BY cal.fecha DESC' : ' ORDER BY cal.fecha ASC';
    const [rows] = await pool.query(`${baseSelect}${where}${order}`, params);

    res.json({ data: await attachEventBanners(rows), total: rows.length });
  } catch (err) {
    next(err);
  }
};

const getUpcoming = async (req, res, next) => {
  try {
    await ensureEventMultipliers();
    const [rows] = await pool.query(`${baseSelect} WHERE cal.fecha >= NOW() ORDER BY cal.fecha ASC LIMIT 10`);
    res.json({ data: await attachEventBanners(rows), total: rows.length });
  } catch (err) {
    next(err);
  }
};

const withMediaFields = row => {
  const circuitoSlug = slugify(row.circuito);
  const categoriaSlug = slugify(row.categoria);
  const pendingCircuit = String(row.circuito || '').trim().toLocaleUpperCase('es-AR') === pendingCircuitName;

  return {
    ...row,
    circuito_slug: circuitoSlug,
    categoria_slug: categoriaSlug,
    circuito_foto_url: pendingCircuit ? '' : row.imagen || `/media/circuitos/fotos/${circuitoSlug}.png`,
    circuito_trazado_url: pendingCircuit ? '' : row.trazado || `/media/circuitos/trazados/${circuitoSlug}.png`,
    campeonato_media_path: `/media/campeonatos/${categoriaSlug}/temporada-${slugify(row.temporada)}`,
  };
};

const normalizeSpecialty = (especial, especialidad) => {
  if (!especial) return null;

  return String(especialidad || '').trim().toLocaleUpperCase('es-AR') || null;
};

const normalizeTransmissionUrl = value => String(value || '').trim();

const create = async (req, res, next) => {
  try {
    const { idcampeonato, fecha, ronda, idcircuito, especial, especialidad, coronacion, transmision } = req.body;
    if (!idcampeonato || !fecha || !ronda || !idcircuito) {
      return res.status(400).json({ error: 'idcampeonato, fecha, ronda e idcircuito son requeridos' });
    }
    const circuitId = await resolveCircuitId(pool, idcircuito);
    if (!circuitId) return res.status(400).json({ error: 'Seleccioná un circuito o marcá la fecha como A CONFIRMAR' });

    await pool.query(
      `INSERT INTO calendario (idcampeonato, fecha, ronda, idcircuito, especial, especialidad, coronacion, transmision)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [idcampeonato, fecha, ronda, circuitId, especial ? 1 : 0, normalizeSpecialty(especial, especialidad), coronacion ? 1 : 0, normalizeTransmissionUrl(transmision)]
    );

    res.status(201).json({ message: 'Fecha agregada al calendario', data: req.body });
  } catch (err) {
    next(err);
  }
};

const createBatch = async (req, res, next) => {
  const connection = await pool.getConnection();

  try {
    const events = Array.isArray(req.body.events) ? req.body.events : [];
    if (!events.length) {
      return res.status(400).json({ error: 'Agregá al menos una fecha al calendario' });
    }

    const invalidEvent = events.find(event =>
      !event.idcampeonato || !event.fecha || !event.ronda || !event.idcircuito
    );
    if (invalidEvent) {
      return res.status(400).json({ error: 'Todas las fechas deben tener campeonato, fecha, ronda y circuito' });
    }

    await connection.beginTransaction();
    const query = `INSERT INTO calendario
      (idcampeonato, fecha, ronda, idcircuito, especial, especialidad, coronacion, transmision)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

    for (const event of events) {
      const circuitId = await resolveCircuitId(connection, event.idcircuito);
      if (!circuitId) {
        await connection.rollback();
        return res.status(400).json({ error: `Seleccioná un circuito o A CONFIRMAR para la fecha ${event.ronda}` });
      }
      await connection.query(query, [
        event.idcampeonato,
        event.fecha,
        event.ronda,
        circuitId,
        event.especial ? 1 : 0,
        normalizeSpecialty(event.especial, event.especialidad),
        event.coronacion ? 1 : 0,
        normalizeTransmissionUrl(event.transmision),
      ]);
    }

    await connection.commit();
    res.status(201).json({
      message: `${events.length} fechas agregadas al calendario`,
      data: events,
    });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
};

const update = async (req, res, next) => {
  try {
    const { idcampeonato, fecha, ronda, idcircuito, especial, especialidad, coronacion, transmision } = req.body;
    const { oldIdcampeonato, oldRonda } = req.params;

    if (!idcampeonato || !fecha || !ronda || !idcircuito) {
      return res.status(400).json({ error: 'idcampeonato, fecha, ronda e idcircuito son requeridos' });
    }
    const circuitId = await resolveCircuitId(pool, idcircuito);
    if (!circuitId) return res.status(400).json({ error: 'Seleccioná un circuito o marcá la fecha como A CONFIRMAR' });

    const [result] = await pool.query(
      `UPDATE calendario
       SET idcampeonato=?, fecha=?, ronda=?, idcircuito=?, especial=?, especialidad=?, coronacion=?, transmision=?
       WHERE idcampeonato=? AND ronda=?`,
      [
        idcampeonato,
        fecha,
        ronda,
        circuitId,
        especial ? 1 : 0,
        normalizeSpecialty(especial, especialidad),
        coronacion ? 1 : 0,
        normalizeTransmissionUrl(transmision),
        oldIdcampeonato,
        oldRonda,
      ]
    );

    if (!result.affectedRows) return res.status(404).json({ error: 'Fecha no encontrada' });

    await moveEventGallery(oldIdcampeonato, oldRonda, idcampeonato, ronda);

    res.json({ message: 'Fecha actualizada', data: req.body });
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    const { idcampeonato, ronda } = req.params;
    const [result] = await pool.query(
      'DELETE FROM calendario WHERE idcampeonato = ? AND ronda = ?',
      [idcampeonato, ronda]
    );

    if (!result.affectedRows) return res.status(404).json({ error: 'Fecha no encontrada' });
    const gallery = await getEventGallery(idcampeonato, ronda, false);
    await fs.rm(gallery.directory, { recursive: true, force: true });
    res.json({ message: 'Fecha eliminada del calendario' });
  } catch (err) {
    next(err);
  }
};

const updateMultipliers = async (req, res, next) => {
  try {
    await ensureEventMultipliers();
    const championshipId = Number(req.params.idcampeonato);
    const round = Number(req.params.ronda);
    const sprint = Number(req.body.multiplicador_sprint);
    const final = Number(req.body.multiplicador_final);
    if (!Number.isInteger(championshipId) || championshipId < 1 || !Number.isInteger(round) || round < 1) {
      return res.status(400).json({ error: 'Campeonato o fecha inválidos' });
    }
    if (!Number.isFinite(sprint) || sprint < 0 || sprint > 10 || !Number.isFinite(final) || final < 0 || final > 10) {
      return res.status(400).json({ error: 'Los multiplicadores deben estar entre 0 y 10' });
    }
    const [result] = await pool.query(
      `UPDATE calendario SET multiplicador_sprint = ?, multiplicador_final = ?
       WHERE idcampeonato = ? AND ronda = ?`,
      [sprint, final, championshipId, round]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Fecha no encontrada' });
    res.json({
      message: 'Multiplicadores guardados para la fecha',
      data: { idcampeonato: championshipId, ronda: round, multiplicador_sprint: sprint, multiplicador_final: final },
    });
  } catch (error) {
    next(error);
  }
};

const getBanners = async (req, res, next) => {
  try {
    const gallery = await getEventGallery(req.params.idcampeonato, req.params.ronda);
    if (!gallery) return res.status(404).json({ error: 'Fecha no encontrada' });
    const banners = await listEventBanners(gallery);
    res.json({ data: banners, total: banners.length });
  } catch (error) { next(error); }
};

const uploadBanners = async (req, res, next) => {
  try {
    const gallery = await getEventGallery(req.params.idcampeonato, req.params.ronda);
    if (!gallery) return res.status(404).json({ error: 'Fecha no encontrada' });
    if (!req.files?.length) return res.status(400).json({ error: 'Seleccioná al menos una imagen' });
    await fs.mkdir(gallery.directory, { recursive: true });
    await Promise.all(req.files.map(file => {
      const extension = path.extname(file.originalname).toLowerCase();
      const filename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${extension}`;
      return fs.writeFile(path.join(gallery.directory, filename), file.buffer);
    }));
    const banners = await listEventBanners(gallery);
    res.status(201).json({ data: banners, total: banners.length, message: `${req.files.length} banner${req.files.length === 1 ? '' : 's'} cargado${req.files.length === 1 ? '' : 's'}` });
  } catch (error) { next(error); }
};

const removeBanner = async (req, res, next) => {
  try {
    const gallery = await getEventGallery(req.params.idcampeonato, req.params.ronda);
    if (!gallery) return res.status(404).json({ error: 'Fecha no encontrada' });
    const filename = path.basename(String(req.params.filename || ''));
    if (!filename || filename !== req.params.filename || !eventBannerExtensions.has(path.extname(filename).toLowerCase())) {
      return res.status(400).json({ error: 'Nombre de imagen inválido' });
    }
    try { await fs.unlink(path.join(gallery.directory, filename)); } catch (error) {
      if (error.code === 'ENOENT') return res.status(404).json({ error: 'Banner no encontrado' });
      throw error;
    }
    const banners = await listEventBanners(gallery);
    res.json({ data: banners, total: banners.length, message: 'Banner eliminado' });
  } catch (error) { next(error); }
};

module.exports = { getAll, getUpcoming, create, createBatch, update, updateMultipliers, remove, getBanners, uploadBanners, removeBanner };
