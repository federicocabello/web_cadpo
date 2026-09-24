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
const parseIds = value => {
  let values = value;
  if (typeof values === 'string') {
    try { values = JSON.parse(values); } catch { values = values.split(','); }
  }
  return [...new Set((Array.isArray(values) ? values : []).map(Number).filter(Number.isInteger))];
};
const planTypes = new Set(['sin_numero', 'con_numero', 'pintura_oficial']);
const fixedPlanDefinitions = [
  { id: 'extra', titulo: 'Extra sin diseño', descripcion: 'Participás con un auto genérico completamente gris, sin diseño personalizado.', precio_adicional: 0, tipo: 'sin_numero', habilitado: true, autos_habilitados: [] },
  { id: 'personalizado', titulo: 'Personalizado', descripcion: 'Vos mismo diseñás y presentás el diseño de tu auto.', precio_adicional: 0, tipo: 'con_numero', habilitado: true, autos_habilitados: [] },
  { id: 'diseno_liga', titulo: 'Diseño de la liga', descripcion: 'Nuestro diseñador te asesora y diseña el auto a tu gusto, con tus colores, publicidades y detalles.', precio_adicional: 0, tipo: 'con_numero', habilitado: true, autos_habilitados: [] },
  { id: 'diseno_oficial', titulo: 'Diseño oficial', descripcion: 'Elegís un diseño oficial de la categoría utilizado en la realidad.', precio_adicional: 0, tipo: 'pintura_oficial', habilitado: false, autos_habilitados: [] },
];
const legacyPlanDescriptions = new Set([
  'Participás sin pintura personalizada y sin elegir número.',
  'Presentás tu propio diseño y elegís el número del auto.',
  'Nuestro diseñador te asesora y prepara el diseño del auto.',
  'El diseñador de la liga te asesora y prepara el auto.',
  'Competís con uno de los diseños oficiales disponibles.',
]);
const planAliases = {
  extra: ['extra', 'extra-sin-diseno'],
  personalizado: ['personalizado', 'diseno-propio'],
  diseno_liga: ['diseno_liga', 'diseno-liga', 'personalizado_liga'],
  diseno_oficial: ['diseno_oficial', 'pintura_oficial'],
};
const parsePlans = value => {
  let plans = value;
  if (typeof plans === 'string') {
    try { plans = JSON.parse(plans); } catch { plans = []; }
  }
  if (!Array.isArray(plans)) return [];
  return plans.map((plan, index) => ({
    id: String(plan?.id || `plan-${index + 1}`).trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64),
    titulo: String(plan?.titulo || '').trim().slice(0, 120),
    descripcion: String(plan?.descripcion || '').trim().slice(0, 600),
    precio_adicional: Number(plan?.precio_adicional || 0),
    tipo: planTypes.has(plan?.tipo) ? plan.tipo : 'con_numero',
    habilitado: plan?.habilitado !== false,
    autos_habilitados: parseIds(plan?.autos_habilitados),
  }));
};
const normalizeFixedPlans = row => {
  const configured = parsePlans(row.planes);
  const legacyEnabled = {
    extra: Boolean(row.permite_extra),
    personalizado: Boolean(row.permite_personalizado),
    diseno_liga: Boolean(row.permite_diseno_liga),
    diseno_oficial: Boolean(row.permite_pintura_oficial),
  };
  return fixedPlanDefinitions.map(definition => {
    const existing = configured.find(plan => planAliases[definition.id].includes(plan.id));
    const legacyPrice = definition.id === 'diseno_liga'
      ? Number(row.precio_diseno || 0)
      : definition.id === 'diseno_oficial' ? Number(row.precio_pintura_oficial || 0) : 0;
    return {
      ...definition,
      ...(existing || {}),
      id: definition.id,
      tipo: definition.tipo,
      descripcion: !existing?.descripcion || legacyPlanDescriptions.has(existing.descripcion)
        ? definition.descripcion
        : existing.descripcion,
      habilitado: existing ? existing.habilitado : legacyEnabled[definition.id],
      precio_adicional: ['diseno_liga', 'diseno_oficial'].includes(definition.id)
        ? Number(existing?.precio_adicional ?? legacyPrice) : 0,
      autos_habilitados: definition.id === 'diseno_oficial'
        ? parseIds(existing?.autos_habilitados || row.autos_habilitados) : [],
    };
  });
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

const listOfficialCars = async championshipId => {
  const [rows] = await pool.query(
    `SELECT official.id, official.idcampeonato, official.idauto, official.numero,
            official.descripcion, official.foto,
            a.modelo, am.id AS idmarca, am.marca, am.logo,
            EXISTS(
              SELECT 1 FROM inscriptos i
              WHERE i.idcampeonato = official.idcampeonato AND i.numero = official.numero
            ) AS ocupado
     FROM inscripciones_autos_oficiales official
     JOIN autos a ON a.id = official.idauto
     JOIN autos_marcas am ON am.id = a.marca
     WHERE official.idcampeonato = ?
     ORDER BY am.marca, a.modelo, official.numero`,
    [championshipId],
  );
  return rows.map(row => ({ ...row, ocupado: Boolean(row.ocupado) }));
};

const officialCarsDirectory = gallery => ({
  directory: path.join(gallery.directory, 'oficiales'),
  publicPath: `${gallery.publicPath}/oficiales`,
});

const removePublicFile = async publicPath => {
  if (!publicPath) return;
  const target = path.resolve(publicDir, String(publicPath).replace(/^[/\\]+/, ''));
  const allowedRoot = path.resolve(publicDir, 'media', 'inscripciones');
  if (!target.startsWith(`${allowedRoot}${path.sep}`)) return;
  try { await fs.unlink(target); } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
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
       AND previous.id < current.id
     ORDER BY previous.id DESC
     LIMIT 1`,
    [championshipId]
  );
  if (!previousChampionship) return { championshipId: null, positions: new Map() };

  const [officialStandings] = await database.query(
    `SELECT idpiloto, posicion
     FROM tablas
     WHERE idcampeonato = ? AND posicion BETWEEN 1 AND 255
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
    positions: new Map(calculatedStandings.slice(0, 255).map((row, index) => [Number(row.idpiloto), index + 1])),
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
         cfg.precio, cfg.precio_diseno, cfg.precio_pintura_oficial, cfg.setup_detalle, cfg.limite_inscriptos, cfg.limite_por_modelo, cfg.preinscriptos, cfg.autos_habilitados, cfg.planes,
         cfg.permite_personalizado, cfg.permite_diseno_liga, cfg.permite_pintura_oficial, cfg.permite_extra,
         c.temporada, c.anio, c.plataforma, c.reglamento, c.idcategoria,
         cat.categoria, cat.logo AS categoria_logo,
         COUNT(DISTINCT cal.ronda) AS cantidad_fechas,
         (SELECT COUNT(*) FROM inscriptos i WHERE i.idcampeonato = cfg.idcampeonato AND i.pago = 1) AS inscriptos_actuales,
         CASE
           WHEN NOW() < cfg.fecha_apertura THEN 'upcoming'
           WHEN NOW() >= cfg.fecha_cierre THEN 'closed'
           WHEN (SELECT COUNT(*) FROM inscriptos i WHERE i.idcampeonato = cfg.idcampeonato AND i.pago = 1) >= cfg.limite_inscriptos THEN 'full'
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
  const modelLimit = enabledCarIds.length ? Math.ceil(totalLimit / enabledCarIds.length) : 0;
  const registered = Number(row.inscriptos_actuales);
  const preEnrolled = Number(row.preinscriptos || 0);
  const occupied = registered + preEnrolled;
  return {
    ...row,
    permite_personalizado: Boolean(row.permite_personalizado),
    permite_diseno_liga: Boolean(row.permite_diseno_liga),
    permite_pintura_oficial: Boolean(row.permite_pintura_oficial),
    permite_extra: Boolean(row.permite_extra),
    autos_habilitados: enabledCarIds,
    planes: normalizeFixedPlans(row),
    limite_por_modelo: modelLimit,
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
              SUM(CASE WHEN i.pago = 1
                AND i.idauto_oficial IS NULL
                AND COALESCE(i.tipo_inscripcion, '') <> 'diseno_oficial'
                AND NOT EXISTS (
                  SELECT 1 FROM inscripciones_autos_oficiales official
                  WHERE official.idcampeonato = i.idcampeonato
                    AND official.idauto = i.idauto AND official.numero = i.numero
                ) THEN 1 ELSE 0 END) AS ocupados_modelo,
              SUM(CASE WHEN i.pago = 0
                AND i.idauto_oficial IS NULL
                AND COALESCE(i.tipo_inscripcion, '') <> 'diseno_oficial'
                AND NOT EXISTS (
                  SELECT 1 FROM inscripciones_autos_oficiales official
                  WHERE official.idcampeonato = i.idcampeonato
                    AND official.idauto = i.idauto AND official.numero = i.numero
                ) THEN 1 ELSE 0 END) AS lista_espera_modelo
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
  const officialCars = await listOfficialCars(id);
  return {
    ...config,
    calendario: calendar.map(event => ({
      ...event,
      circuito_foto_url: event.imagen || `/media/circuitos/fotos/${slugify(event.circuito)}.png`,
      circuito_trazado_url: event.trazado || `/media/circuitos/trazados/${slugify(event.circuito)}.png`,
    })),
    autos: cars,
    autos_oficiales: officialCars,
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
    if (!Number.isInteger(number) || number < 1 || number > 255) return res.status(400).json({ error: 'El número debe estar entre 1 y 255' });
    const driverId = Number(req.query.idpiloto) || null;
    const ranking = await getPreviousSeasonRanking(req.params.id);
    const rankedPosition = driverId ? ranking.positions.get(driverId) || null : null;
    const reservedDriver = [...ranking.positions.entries()].find(([, position]) => position === number)?.[0] || null;
    const [numberRegistrationResult, officialNumberResult, rankedOfficialNumberResult] = await Promise.all([
      pool.query(
        'SELECT idpiloto FROM inscriptos WHERE idcampeonato = ? AND numero = ? LIMIT 1',
        [req.params.id, number],
      ),
      pool.query(
        'SELECT id FROM inscripciones_autos_oficiales WHERE idcampeonato = ? AND numero = ? LIMIT 1',
        [req.params.id, number],
      ),
      rankedPosition ? pool.query(
        'SELECT id FROM inscripciones_autos_oficiales WHERE idcampeonato = ? AND numero = ? LIMIT 1',
        [req.params.id, rankedPosition],
      ) : Promise.resolve([[]]),
    ]);
    const numberRegistration = numberRegistrationResult[0][0] || null;
    const officialNumber = officialNumberResult[0][0] || null;
    const rankedNumberReservedByOfficial = Boolean(rankedOfficialNumberResult[0][0]);
    const available = !numberRegistration
      && !officialNumber
      && (!rankedPosition || rankedNumberReservedByOfficial || rankedPosition === number)
      && (!reservedDriver || reservedDriver === driverId);
    res.json({ data: {
      available,
      ranked: Boolean(rankedPosition),
      assignedNumber: rankedPosition,
      rankedNumberReservedByOfficial,
      canChangeRankedNumber: Boolean(rankedPosition && rankedNumberReservedByOfficial),
      reason: numberRegistration ? 'occupied'
        : officialNumber ? 'reserved_official'
          : rankedPosition && !rankedNumberReservedByOfficial && rankedPosition !== number ? 'ranked_number'
            : reservedDriver && reservedDriver !== driverId ? 'reserved_ranking' : null,
    } });
  } catch (error) { next(error); }
};

const checkRegistrationAvailability = async (req, res, next) => {
  try {
    const championshipId = Number(req.params.id);
    if (!verifyFormToken(req.body.formToken, championshipId)) {
      return res.status(410).json({ error: 'El formulario venció. Volvé a comenzar la inscripción.' });
    }
    const driverId = Number(req.body.idpiloto) || null;
    const number = Number(req.body.numero) || 0;
    const officialCarId = Number(req.body.idauto_oficial) || null;
    let driverRegistration = null;
    if (driverId) {
      [[driverRegistration]] = await pool.query(
        'SELECT numero FROM inscriptos WHERE idcampeonato = ? AND idpiloto = ? LIMIT 1',
        [championshipId, driverId],
      );
    }
    if (driverRegistration) {
      return res.json({ data: { available: false, reason: 'driver_registered' }, message: 'El piloto ya está inscripto en este campeonato, aunque su pago todavía no esté confirmado.' });
    }
    if (number > 0) {
      const [[numberRegistration]] = await pool.query(
        'SELECT idpiloto FROM inscriptos WHERE idcampeonato = ? AND numero = ? LIMIT 1',
        [championshipId, number],
      );
      if (numberRegistration) {
        return res.json({ data: { available: false, reason: 'number_occupied' }, message: `El número ${number} ya está ocupado por otra inscripción, aunque el pago todavía no esté confirmado.` });
      }
      const [[officialNumber]] = await pool.query(
        'SELECT id FROM inscripciones_autos_oficiales WHERE idcampeonato = ? AND numero = ? LIMIT 1',
        [championshipId, number],
      );
      if (officialNumber && Number(officialNumber.id) !== officialCarId) {
        return res.json({ data: { available: false, reason: 'number_reserved_official' }, message: `El número ${number} está reservado para una pintura oficial. Elegí otro número.` });
      }
      const ranking = await getPreviousSeasonRanking(championshipId);
      const rankedPosition = driverId ? ranking.positions.get(driverId) || null : null;
      const reservedDriver = [...ranking.positions.entries()].find(([, position]) => position === number)?.[0] || null;
      let rankedNumberReservedByOfficial = false;
      if (rankedPosition && !officialCarId) {
        const [[rankedOfficialNumber]] = await pool.query(
          'SELECT id FROM inscripciones_autos_oficiales WHERE idcampeonato = ? AND numero = ? LIMIT 1',
          [championshipId, rankedPosition],
        );
        rankedNumberReservedByOfficial = Boolean(rankedOfficialNumber);
      }
      if (!officialCarId && rankedPosition && !rankedNumberReservedByOfficial && number !== rankedPosition) {
        return res.json({ data: { available: false, reason: 'ranked_number' }, message: `Por ranking te corresponde el número ${rankedPosition}.` });
      }
      if (!officialCarId && reservedDriver && reservedDriver !== driverId) {
        return res.json({ data: { available: false, reason: 'number_reserved_ranking' }, message: `El número ${number} está reservado para otro piloto rankeado.` });
      }
    }
    if (officialCarId) {
      const [[officialCar]] = await pool.query(
        'SELECT numero FROM inscripciones_autos_oficiales WHERE id = ? AND idcampeonato = ? LIMIT 1',
        [officialCarId, championshipId],
      );
      if (!officialCar || Number(officialCar.numero) !== number) {
        return res.json({ data: { available: false, reason: 'official_car_unavailable' }, message: 'El diseño oficial seleccionado ya no está disponible.' });
      }
    }
    res.json({ data: { available: true } });
  } catch (error) { next(error); }
};

const getPreviousRanking = async (req, res, next) => {
  try {
    if (!verifyFormToken(req.query.formToken, req.params.id)) {
      return res.status(410).json({ error: 'El formulario venció. Volvé a comenzar la inscripción.' });
    }
    const ranking = await getPreviousSeasonRanking(req.params.id);
    if (!ranking.championshipId || !ranking.positions.size) {
      return res.json({ data: { campeonato: null, pilotos: [] } });
    }
    const driverIds = [...ranking.positions.keys()];
    const [championshipResult, driversResult] = await Promise.all([
      pool.query(
        `SELECT c.id, c.temporada, c.anio, cat.categoria
         FROM campeonatos c JOIN categorias cat ON cat.id = c.idcategoria
         WHERE c.id = ?`,
        [ranking.championshipId],
      ),
      pool.query('SELECT id, nombre FROM pilotos WHERE id IN (?)', [driverIds]),
    ]);
    const championship = championshipResult[0][0] || null;
    const drivers = driversResult[0];
    const driversById = new Map(drivers.map(driver => [Number(driver.id), driver.nombre]));
    const pilots = [...ranking.positions.entries()]
      .map(([idpiloto, posicion]) => ({ idpiloto, nombre: driversById.get(idpiloto) || 'Piloto sin identificar', posicion, numero: posicion }))
      .sort((a, b) => a.posicion - b.posicion);
    res.json({ data: { campeonato: championship || null, pilotos: pilots } });
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

const getAdminOfficialCars = async (req, res, next) => {
  try {
    res.json({ data: await listOfficialCars(req.params.id) });
  } catch (error) { next(error); }
};

const parseOfficialCarInput = async (championshipId, body) => {
  const carId = Number(body.idauto);
  const number = Number(body.numero);
  const description = capitalize(String(body.descripcion || '').slice(0, 500));
  if (!Number.isInteger(number) || number < 1 || number > 255) {
    throw Object.assign(new Error('El número del auto oficial debe estar entre 1 y 255'), { statusCode: 400 });
  }
  if (!description) throw Object.assign(new Error('Ingresá una descripción para el auto oficial'), { statusCode: 400 });
  const [[config]] = await pool.query(
    `SELECT cfg.autos_habilitados, c.idcategoria
     FROM inscripciones_config cfg JOIN campeonatos c ON c.id = cfg.idcampeonato
     WHERE cfg.idcampeonato = ?`,
    [championshipId],
  );
  if (!config) throw Object.assign(new Error('Formulario no encontrado'), { statusCode: 404 });
  if (!parseIds(config.autos_habilitados).includes(carId)) {
    throw Object.assign(new Error('El modelo debe estar habilitado en el formulario'), { statusCode: 400 });
  }
  const [[car]] = await pool.query('SELECT id FROM autos WHERE id = ? AND idcategoria = ?', [carId, config.idcategoria]);
  if (!car) throw Object.assign(new Error('El modelo no pertenece a la categoría del campeonato'), { statusCode: 400 });
  return { carId, number, description };
};

const createAdminOfficialCar = async (req, res, next) => {
  let uploadedPath = '';
  try {
    if (!req.file) return res.status(400).json({ error: 'Seleccioná una foto para el auto oficial' });
    const championshipId = Number(req.params.id);
    const input = await parseOfficialCarInput(championshipId, req.body);
    const [[duplicate]] = await pool.query(
      'SELECT id FROM inscripciones_autos_oficiales WHERE idcampeonato = ? AND numero = ? LIMIT 1',
      [championshipId, input.number],
    );
    if (duplicate) return res.status(409).json({ error: `El número ${input.number} ya está cargado en los diseños oficiales` });
    const [[registeredNumber]] = await pool.query(
      'SELECT idpiloto FROM inscriptos WHERE idcampeonato = ? AND numero = ? LIMIT 1',
      [championshipId, input.number],
    );
    if (registeredNumber) return res.status(409).json({ error: `El número ${input.number} ya está ocupado en el campeonato` });
    const gallery = await getRegistrationGallery(championshipId);
    if (!gallery) return res.status(404).json({ error: 'Campeonato no encontrado' });
    const target = officialCarsDirectory(gallery);
    await fs.mkdir(target.directory, { recursive: true });
    const extension = path.extname(req.file.originalname).toLowerCase();
    const filename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${extension}`;
    uploadedPath = `${target.publicPath}/${filename}`;
    await fs.writeFile(path.join(target.directory, filename), req.file.buffer);
    await pool.query(
      `INSERT INTO inscripciones_autos_oficiales
       (idcampeonato, idauto, numero, descripcion, foto) VALUES (?, ?, ?, ?, ?)`,
      [championshipId, input.carId, input.number, input.description, uploadedPath],
    );
    res.status(201).json({ data: await listOfficialCars(championshipId), message: 'Auto oficial cargado' });
  } catch (error) {
    if (uploadedPath) await removePublicFile(uploadedPath).catch(() => {});
    next(error);
  }
};

const updateAdminOfficialCar = async (req, res, next) => {
  let uploadedPath = '';
  try {
    const championshipId = Number(req.params.id);
    const officialCarId = Number(req.params.officialCarId);
    const input = await parseOfficialCarInput(championshipId, req.body);
    const [[existing]] = await pool.query(
      `SELECT official.foto, official.idauto, official.numero,
              EXISTS(SELECT 1 FROM inscriptos i WHERE i.idauto_oficial = official.id) AS utilizado
       FROM inscripciones_autos_oficiales official
       WHERE official.id = ? AND official.idcampeonato = ?`,
      [officialCarId, championshipId],
    );
    if (!existing) return res.status(404).json({ error: 'Auto oficial no encontrado' });
    if (existing.utilizado && (Number(existing.idauto) !== input.carId || Number(existing.numero) !== input.number)) {
      return res.status(409).json({ error: 'Este diseño ya fue elegido. Podés modificar su foto y descripción, pero no el modelo ni el número.' });
    }
    const [[duplicate]] = await pool.query(
      `SELECT id FROM inscripciones_autos_oficiales
       WHERE idcampeonato = ? AND numero = ? AND id <> ? LIMIT 1`,
      [championshipId, input.number, officialCarId],
    );
    if (duplicate) return res.status(409).json({ error: `El número ${input.number} ya está cargado en los diseños oficiales` });
    const [[registeredNumber]] = await pool.query(
      `SELECT idpiloto FROM inscriptos
       WHERE idcampeonato = ? AND numero = ? AND (idauto_oficial IS NULL OR idauto_oficial <> ?) LIMIT 1`,
      [championshipId, input.number, officialCarId],
    );
    if (registeredNumber) return res.status(409).json({ error: `El número ${input.number} ya está ocupado en el campeonato` });
    let photo = existing.foto;
    if (req.file) {
      const gallery = await getRegistrationGallery(championshipId);
      const target = officialCarsDirectory(gallery);
      await fs.mkdir(target.directory, { recursive: true });
      const extension = path.extname(req.file.originalname).toLowerCase();
      const filename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${extension}`;
      uploadedPath = `${target.publicPath}/${filename}`;
      await fs.writeFile(path.join(target.directory, filename), req.file.buffer);
      photo = uploadedPath;
    }
    await pool.query(
      `UPDATE inscripciones_autos_oficiales
       SET idauto = ?, numero = ?, descripcion = ?, foto = ?
       WHERE id = ? AND idcampeonato = ?`,
      [input.carId, input.number, input.description, photo, officialCarId, championshipId],
    );
    if (uploadedPath) await removePublicFile(existing.foto).catch(() => {});
    res.json({ data: await listOfficialCars(championshipId), message: 'Auto oficial actualizado' });
  } catch (error) {
    if (uploadedPath) await removePublicFile(uploadedPath).catch(() => {});
    next(error);
  }
};

const removeAdminOfficialCar = async (req, res, next) => {
  try {
    const championshipId = Number(req.params.id);
    const officialCarId = Number(req.params.officialCarId);
    const [[existing]] = await pool.query(
      'SELECT foto FROM inscripciones_autos_oficiales WHERE id = ? AND idcampeonato = ?',
      [officialCarId, championshipId],
    );
    if (!existing) return res.status(404).json({ error: 'Auto oficial no encontrado' });
    const [[registration]] = await pool.query('SELECT idpiloto FROM inscriptos WHERE idauto_oficial = ? LIMIT 1', [officialCarId]);
    if (registration) return res.status(409).json({ error: 'No podés eliminar un diseño oficial que ya fue elegido por un piloto' });
    await pool.query('DELETE FROM inscripciones_autos_oficiales WHERE id = ? AND idcampeonato = ?', [officialCarId, championshipId]);
    await removePublicFile(existing.foto);
    res.json({ data: await listOfficialCars(championshipId), message: 'Auto oficial eliminado' });
  } catch (error) { next(error); }
};

const saveConfig = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const openAt = String(req.body.fecha_apertura || '').replace('T', ' ');
    const closeAt = String(req.body.fecha_cierre || '').replace('T', ' ');
    const price = Number(req.body.precio);
    const designPrice = Number(req.body.precio_diseno);
    const officialPaintPrice = Number(req.body.precio_pintura_oficial);
    const registrationLimit = Number(req.body.limite_inscriptos);
    const preEnrolled = Number(req.body.preinscriptos || 0);
    const setupDetails = String(req.body.setup_detalle || '').trim();
    const carIds = parseIds(req.body.autos_habilitados);
    const submittedPlans = parsePlans(req.body.planes);
    const plans = fixedPlanDefinitions.map(definition => {
      const submitted = submittedPlans.find(plan => planAliases[definition.id].includes(plan.id));
      return {
        ...definition,
        ...(submitted || {}),
        id: definition.id,
        tipo: definition.tipo,
        habilitado: Boolean(submitted?.habilitado),
        precio_adicional: ['diseno_liga', 'diseno_oficial'].includes(definition.id)
          ? Number(submitted?.precio_adicional || 0) : 0,
        autos_habilitados: definition.id === 'diseno_oficial' ? parseIds(submitted?.autos_habilitados) : [],
      };
    });
    if (!id || !openAt || !closeAt || new Date(closeAt) <= new Date(openAt)) {
      return res.status(400).json({ error: 'Las fechas de apertura y cierre no son válidas' });
    }
    if (!Number.isFinite(price) || price < 0) return res.status(400).json({ error: 'El precio no es válido' });
    if (!Number.isFinite(designPrice) || designPrice < 0) return res.status(400).json({ error: 'El precio adicional del diseño no es válido' });
    if (!Number.isFinite(officialPaintPrice) || officialPaintPrice < 0) return res.status(400).json({ error: 'El precio adicional de la pintura oficial no es válido' });
    if (!Number.isInteger(registrationLimit) || registrationLimit < 1 || registrationLimit > 65535) {
      return res.status(400).json({ error: 'El límite de inscriptos debe ser mayor a cero' });
    }
    if (!Number.isInteger(preEnrolled) || preEnrolled < 0 || preEnrolled > registrationLimit) {
      return res.status(400).json({ error: 'Los preinscriptos deben estar entre cero y el límite total' });
    }
    if (!carIds.length) return res.status(400).json({ error: 'Habilitá al menos un modelo de auto' });
    const modelLimit = Math.ceil(registrationLimit / carIds.length);
    if (!setupDetails) return res.status(400).json({ error: 'Ingresá los detalles del setup' });
    if (!plans.some(plan => plan.habilitado)) return res.status(400).json({ error: 'Habilitá al menos una sección de inscripción' });
    if (plans.some(plan => !plan.titulo || !plan.descripcion)) {
      return res.status(400).json({ error: 'Completá el título y la descripción de todos los planes' });
    }
    if (plans.some(plan => !Number.isFinite(plan.precio_adicional) || plan.precio_adicional < 0)) {
      return res.status(400).json({ error: 'El valor adicional de los planes no es válido' });
    }
    const normalizedPlans = plans.map(plan => ({
      ...plan,
      autos_habilitados: [],
    }));
    const [[championship]] = await pool.query('SELECT idcategoria FROM campeonatos WHERE id = ?', [id]);
    if (!championship) return res.status(404).json({ error: 'Campeonato no encontrado' });
    if (carIds.length) {
      const [validCars] = await pool.query('SELECT id FROM autos WHERE id IN (?) AND idcategoria = ?', [carIds, championship.idcategoria]);
      if (validCars.length !== carIds.length) return res.status(400).json({ error: 'Hay autos que no pertenecen a la categoría' });
    }
    const options = [
      normalizedPlans.some(plan => plan.habilitado && plan.id === 'personalizado'),
      normalizedPlans.some(plan => plan.habilitado && plan.id === 'diseno_liga'),
      normalizedPlans.some(plan => plan.habilitado && plan.id === 'diseno_oficial'),
      normalizedPlans.some(plan => plan.habilitado && plan.id === 'extra'),
    ];
    await pool.query(
      `INSERT INTO inscripciones_config
       (idcampeonato, fecha_apertura, fecha_cierre, precio, precio_diseno, precio_pintura_oficial, setup_detalle, limite_inscriptos, limite_por_modelo,
        preinscriptos, autos_habilitados, planes, permite_personalizado, permite_diseno_liga, permite_pintura_oficial, permite_extra)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE fecha_apertura=VALUES(fecha_apertura),
       fecha_cierre=VALUES(fecha_cierre), precio=VALUES(precio), precio_diseno=VALUES(precio_diseno),
       precio_pintura_oficial=VALUES(precio_pintura_oficial),
       setup_detalle=VALUES(setup_detalle), limite_inscriptos=VALUES(limite_inscriptos), limite_por_modelo=VALUES(limite_por_modelo), preinscriptos=VALUES(preinscriptos), autos_habilitados=VALUES(autos_habilitados), planes=VALUES(planes),
       permite_personalizado=VALUES(permite_personalizado), permite_diseno_liga=VALUES(permite_diseno_liga),
       permite_pintura_oficial=VALUES(permite_pintura_oficial),
       permite_extra=VALUES(permite_extra)`,
      [id, openAt, closeAt, price, designPrice, officialPaintPrice, setupDetails, registrationLimit, modelLimit, preEnrolled,
        JSON.stringify(carIds), JSON.stringify(normalizedPlans), ...options.map(value => value ? 1 : 0)]
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
    const planId = String(req.body.plan_id || req.body.modalidad_diseno || '');
    const selectedPlan = form.planes.find(plan => plan.id === planId && plan.habilitado);
    if (!selectedPlan) return res.status(400).json({ error: 'El plan de inscripción seleccionado no está habilitado' });
    const requiresNumber = selectedPlan.tipo !== 'sin_numero';
    const modality = selectedPlan.id === 'extra' ? 'extra'
      : selectedPlan.id === 'diseno_oficial' ? 'pintura_oficial'
        : selectedPlan.id === 'diseno_liga' ? 'personalizado_liga' : 'personalizado';
    const officialCarId = selectedPlan.id === 'diseno_oficial' ? Number(req.body.idauto_oficial) : null;
    const selectedOfficialCar = officialCarId
      ? form.autos_oficiales.find(car => Number(car.id) === officialCarId && !car.ocupado)
      : null;
    if (selectedPlan.id === 'diseno_oficial' && !selectedOfficialCar) {
      return res.status(409).json({ error: 'El auto oficial seleccionado ya no está disponible' });
    }
    const carId = selectedOfficialCar ? Number(selectedOfficialCar.idauto) : Number(req.body.idauto);
    if (!form.autos_habilitados.includes(carId)) return res.status(400).json({ error: 'El auto seleccionado no está habilitado' });
    const submittedDriverId = Number(req.body.idpiloto) || null;
    let number = selectedOfficialCar ? Number(selectedOfficialCar.numero) : requiresNumber ? Number(req.body.numero) : 0;
    const ranking = !requiresNumber || selectedOfficialCar
      ? { positions: new Map() }
      : await getPreviousSeasonRanking(id, connection);
    const rankedPosition = submittedDriverId ? ranking.positions.get(submittedDriverId) || null : null;
    let rankedNumberReservedByOfficial = false;
    if (rankedPosition) {
      const [[rankedOfficialNumber]] = await connection.query(
        'SELECT id FROM inscripciones_autos_oficiales WHERE idcampeonato = ? AND numero = ? LIMIT 1',
        [id, rankedPosition],
      );
      rankedNumberReservedByOfficial = Boolean(rankedOfficialNumber);
      if (!rankedNumberReservedByOfficial) number = rankedPosition;
    }
    if (requiresNumber && (!Number.isInteger(number) || number < 1 || number > 255)) {
      return res.status(400).json({ error: 'El número debe estar entre 1 y 255' });
    }
    const reservedDriver = !requiresNumber
      ? null
      : [...ranking.positions.entries()].find(([, position]) => position === number)?.[0] || null;
    if (!selectedOfficialCar && reservedDriver && reservedDriver !== submittedDriverId) {
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
      `SELECT limite_inscriptos, limite_por_modelo, preinscriptos, autos_habilitados, fecha_apertura, fecha_cierre,
              CASE WHEN NOW() >= fecha_apertura AND NOW() < fecha_cierre THEN 1 ELSE 0 END AS inscripcion_abierta
       FROM inscripciones_config
       WHERE idcampeonato = ? FOR UPDATE`, [id]
    );
    if (!lockedConfig || !Number(lockedConfig.inscripcion_abierta)) {
      throw Object.assign(new Error('Las inscripciones ya no están abiertas'), { statusCode: 409 });
    }
    if (officialCarId) {
      const [[lockedOfficialCar]] = await connection.query(
        `SELECT idauto, numero FROM inscripciones_autos_oficiales
         WHERE id = ? AND idcampeonato = ? FOR UPDATE`,
        [officialCarId, id],
      );
      if (!lockedOfficialCar || Number(lockedOfficialCar.idauto) !== carId || Number(lockedOfficialCar.numero) !== number) {
        throw Object.assign(new Error('El auto oficial seleccionado ya no está disponible'), { statusCode: 409 });
      }
    } else if (number > 0) {
      const [[officialNumber]] = await connection.query(
        `SELECT id FROM inscripciones_autos_oficiales
         WHERE idcampeonato = ? AND numero = ? LIMIT 1 FOR UPDATE`,
        [id, number],
      );
      if (officialNumber) {
        throw Object.assign(new Error(`El número ${number} está reservado para una pintura oficial. Elegí otro número.`), { statusCode: 409 });
      }
    }
    const [[registrationCount]] = await connection.query(
      'SELECT COUNT(*) AS total FROM inscriptos WHERE idcampeonato = ? AND pago = 1', [id]
    );
    if (Number(registrationCount.total) >= Number(lockedConfig.limite_inscriptos)) {
      throw Object.assign(new Error('No quedan cupos disponibles en el campeonato'), { statusCode: 409 });
    }
    const lockedCarIds = parseIds(lockedConfig.autos_habilitados);
    if (!lockedCarIds.includes(carId)) {
      throw Object.assign(new Error('El modelo seleccionado ya no está habilitado'), { statusCode: 409 });
    }
    if (selectedPlan.id !== 'diseno_oficial') {
      const modelLimit = lockedCarIds.length
        ? Math.ceil(Number(lockedConfig.limite_inscriptos) / lockedCarIds.length)
        : 0;
      const [[modelCount]] = await connection.query(
        `SELECT COUNT(*) AS total FROM inscriptos i
         WHERE i.idcampeonato = ? AND i.idauto = ? AND i.pago = 1
           AND i.idauto_oficial IS NULL
           AND COALESCE(i.tipo_inscripcion, '') <> 'diseno_oficial'
           AND NOT EXISTS (
             SELECT 1 FROM inscripciones_autos_oficiales official
             WHERE official.idcampeonato = i.idcampeonato
               AND official.idauto = i.idauto AND official.numero = i.numero
           )`,
        [id, carId]
      );
      if (Number(modelCount.total) >= modelLimit) {
        throw Object.assign(new Error('El modelo seleccionado ya no tiene lugares disponibles'), { statusCode: 409 });
      }
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
    const [[driverRegistration]] = await connection.query(
      'SELECT idpiloto FROM inscriptos WHERE idcampeonato = ? AND idpiloto = ? LIMIT 1 FOR UPDATE',
      [id, driverId],
    );
    if (driverRegistration) {
      throw Object.assign(new Error('El piloto ya está inscripto en este campeonato'), { statusCode: 409 });
    }
    if (number > 0) {
      const [[numberRegistration]] = await connection.query(
        'SELECT idpiloto FROM inscriptos WHERE idcampeonato = ? AND numero = ? LIMIT 1 FOR UPDATE',
        [id, number],
      );
      if (numberRegistration) {
        throw Object.assign(new Error(`El número ${number} ya está ocupado`), { statusCode: 409 });
      }
    }
    const registrationPrice = Number(form.precio || 0) + Number(selectedPlan.precio_adicional || 0);
    await connection.query(
      `INSERT INTO inscriptos
       (idcampeonato, idpiloto, idauto, numero, pago, tipo_inscripcion, idauto_oficial, precio_inscripcion)
       VALUES (?, ?, ?, ?, 0, ?, ?, ?)`,
      [id, driverId, carId, number, selectedPlan.id, officialCarId, registrationPrice]
    );
    await connection.query(
      `INSERT INTO inscripciones_detalle
       (idcampeonato, idpiloto, modalidad_diseno, plan_id, plan_titulo, precio_total)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         modalidad_diseno = VALUES(modalidad_diseno),
         plan_id = VALUES(plan_id),
         plan_titulo = VALUES(plan_titulo),
         precio_total = VALUES(precio_total),
         creado = CURRENT_TIMESTAMP`,
      [id, driverId, modality, selectedPlan.id, selectedPlan.titulo, registrationPrice]
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

module.exports = {
  checkRegistrationAvailability,
  checkNumber,
  createAdminOfficialCar,
  getAdminAll,
  getAdminImages,
  getAdminOfficialCars,
  getPublicAll,
  getPublicOne,
  getPreviousRanking,
  removeAdminImage,
  removeAdminOfficialCar,
  removeConfig,
  saveConfig,
  searchDrivers,
  start,
  submit,
  updateAdminOfficialCar,
  uploadAdminImages,
};
