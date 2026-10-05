const pool = require('../config/db');
const normalizeCountryCode = require('../utils/countryCode');
const normalizeInstagram = require('../utils/instagram');

const normalizeText = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .toLocaleLowerCase('es-AR');

const capitalizeValue = value => String(value || '')
  .trim()
  .toLocaleLowerCase('es-AR')
  .replace(/(^|\s|-|\/)(\p{L})/gu, (match, separator, letter) => `${separator}${letter.toLocaleUpperCase('es-AR')}`);

const importDrivers = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const drivers = Array.isArray(req.body.drivers) ? req.body.drivers.slice(0, 500) : [];
    if (!drivers.length) return res.status(400).json({ error: 'No hay pilotos para importar' });

    await connection.beginTransaction();
    const [existingRows] = await connection.query('SELECT nombre FROM pilotos FOR UPDATE');
    const existing = new Set(existingRows.map(row => normalizeText(row.nombre)));
    const inserted = [];
    const skipped = [];

    for (const source of drivers) {
      const driver = {
        nombre: capitalizeValue(source.nombre),
        localidad: capitalizeValue(source.localidad),
        provincia: capitalizeValue(source.provincia),
        telefono: String(source.telefono || '').replace(/\D/g, ''),
        nacionalidad: normalizeCountryCode(source.nacionalidad || 'ar'),
        steam: String(source.steam || '').trim(),
        ig: normalizeInstagram(source.ig),
      };
      const key = normalizeText(driver.nombre);
      if (!key || existing.has(key)) {
        skipped.push(driver.nombre || '(sin nombre)');
        continue;
      }
      const [result] = await connection.query(
        'INSERT INTO pilotos (nombre, localidad, provincia, telefono, nacionalidad, steam, ig) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [driver.nombre, driver.localidad, driver.provincia, driver.telefono, driver.nacionalidad, driver.steam, driver.ig]
      );
      existing.add(key);
      inserted.push({ id: result.insertId, ...driver });
    }

    await connection.commit();
    res.status(201).json({ data: { inserted, skipped }, message: `${inserted.length} pilotos importados` });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

const importRegistrations = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const championshipId = Number(req.body.idcampeonato);
    const registrations = Array.isArray(req.body.registrations) ? req.body.registrations.slice(0, 500) : [];
    if (!championshipId || !registrations.length) return res.status(400).json({ error: 'Falta el campeonato o los inscriptos' });

    await connection.beginTransaction();
    const [[championship]] = await connection.query('SELECT idcategoria FROM campeonatos WHERE id = ? FOR UPDATE', [championshipId]);
    if (!championship) {
      const error = new Error('Campeonato no encontrado');
      error.statusCode = 404;
      throw error;
    }
    const [cars] = await connection.query('SELECT id, idcategoria FROM autos');
    const carMap = new Map(cars.map(car => [Number(car.id), car]));
    const [existingRows] = await connection.query('SELECT idpiloto, numero FROM inscriptos WHERE idcampeonato = ? FOR UPDATE', [championshipId]);
    const existingDrivers = new Set(existingRows.map(row => Number(row.idpiloto)));
    const usedNumbers = new Set(existingRows.map(row => Number(row.numero)).filter(number => number > 0));
    const [officialRows] = await connection.query('SELECT numero FROM inscripciones_autos_oficiales WHERE idcampeonato = ?', [championshipId]);
    const officialNumbers = new Set(officialRows.map(row => Number(row.numero)).filter(number => number > 0));
    const inserted = [];
    const skipped = [];

    for (const source of registrations) {
      const driverId = Number(source.idpiloto);
      const carId = Number(source.idauto);
      const number = Number(source.numero || 0);
      const car = carMap.get(carId);
      let reason = '';
      if (!driverId) reason = 'Piloto inválido';
      else if (existingDrivers.has(driverId)) reason = 'El piloto ya está inscripto';
      else if (!car || Number(car.idcategoria) !== Number(championship.idcategoria)) reason = 'Auto no válido para la categoría';
      else if (!Number.isInteger(number) || number < 0 || number > 255) reason = 'Número fuera del rango 0-255';
      else if (number > 0 && usedNumbers.has(number)) reason = `El número ${number} ya está ocupado`;
      else if (number > 0 && officialNumbers.has(number)) reason = `El número ${number} está reservado para una pintura oficial`;

      if (reason) {
        skipped.push({ idpiloto: driverId, reason });
        continue;
      }
      await connection.query(
        'INSERT INTO inscriptos (idcampeonato, idpiloto, idauto, numero, pago) VALUES (?, ?, ?, ?, ?)',
        [championshipId, driverId, carId, number, source.pago === true || source.pago === 1 ? 1 : 0]
      );
      existingDrivers.add(driverId);
      if (number > 0) usedNumbers.add(number);
      inserted.push(driverId);
    }

    await connection.commit();
    res.status(201).json({ data: { inserted, skipped }, message: `${inserted.length} inscriptos importados` });
  } catch (error) {
    await connection.rollback();
    next(error);
  } finally {
    connection.release();
  }
};

module.exports = { importDrivers, importRegistrations };
