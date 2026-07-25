const pool = require('../config/db');
const normalizeCountryCode = require('../utils/countryCode');

const capitalizeValue = value =>
  String(value || '')
    .trim()
    .toLocaleLowerCase('es-AR')
    .replace(/(^|\s|-|\/)(\p{L})/gu, (match, separator, letter) => `${separator}${letter.toLocaleUpperCase('es-AR')}`);

const digitsOnly = value => String(value || '').replace(/\D/g, '');

const normalizeDriver = body => ({
  nombre: capitalizeValue(body.nombre),
  localidad: capitalizeValue(body.localidad),
  provincia: capitalizeValue(body.provincia),
  telefono: digitsOnly(body.telefono),
  nacionalidad: normalizeCountryCode(body.nacionalidad),
  steam: String(body.steam || '').trim(),
});

const findDuplicate = async ({ nombre, telefono, steam }, excludeId = null) => {
  const conditions = [];
  const params = [];

  if (nombre) {
    conditions.push('LOWER(nombre) = LOWER(?)');
    params.push(nombre);
  }
  if (telefono) {
    conditions.push('telefono = ?');
    params.push(telefono);
  }
  if (steam) {
    conditions.push('LOWER(steam) = LOWER(?)');
    params.push(steam);
  }

  if (!conditions.length) return null;

  let sql = `SELECT id, nombre, telefono, steam FROM pilotos WHERE (${conditions.join(' OR ')})`;
  if (excludeId) {
    sql += ' AND id <> ?';
    params.push(excludeId);
  }
  sql += ' LIMIT 1';

  const [[duplicate]] = await pool.query(sql, params);
  return duplicate || null;
};

const duplicateMessage = (duplicate, driver) => {
  const repeatedFields = [];
  if (String(duplicate.nombre || '').trim().toLocaleLowerCase('es-AR') === driver.nombre.toLocaleLowerCase('es-AR')) {
    repeatedFields.push('el nombre');
  }
  if (driver.telefono && digitsOnly(duplicate.telefono) === driver.telefono) repeatedFields.push('el teléfono');
  if (driver.steam && String(duplicate.steam || '').trim().toLocaleLowerCase('es-AR') === driver.steam.toLocaleLowerCase('es-AR')) {
    repeatedFields.push('Steam');
  }

  return `Ya existe un piloto con ${repeatedFields.join(' y ') || 'esos datos'}`;
};

const getAll = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.id, p.nombre, p.localidad, p.provincia, p.telefono, p.nacionalidad, p.steam,
              COUNT(DISTINCT i.idcampeonato) AS campeonatos_disputados
       FROM pilotos p
       LEFT JOIN inscriptos i ON p.id = i.idpiloto
       GROUP BY p.id
       ORDER BY p.nombre ASC`
    );
    res.json({ data: rows, total: rows.length });
  } catch (err) {
    next(err);
  }
};

const getById = async (req, res, next) => {
  try {
    const [[piloto]] = await pool.query(
      'SELECT id, nombre, localidad, provincia, telefono, nacionalidad, steam FROM pilotos WHERE id = ?',
      [req.params.id]
    );
    if (!piloto) return res.status(404).json({ error: 'Piloto no encontrado' });

    const [historial] = await pool.query(
      `SELECT c.id AS idcampeonato, c.temporada, c.anio,
              cat.categoria,
              a.marca, a.modelo, a.logo AS auto_logo,
              i.numero, i.pago,
              t.posicion, t.puntos, t.victorias, t.apercibimientos,
              t.campeon, t.expulsado
       FROM inscriptos i
       JOIN campeonatos c  ON i.idcampeonato = c.id
       JOIN categorias cat ON c.idcategoria  = cat.id
       JOIN autos a        ON i.idauto       = a.id
       LEFT JOIN tablas t  ON t.idcampeonato = i.idcampeonato AND t.idpiloto = i.idpiloto
       WHERE i.idpiloto = ?
       ORDER BY c.anio DESC, c.temporada DESC`,
      [req.params.id]
    );

    res.json({ data: { ...piloto, historial } });
  } catch (err) {
    next(err);
  }
};

const create = async (req, res, next) => {
  try {
    const driver = normalizeDriver(req.body);
    if (!driver.nombre) {
      return res.status(400).json({ error: 'nombre es requerido' });
    }

    const duplicate = await findDuplicate(driver);
    if (duplicate) {
      return res.status(409).json({ error: duplicateMessage(duplicate, driver) });
    }

    const [result] = await pool.query(
      'INSERT INTO pilotos (nombre, localidad, provincia, telefono, nacionalidad, steam) VALUES (?, ?, ?, ?, ?, ?)',
      [driver.nombre, driver.localidad, driver.provincia, driver.telefono, driver.nacionalidad, driver.steam]
    );

    res.status(201).json({ data: { id: result.insertId, ...driver }, message: 'Piloto registrado' });
  } catch (err) {
    next(err);
  }
};

const update = async (req, res, next) => {
  try {
    const driver = normalizeDriver(req.body);
    if (!driver.nombre) {
      return res.status(400).json({ error: 'nombre es requerido' });
    }

    const duplicate = await findDuplicate(driver, req.params.id);
    if (duplicate) {
      return res.status(409).json({ error: duplicateMessage(duplicate, driver) });
    }

    const [result] = await pool.query(
      'UPDATE pilotos SET nombre=?, localidad=?, provincia=?, telefono=?, nacionalidad=?, steam=? WHERE id=?',
      [driver.nombre, driver.localidad, driver.provincia, driver.telefono, driver.nacionalidad, driver.steam, req.params.id]
    );

    if (!result.affectedRows) return res.status(404).json({ error: 'Piloto no encontrado' });
    res.json({ message: 'Piloto actualizado', data: { id: req.params.id, ...driver } });
  } catch (err) {
    next(err);
  }
};

const remove = async (req, res, next) => {
  try {
    const [result] = await pool.query('DELETE FROM pilotos WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Piloto no encontrado' });

    res.json({ message: 'Piloto eliminado' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll, getById, create, update, remove };
