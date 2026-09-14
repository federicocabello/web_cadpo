const crypto = require('crypto');
const pool = require('../config/db');
const normalizeCountryCode = require('../utils/countryCode');

const FORM_TTL_MS = 10 * 60 * 1000;
const tokenSecret = () => process.env.ADMIN_SESSION_SECRET || process.env.DB_PASSWORD;
const capitalize = value => String(value || '').trim().toLocaleLowerCase('es-AR')
  .replace(/(^|\s|-|\/)(\p{L})/gu, (match, separator, letter) => `${separator}${letter.toLocaleUpperCase('es-AR')}`);
const digitsOnly = value => String(value || '').replace(/\D/g, '');
const asBoolean = value => value === true || value === 1 || value === '1';
const parseIds = value => [...new Set((Array.isArray(value) ? value : []).map(Number).filter(Number.isInteger))];

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
         cfg.precio, cfg.precio_diseno, cfg.setup_detalle, cfg.limite_inscriptos, cfg.cupos_reservados, cfg.autos_habilitados,
         cfg.permite_personalizado, cfg.permite_diseno_liga, cfg.permite_extra,
         c.temporada, c.anio, c.plataforma, c.reglamento, c.idcategoria,
         cat.categoria, cat.logo AS categoria_logo,
         COUNT(DISTINCT cal.ronda) AS cantidad_fechas,
         (SELECT COUNT(*) FROM inscriptos i WHERE i.idcampeonato = cfg.idcampeonato) AS inscriptos_actuales,
         CASE
           WHEN NOW() < cfg.fecha_apertura THEN 'upcoming'
           WHEN NOW() >= cfg.fecha_cierre THEN 'closed'
           WHEN (SELECT COUNT(*) FROM inscriptos i WHERE i.idcampeonato = cfg.idcampeonato) + cfg.cupos_reservados >= cfg.limite_inscriptos THEN 'full'
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
  return {
    ...row,
    permite_personalizado: Boolean(row.permite_personalizado),
    permite_diseno_liga: Boolean(row.permite_diseno_liga),
    permite_extra: Boolean(row.permite_extra),
    autos_habilitados: parseIds(enabledCars),
    cupos_ocupados: Math.min(Number(row.limite_inscriptos), Number(row.inscriptos_actuales) + Number(row.cupos_reservados)),
    lugares_disponibles: Math.max(0, Number(row.limite_inscriptos) - Number(row.inscriptos_actuales) - Number(row.cupos_reservados)),
    phase: row.phase,
  };
};

const loadForm = async id => {
  const [[row]] = await pool.query(`${configSelect} WHERE cfg.idcampeonato = ? GROUP BY cfg.idcampeonato`, [id]);
  if (!row) return null;
  const config = normalizeConfig(row);
  const [calendar] = await pool.query(
    `SELECT cal.ronda, cal.fecha, cal.especial, cal.especialidad, cal.coronacion,
            ci.id AS idcircuito, ci.nombre AS circuito, ci.variante, ci.localidad, ci.provincia, ci.pais
     FROM calendario cal JOIN circuitos ci ON ci.id = cal.idcircuito
     WHERE cal.idcampeonato = ? ORDER BY cal.ronda`, [id]
  );
  const carIds = config.autos_habilitados;
  let cars = [];
  if (carIds.length) {
    const [rows] = await pool.query(
      `SELECT a.id, a.idcategoria, a.modelo, a.imagen, am.marca, am.logo
       FROM autos a JOIN autos_marcas am ON am.id = a.marca
       WHERE a.id IN (?) AND a.idcategoria = ? ORDER BY am.marca, a.modelo`,
      [carIds, config.idcategoria]
    );
    cars = rows;
  }
  return { ...config, calendario: calendar, autos: cars };
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
      `SELECT id, nombre, localidad, provincia, telefono, nacionalidad, steam
       FROM pilotos WHERE nombre LIKE ? ORDER BY nombre LIMIT 8`, [`%${search}%`]
    );
    res.json({ data: rows });
  } catch (error) { next(error); }
};

const checkNumber = async (req, res, next) => {
  try {
    const number = Number(req.params.number);
    if (!Number.isInteger(number) || number < 1 || number > 200) return res.status(400).json({ error: 'Número inválido' });
    const [[row]] = await pool.query('SELECT idpiloto FROM inscriptos WHERE idcampeonato = ? AND numero = ? LIMIT 1', [req.params.id, number]);
    res.json({ data: { available: !row } });
  } catch (error) { next(error); }
};

const getAdminAll = async (req, res, next) => {
  try {
    const [rows] = await pool.query(`${configSelect} GROUP BY cfg.idcampeonato ORDER BY c.anio DESC, c.temporada DESC`);
    res.json({ data: rows.map(normalizeConfig) });
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
    const reservedSlots = Number(req.body.cupos_reservados);
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
    if (!Number.isInteger(reservedSlots) || reservedSlots < 0 || reservedSlots > registrationLimit) {
      return res.status(400).json({ error: 'Los cupos reservados deben estar entre cero y el límite total' });
    }
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
       (idcampeonato, fecha_apertura, fecha_cierre, precio, precio_diseno, setup_detalle, limite_inscriptos, cupos_reservados,
        autos_habilitados, permite_personalizado, permite_diseno_liga, permite_extra)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE fecha_apertura=VALUES(fecha_apertura),
       fecha_cierre=VALUES(fecha_cierre), precio=VALUES(precio), precio_diseno=VALUES(precio_diseno),
       setup_detalle=VALUES(setup_detalle), limite_inscriptos=VALUES(limite_inscriptos), cupos_reservados=VALUES(cupos_reservados), autos_habilitados=VALUES(autos_habilitados),
       permite_personalizado=VALUES(permite_personalizado), permite_diseno_liga=VALUES(permite_diseno_liga),
       permite_extra=VALUES(permite_extra)`,
      [id, openAt, closeAt, price, designPrice, setupDetails, registrationLimit, reservedSlots,
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
    const number = modality === 'extra' ? 0 : Number(req.body.numero);
    if (modality !== 'extra' && (!Number.isInteger(number) || number < 1 || number > 200)) {
      return res.status(400).json({ error: 'El número debe estar entre 1 y 200' });
    }
    const driver = {
      nombre: capitalize(req.body.nombre), localidad: capitalize(req.body.localidad),
      provincia: capitalize(req.body.provincia), telefono: digitsOnly(req.body.telefono),
      nacionalidad: normalizeCountryCode(req.body.nacionalidad), steam: String(req.body.steam || '').trim(),
    };
    if (!driver.nombre || !driver.telefono || !driver.localidad || !driver.steam) {
      return res.status(400).json({ error: 'Completá nombre, teléfono, localidad e ID Steam' });
    }

    await connection.beginTransaction();
    const [[lockedConfig]] = await connection.query(
      'SELECT limite_inscriptos, cupos_reservados FROM inscripciones_config WHERE idcampeonato = ? FOR UPDATE', [id]
    );
    const [[registrationCount]] = await connection.query(
      'SELECT COUNT(*) AS total FROM inscriptos WHERE idcampeonato = ?', [id]
    );
    if (!lockedConfig || Number(registrationCount.total) + Number(lockedConfig.cupos_reservados) >= Number(lockedConfig.limite_inscriptos)) {
      throw Object.assign(new Error('El campeonato alcanzó el límite de inscriptos'), { statusCode: 409 });
    }
    let driverId = Number(req.body.idpiloto);
    if (driverId) {
      const [[existing]] = await connection.query('SELECT id FROM pilotos WHERE id = ? FOR UPDATE', [driverId]);
      if (!existing) throw Object.assign(new Error('Piloto no encontrado'), { statusCode: 404 });
      const [[duplicateDriver]] = await connection.query(
        `SELECT id FROM pilotos
         WHERE id <> ? AND (LOWER(nombre)=LOWER(?) OR telefono=? OR LOWER(steam)=LOWER(?)) LIMIT 1 FOR UPDATE`,
        [driverId, driver.nombre, driver.telefono, driver.steam]
      );
      if (duplicateDriver) throw Object.assign(new Error('Los datos modificados pertenecen a otro piloto.'), { statusCode: 409 });
      await connection.query(
        'UPDATE pilotos SET nombre=?, localidad=?, provincia=?, telefono=?, nacionalidad=?, steam=? WHERE id=?',
        [driver.nombre, driver.localidad, driver.provincia, driver.telefono, driver.nacionalidad, driver.steam, driverId]
      );
    } else {
      const [[duplicate]] = await connection.query(
        'SELECT id FROM pilotos WHERE LOWER(nombre)=LOWER(?) OR telefono=? OR LOWER(steam)=LOWER(?) LIMIT 1 FOR UPDATE',
        [driver.nombre, driver.telefono, driver.steam]
      );
      if (duplicate) throw Object.assign(new Error('Ya existe un piloto con esos datos. Buscalo por su nombre.'), { statusCode: 409 });
      const [created] = await connection.query(
        'INSERT INTO pilotos (nombre, localidad, provincia, telefono, nacionalidad, steam) VALUES (?, ?, ?, ?, ?, ?)',
        [driver.nombre, driver.localidad, driver.provincia, driver.telefono, driver.nacionalidad, driver.steam]
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

module.exports = { checkNumber, getAdminAll, getPublicAll, getPublicOne, removeConfig, saveConfig, searchDrivers, start, submit };
