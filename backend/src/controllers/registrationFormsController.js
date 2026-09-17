const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const pool = require('../config/db');
const normalizeCountryCode = require('../utils/countryCode');
const normalizeInstagram = require('../utils/instagram');
const publicDir = require('../utils/publicDir');
const slugify = require('../utils/slugify');

const FORM_TTL_MS = 10 * 60 * 1000;
const tokenSecret = () => process.env.ADMIN_SESSION_SECRET || process.env.DB_PASSWORD;
const capitalize = value => String(value || '').trim().toLocaleLowerCase('es-AR')
  .replace(/(^|\s|-|\/)(\p{L})/gu, (match, separator, letter) => `${separator}${letter.toLocaleUpperCase('es-AR')}`);
const foldText = value => String(value || '').trim().toLocaleLowerCase('es-AR')
  .normalize('NFD').replace(/\p{Diacritic}/gu, '');
const digitsOnly = value => String(value || '').replace(/\D/g, '');
const asBoolean = value => value === true || value === 1 || value === '1' || value === 'true';
const parseIds = value => {
  let values = value;
  if (typeof values === 'string') {
    try { values = JSON.parse(values); } catch { values = values.split(','); }
  }
  return [...new Set((Array.isArray(values) ? values : []).map(Number).filter(Number.isInteger))];
};
const registrationImageExtensions = new Set(['.avif', '.webp', '.jpg', '.jpeg', '.png']);

const getRegistrationGallery = async championshipId => {
  const [[championship]] = await pool.query(
    `SELECT c.temporada, cat.categoria
     FROM campeonatos c JOIN categorias cat ON cat.id = c.idcategoria
     WHERE c.id = ?`,
    [championshipId]
  );
  if (!championship) return null;

  const categorySlug = slugify(championship.categoria);
  const seasonSlug = `temporada-${slugify(championship.temporada)}`;
  const directory = path.join(publicDir, 'media', 'inscripciones', categorySlug, seasonSlug);
  const publicPath = `/media/inscripciones/${categorySlug}/${seasonSlug}`;
  return { ...championship, directory, publicPath };
};

const listRegistrationImages = async gallery => {
  let entries = [];
  try { entries = await fs.readdir(gallery.directory, { withFileTypes: true }); } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  return entries
    .filter(entry => entry.isFile() && registrationImageExtensions.has(path.extname(entry.name).toLowerCase()))
    .map(entry => ({ filename: entry.name, url: `${gallery.publicPath}/${entry.name}` }))
    .sort((a, b) => a.filename.localeCompare(b.filename));
};

const resultPointsExpression = alias => `
  COALESCE(${alias}.presentismo, 0)
  + COALESCE(${alias}.pts_qualy_sprint, 0)
  + COALESCE(${alias}.pts_sprint, 0)
  + COALESCE(${alias}.pts_qualy_final, 0)
  + COALESCE(${alias}.pts_final, 0)
`;

const getPreviousSeasonRanking = async (championshipId, database = pool) => {
  const [[previousChampionship]] = await database.query(
    `SELECT previous.id
     FROM campeonatos current
     JOIN campeonatos previous ON previous.idcategoria = current.idcategoria AND previous.id <> current.id
     WHERE current.id = ?
       AND (
         previous.anio < current.anio
         OR (previous.anio = current.anio AND CAST(previous.temporada AS UNSIGNED) < CAST(current.temporada AS UNSIGNED))
         OR (previous.anio = current.anio AND previous.temporada = current.temporada AND previous.id < current.id)
       )
     ORDER BY previous.anio DESC, CAST(previous.temporada AS UNSIGNED) DESC, previous.id DESC
     LIMIT 1`,
    [championshipId]
  );
  if (!previousChampionship) return { championshipId: null, positions: new Map() };

  const [officialStandings] = await database.query(
    `SELECT idpiloto, posicion
     FROM tablas
     WHERE idcampeonato = ? AND posicion BETWEEN 1 AND 199
     ORDER BY posicion ASC`,
    [previousChampionship.id]
  );
  if (officialStandings.length) {
    return {
      championshipId: previousChampionship.id,
      positions: new Map(officialStandings.map(row => [Number(row.idpiloto), Number(row.posicion)])),
    };
  }

  const [calculatedStandings] = await database.query(
    `SELECT r.idpiloto, p.nombre, ROUND(SUM(${resultPointsExpression('r')}), 2) AS puntos
     FROM resultados r
     JOIN pilotos p ON p.id = r.idpiloto
     WHERE r.idcampeonato = ?
     GROUP BY r.idpiloto, p.nombre
     ORDER BY puntos DESC, p.nombre ASC`,
    [previousChampionship.id]
  );
  return {
    championshipId: previousChampionship.id,
    positions: new Map(calculatedStandings.slice(0, 199).map((row, index) => [Number(row.idpiloto), index + 1])),
  };
};

const createFormToken = championshipId => {
  const expiresAt = Date.now() + FORM_TTL_MS;
  const payload = `${championshipId}.${expiresAt}.${crypto.randomBytes(12).toString('hex')}`;
  const signature = crypto.createHmac('sha256', tokenSecret()).update(payload).digest('base64url');
  return { token: `${payload}.${signature}`, expiresAt: new Date(expiresAt).toISOString() };
};

const verifyFormToken = (token, championshipId) => {
  const parts = String(token || '').split('.');
  if (parts.length !== 4 || Number(parts[0]) !== Number(championshipId) || Number(parts[1]) <= Date.now()) return false;
  const payload = parts.slice(0, 3).join('.');
  const expected = Buffer.from(crypto.createHmac('sha256', tokenSecret()).update(payload).digest('base64url'));
  const received = Buffer.from(parts[3]);
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
};

const configSelect = `
  SELECT cfg.idcampeonato, cfg.fecha_apertura, cfg.fecha_cierre,
         cfg.precio, cfg.precio_diseno, cfg.setup_detalle, cfg.limite_inscriptos, cfg.preinscriptos, cfg.autos_habilitados,
         cfg.permite_personalizado, cfg.permite_diseno_liga, cfg.permite_extra,
         c.temporada, c.anio, c.plataforma, c.reglamento, c.idcategoria,
         cat.categoria, cat.logo AS categoria_logo,
         COUNT(DISTINCT cal.ronda) AS cantidad_fechas,
         (SELECT COUNT(*) FROM inscriptos i WHERE i.idcampeonato = cfg.idcampeonato AND i.pago = 1) AS inscriptos_actuales,
         CASE
           WHEN NOW() < cfg.fecha_apertura THEN 'upcoming'
           WHEN NOW() >= cfg.fecha_cierre THEN 'closed'
           WHEN (SELECT COUNT(*) FROM inscriptos i WHERE i.idcampeonato = cfg.idcampeonato AND i.pago = 1) + cfg.preinscriptos >= cfg.limite_inscriptos THEN 'full'
           ELSE 'open'
         END AS phase
  FROM inscripciones_config cfg
  JOIN campeonatos c ON c.id = cfg.idcampeonato
  JOIN categorias cat ON cat.id = c.idcategoria
  LEFT JOIN calendario cal ON cal.idcampeonato = c.id
`;

const normalizeConfig = row => {
  let enabledCars = row.autos_habilitados;
  if (typeof enabledCars === 'string') {
    try { enabledCars = JSON.parse(enabledCars); } catch { enabledCars = []; }
  }
  const enabledCarIds = parseIds(enabledCars);
  const totalLimit = Number(row.limite_inscriptos);
  const registered = Number(row.inscriptos_actuales);
  const preEnrolled = Number(row.preinscriptos || 0);
  const occupied = registered + preEnrolled;
  return {
    ...row,
    permite_personalizado: Boolean(row.permite_personalizado),
    permite_diseno_liga: Boolean(row.permite_diseno_liga),
    permite_extra: Boolean(row.permite_extra),
    autos_habilitados: enabledCarIds,
    limite_por_modelo: enabledCarIds.length ? Math.ceil(totalLimit / enabledCarIds.length) : 0,
    preinscriptos: preEnrolled,
    cupos_ocupados: Math.min(totalLimit, occupied),
    lugares_disponibles: Math.max(0, totalLimit - occupied),
    phase: row.phase,
  };
};

const loadForm = async id => {
  const [[row]] = await pool.query(`${configSelect} WHERE cfg.idcampeonato = ? GROUP BY cfg.idcampeonato`, [id]);
  if (!row) return null;
  const config = normalizeConfig(row);
  const [calendar] = await pool.query(
    `SELECT cal.ronda, cal.fecha, cal.especial, cal.especialidad, cal.coronacion,
            ci.id AS idcircuito, ci.nombre AS circuito, ci.variante, ci.localidad, ci.provincia, ci.pais, ci.imagen, ci.trazado
     FROM calendario cal JOIN circuitos ci ON ci.id = cal.idcircuito
     WHERE cal.idcampeonato = ? ORDER BY cal.ronda`, [id]
  );
  const carIds = config.autos_habilitados;
  let cars = [];
  if (carIds.length) {
    const [rows] = await pool.query(
      `SELECT a.id, a.idcategoria, a.modelo, a.imagen, am.marca, am.logo,
              SUM(CASE WHEN i.pago = 1 THEN 1 ELSE 0 END) AS ocupados_modelo,
              SUM(CASE WHEN i.pago = 0 THEN 1 ELSE 0 END) AS lista_espera_modelo
       FROM autos a JOIN autos_marcas am ON am.id = a.marca
       LEFT JOIN inscriptos i ON i.idcampeonato = ? AND i.idauto = a.id
       WHERE a.id IN (?) AND a.idcategoria = ?
       GROUP BY a.id, a.idcategoria, a.modelo, a.imagen, am.marca, am.logo
       ORDER BY am.marca, a.modelo`,
      [id, carIds, config.idcategoria]
    );
    cars = rows.map(car => ({
      ...car,
      limite_modelo: config.limite_por_modelo,
      lugares_modelo: Math.max(0, config.limite_por_modelo - Number(car.ocupados_modelo)),
      disponible: Number(car.ocupados_modelo) < config.limite_por_modelo,
    }));
  }
  return {
    ...config,
    calendario: calendar.map(event => ({
      ...event,
      circuito_foto_url: event.imagen || `/media/circuitos/fotos/${slugify(event.circuito)}.png`,
      circuito_trazado_url: event.trazado || `/media/circuitos/trazados/${slugify(event.circuito)}.png`,
    })),
    autos: cars,
  };
};

const getPublicAll = async (req, res, next) => {
  try {
    const [rows] = await pool.query(`${configSelect} GROUP BY cfg.idcampeonato ORDER BY c.anio DESC, c.temporada DESC`);
    res.json({ data: rows.map(normalizeConfig) });
  } catch (error) { next(error); }
};

const getPublicOne = async (req, res, next) => {
  try {
    const form = await loadForm(req.params.id);
    if (!form) return res.status(404).json({ error: 'Formulario de inscripción no configurado' });
    res.json({ data: form });
  } catch (error) { next(error); }
};

const start = async (req, res, next) => {
  try {
    const form = await loadForm(req.params.id);
    if (!form) return res.status(404).json({ error: 'Formulario de inscripción no configurado' });
    if (form.phase !== 'open') return res.status(409).json({ error: 'Las inscripciones no están abiertas' });
    res.json({ data: createFormToken(req.params.id) });
  } catch (error) { next(error); }
};

const searchDrivers = async (req, res, next) => {
  try {
    if (!verifyFormToken(req.query.formToken, req.params.id)) {
      return res.status(410).json({ error: 'El formulario venció. Volvé a comenzar la inscripción.' });
    }
    const search = String(req.query.search || '').trim();
    if (search.length < 2) return res.json({ data: [] });
    const [rows] = await pool.query(
      `SELECT id, nombre, localidad, provincia, telefono, nacionalidad, steam, ig
       FROM pilotos ORDER BY nombre`
    );
    const normalizedSearch = foldText(search);
    const ranking = await getPreviousSeasonRanking(req.params.id);
    const matches = rows.filter(driver => foldText(driver.nombre).includes(normalizedSearch)).slice(0, 8)
      .map(driver => ({
        ...driver,
        ranking_position: ranking.positions.get(Number(driver.id)) || null,
        ranking_championship_id: ranking.championshipId,
      }));
    res.json({ data: matches });
  } catch (error) { next(error); }
};

const checkNumber = async (req, res, next) => {
  try {
    const number = Number(req.params.number);
    if (!Number.isInteger(number) || number < 1 || number > 199) return res.status(400).json({ error: 'El número debe estar entre 1 y 199' });
    const driverId = Number(req.query.idpiloto) || null;
    const [[row]] = await pool.query('SELECT idpiloto FROM inscriptos WHERE idcampeonato = ? AND numero = ? LIMIT 1', [req.params.id, number]);
    const ranking = await getPreviousSeasonRanking(req.params.id);
    const rankedPosition = driverId ? ranking.positions.get(driverId) || null : null;
    const reservedDriver = [...ranking.positions.entries()].find(([, position]) => position === number)?.[0] || null;
    const available = !row
      && (!rankedPosition || rankedPosition === number)
      && (!reservedDriver || reservedDriver === driverId);
    res.json({ data: {
      available,
      ranked: Boolean(rankedPosition),
      assignedNumber: rankedPosition,
      reason: row ? 'occupied' : rankedPosition && rankedPosition !== number ? 'ranked_number' : reservedDriver && reservedDriver !== driverId ? 'reserved_ranking' : null,
    } });
  } catch (error) { next(error); }
};

const getAdminAll = async (req, res, next) => {
  try {
    const [rows] = await pool.query(`${configSelect} GROUP BY cfg.idcampeonato ORDER BY c.anio DESC, c.temporada DESC`);
    res.json({ data: rows.map(normalizeConfig) });
  } catch (error) { next(error); }
};

const getAdminImages = async (req, res, next) => {
  try {
    const gallery = await getRegistrationGallery(req.params.id);
    if (!gallery) return res.status(404).json({ error: 'Campeonato no encontrado' });
    const images = await listRegistrationImages(gallery);
    res.json({ data: images, total: images.length, path: gallery.publicPath });
  } catch (error) { next(error); }
};

const uploadAdminImages = async (req, res, next) => {
  try {
    const gallery = await getRegistrationGallery(req.params.id);
    if (!gallery) return res.status(404).json({ error: 'Campeonato no encontrado' });
    if (!req.files?.length) return res.status(400).json({ error: 'Seleccioná al menos una foto' });

    await fs.mkdir(gallery.directory, { recursive: true });
    await Promise.all(req.files.map(file => {
      const extension = path.extname(file.originalname).toLowerCase();
      const filename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${extension}`;
      return fs.writeFile(path.join(gallery.directory, filename), file.buffer);
    }));

    const images = await listRegistrationImages(gallery);
    res.status(201).json({ data: images, total: images.length, path: gallery.publicPath, message: `${req.files.length} foto${req.files.length === 1 ? '' : 's'} cargada${req.files.length === 1 ? '' : 's'}` });
  } catch (error) { next(error); }
};

const removeAdminImage = async (req, res, next) => {
  try {
    const gallery = await getRegistrationGallery(req.params.id);
    if (!gallery) return res.status(404).json({ error: 'Campeonato no encontrado' });
    const filename = path.basename(String(req.params.filename || ''));
    if (!filename || filename !== req.params.filename || !registrationImageExtensions.has(path.extname(filename).toLowerCase())) {
      return res.status(400).json({ error: 'Nombre de imagen inválido' });
    }

    try { await fs.unlink(path.join(gallery.directory, filename)); } catch (error) {
      if (error.code === 'ENOENT') return res.status(404).json({ error: 'Imagen no encontrada' });
      throw error;
    }
    const images = await listRegistrationImages(gallery);
    res.json({ data: images, total: images.length, path: gallery.publicPath, message: 'Foto eliminada' });
  } catch (error) { next(error); }
};

const saveConfig = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const openAt = String(req.body.fecha_apertura || '').replace('T', ' ');
    const closeAt = String(req.body.fecha_cierre || '').replace('T', ' ');
    const price = Number(req.body.precio);
    const designPrice = Number(req.body.precio_diseno);
    const registrationLimit = Number(req.body.limite_inscriptos);
    const preEnrolled = Number(req.body.preinscriptos || 0);
    const setupDetails = String(req.body.setup_detalle || '').trim();
    const carIds = parseIds(req.body.autos_habilitados);
    if (!id || !openAt || !closeAt || new Date(closeAt) <= new Date(openAt)) {
      return res.status(400).json({ error: 'Las fechas de apertura y cierre no son válidas' });
    }
    if (!Number.isFinite(price) || price < 0) return res.status(400).json({ error: 'El precio no es válido' });
    if (!Number.isFinite(designPrice) || designPrice < 0) return res.status(400).json({ error: 'El precio adicional del diseño no es válido' });
    if (!Number.isInteger(registrationLimit) || registrationLimit < 1 || registrationLimit > 65535) {
      return res.status(400).json({ error: 'El límite de inscriptos debe ser mayor a cero' });
    }
    if (!Number.isInteger(preEnrolled) || preEnrolled < 0 || preEnrolled > registrationLimit) {
      return res.status(400).json({ error: 'Los preinscriptos deben estar entre cero y el límite total' });
    }
    if (!carIds.length) return res.status(400).json({ error: 'Habilitá al menos un modelo de auto' });
    if (!setupDetails) return res.status(400).json({ error: 'Ingresá los detalles del setup' });
    const [[championship]] = await pool.query('SELECT idcategoria FROM campeonatos WHERE id = ?', [id]);
    if (!championship) return res.status(404).json({ error: 'Campeonato no encontrado' });
    if (carIds.length) {
      const [validCars] = await pool.query('SELECT id FROM autos WHERE id IN (?) AND idcategoria = ?', [carIds, championship.idcategoria]);
      if (validCars.length !== carIds.length) return res.status(400).json({ error: 'Hay autos que no pertenecen a la categoría' });
    }
    const options = [asBoolean(req.body.permite_personalizado), asBoolean(req.body.permite_diseno_liga), asBoolean(req.body.permite_extra)];
    if (!options.some(Boolean)) return res.status(400).json({ error: 'Habilitá al menos una modalidad de diseño' });
    await pool.query(
      `INSERT INTO inscripciones_config
       (idcampeonato, fecha_apertura, fecha_cierre, precio, precio_diseno, setup_detalle, limite_inscriptos,
        preinscriptos, autos_habilitados, permite_personalizado, permite_diseno_liga, permite_extra)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE fecha_apertura=VALUES(fecha_apertura),
       fecha_cierre=VALUES(fecha_cierre), precio=VALUES(precio), precio_diseno=VALUES(precio_diseno),
       setup_detalle=VALUES(setup_detalle), limite_inscriptos=VALUES(limite_inscriptos), preinscriptos=VALUES(preinscriptos), autos_habilitados=VALUES(autos_habilitados),
       permite_personalizado=VALUES(permite_personalizado), permite_diseno_liga=VALUES(permite_diseno_liga),
       permite_extra=VALUES(permite_extra)`,
      [id, openAt, closeAt, price, designPrice, setupDetails, registrationLimit, preEnrolled,
        JSON.stringify(carIds), ...options.map(value => value ? 1 : 0)]
    );
    res.json({ message: 'Formulario de inscripción guardado', data: await loadForm(id) });
  } catch (error) { next(error); }
};

const submit = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const id = Number(req.params.id);
    if (!verifyFormToken(req.body.formToken, id)) return res.status(410).json({ error: 'El formulario venció. Volvé a comenzar la inscripción.' });
    const form = await loadForm(id);
    if (!form || form.phase !== 'open') return res.status(409).json({ error: 'Las inscripciones no están abiertas' });
    const modality = String(req.body.modalidad_diseno || '');
    const allowedModalities = {
      personalizado: form.permite_personalizado,
      personalizado_liga: form.permite_diseno_liga,
      extra: form.permite_extra,
    };
    if (!allowedModalities[modality]) return res.status(400).json({ error: 'Modalidad de diseño no habilitada' });
    const carId = Number(req.body.idauto);
    if (!form.autos_habilitados.includes(carId)) return res.status(400).json({ error: 'El auto seleccionado no está habilitado' });
    const submittedDriverId = Number(req.body.idpiloto) || null;
    let number = modality === 'extra' ? 0 : Number(req.body.numero);
    const ranking = modality === 'extra'
      ? { positions: new Map() }
      : await getPreviousSeasonRanking(id, connection);
    const rankedPosition = submittedDriverId ? ranking.positions.get(submittedDriverId) || null : null;
    if (rankedPosition) number = rankedPosition;
    if (modality !== 'extra' && (!Number.isInteger(number) || number < 1 || number > 199)) {
      return res.status(400).json({ error: 'El número debe estar entre 1 y 199' });
    }
    const reservedDriver = modality === 'extra'
      ? null
      : [...ranking.positions.entries()].find(([, position]) => position === number)?.[0] || null;
    if (reservedDriver && reservedDriver !== submittedDriverId) {
      return res.status(409).json({ error: `El número ${number} está reservado para un piloto rankeado` });
    }
    const driver = {
      nombre: capitalize(req.body.nombre), localidad: capitalize(req.body.localidad),
      provincia: capitalize(req.body.provincia), telefono: digitsOnly(req.body.telefono),
      nacionalidad: normalizeCountryCode(req.body.nacionalidad), steam: String(req.body.steam || '').trim(),
      ig: normalizeInstagram(req.body.ig),
    };
    if (!driver.nombre) return res.status(400).json({ error: 'Completá el nombre y apellido' });

    await connection.beginTransaction();
    const [[lockedConfig]] = await connection.query(
      `SELECT limite_inscriptos, preinscriptos, autos_habilitados, fecha_apertura, fecha_cierre,
              CASE WHEN NOW() >= fecha_apertura AND NOW() < fecha_cierre THEN 1 ELSE 0 END AS inscripcion_abierta
       FROM inscripciones_config
       WHERE idcampeonato = ? FOR UPDATE`, [id]
    );
    if (!lockedConfig || !Number(lockedConfig.inscripcion_abierta)) {
      throw Object.assign(new Error('Las inscripciones ya no están abiertas'), { statusCode: 409 });
    }
    const [[registrationCount]] = await connection.query(
      'SELECT COUNT(*) AS total FROM inscriptos WHERE idcampeonato = ? AND pago = 1', [id]
    );
    if (Number(registrationCount.total) + Number(lockedConfig.preinscriptos || 0) >= Number(lockedConfig.limite_inscriptos)) {
      throw Object.assign(new Error('No quedan cupos disponibles en el campeonato'), { statusCode: 409 });
    }
    const lockedCarIds = parseIds(lockedConfig.autos_habilitados);
    const modelLimit = lockedCarIds.length ? Math.ceil(Number(lockedConfig.limite_inscriptos) / lockedCarIds.length) : 0;
    const [[modelCount]] = await connection.query(
      'SELECT COUNT(*) AS total FROM inscriptos WHERE idcampeonato = ? AND idauto = ? AND pago = 1', [id, carId]
    );
    if (!lockedCarIds.includes(carId) || Number(modelCount.total) >= modelLimit) {
      throw Object.assign(new Error('El modelo seleccionado ya no tiene lugares disponibles'), { statusCode: 409 });
    }
    let driverId = Number(req.body.idpiloto);
    if (driverId) {
      const [[existing]] = await connection.query('SELECT id, nombre FROM pilotos WHERE id = ? FOR UPDATE', [driverId]);
      if (!existing) throw Object.assign(new Error('Piloto no encontrado'), { statusCode: 404 });
      driver.nombre = existing.nombre;
      const duplicateConditions = [];
      const duplicateParams = [driverId];
      if (driver.telefono) { duplicateConditions.push('telefono=?'); duplicateParams.push(driver.telefono); }
      if (driver.steam) { duplicateConditions.push('LOWER(steam)=LOWER(?)'); duplicateParams.push(driver.steam); }
      let duplicateDriver = null;
      if (duplicateConditions.length) {
        [[duplicateDriver]] = await connection.query(
          `SELECT id FROM pilotos WHERE id <> ? AND (${duplicateConditions.join(' OR ')}) LIMIT 1 FOR UPDATE`,
          duplicateParams
        );
      }
      if (duplicateDriver) throw Object.assign(new Error('Los datos modificados pertenecen a otro piloto.'), { statusCode: 409 });
      await connection.query(
        'UPDATE pilotos SET nombre=?, localidad=?, provincia=?, telefono=?, nacionalidad=?, steam=?, ig=? WHERE id=?',
        [driver.nombre, driver.localidad, driver.provincia, driver.telefono, driver.nacionalidad, driver.steam, driver.ig, driverId]
      );
    } else {
      const duplicateConditions = ['LOWER(nombre)=LOWER(?)'];
      const duplicateParams = [driver.nombre];
      if (driver.telefono) { duplicateConditions.push('telefono=?'); duplicateParams.push(driver.telefono); }
      if (driver.steam) { duplicateConditions.push('LOWER(steam)=LOWER(?)'); duplicateParams.push(driver.steam); }
      const [[duplicate]] = await connection.query(
        `SELECT id FROM pilotos WHERE ${duplicateConditions.join(' OR ')} LIMIT 1 FOR UPDATE`, duplicateParams
      );
      if (duplicate) throw Object.assign(new Error('Ya existe un piloto con esos datos. Buscalo por su nombre.'), { statusCode: 409 });
      const [created] = await connection.query(
        'INSERT INTO pilotos (nombre, localidad, provincia, telefono, nacionalidad, steam, ig) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [driver.nombre, driver.localidad, driver.provincia, driver.telefono, driver.nacionalidad, driver.steam, driver.ig]
      );
      driverId = created.insertId;
    }
    const [[duplicateRegistration]] = await connection.query(
      `SELECT idpiloto, numero FROM inscriptos
       WHERE idcampeonato=? AND (idpiloto=? OR (? > 0 AND numero=?)) LIMIT 1 FOR UPDATE`,
      [id, driverId, number, number]
    );
    if (duplicateRegistration) {
      const message = Number(duplicateRegistration.idpiloto) === driverId
        ? 'El piloto ya está inscripto en este campeonato' : `El número ${number} ya está ocupado`;
      throw Object.assign(new Error(message), { statusCode: 409 });
    }
    await connection.query(
      'INSERT INTO inscriptos (idcampeonato, idpiloto, idauto, numero, pago) VALUES (?, ?, ?, ?, 0)',
      [id, driverId, carId, number]
    );
    await connection.query(
      'INSERT INTO inscripciones_detalle (idcampeonato, idpiloto, modalidad_diseno) VALUES (?, ?, ?)',
      [id, driverId, modality]
    );
    await connection.commit();
    res.status(201).json({ message: 'Inscripción registrada correctamente' });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally { connection.release(); }
};

const removeConfig = async (req, res, next) => {
  try {
    const [result] = await pool.query('DELETE FROM inscripciones_config WHERE idcampeonato = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Formulario no encontrado' });
    res.json({ message: 'Formulario eliminado. Las inscripciones existentes se conservaron.' });
  } catch (error) { next(error); }
};

module.exports = { checkNumber, getAdminAll, getAdminImages, getPublicAll, getPublicOne, removeAdminImage, removeConfig, saveConfig, searchDrivers, start, submit, uploadAdminImages };
