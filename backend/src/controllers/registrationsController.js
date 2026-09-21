const pool = require('../config/db');

const parseIds = value => {
  let values = value;
  if (typeof values === 'string') {
    try { values = JSON.parse(values); } catch { values = values.split(','); }
  }
  return [...new Set((Array.isArray(values) ? values : []).map(Number).filter(Number.isInteger))];
};

const assertPaymentCapacity = async (connection, championshipId, driverId, carId) => {
  const [[config]] = await connection.query(
    `SELECT limite_inscriptos, preinscriptos, autos_habilitados
     FROM inscripciones_config WHERE idcampeonato = ? FOR UPDATE`,
    [championshipId]
  );
  if (!config) return;

  const enabledCars = parseIds(config.autos_habilitados);
  if (!enabledCars.includes(Number(carId))) {
    throw Object.assign(new Error('El auto ya no está habilitado para este campeonato'), { statusCode: 409 });
  }

  const [[total]] = await connection.query(
    'SELECT COUNT(*) AS cantidad FROM inscriptos WHERE idcampeonato = ? AND pago = 1 AND idpiloto <> ?',
    [championshipId, driverId]
  );
  if (Number(total.cantidad) >= Number(config.limite_inscriptos)) {
    throw Object.assign(new Error('No quedan cupos disponibles para confirmar este pago'), { statusCode: 409 });
  }

  const modelLimit = enabledCars.length ? Math.ceil(Number(config.limite_inscriptos) / enabledCars.length) : 0;
  const [[model]] = await connection.query(
    `SELECT COUNT(*) AS cantidad FROM inscriptos
     WHERE idcampeonato = ? AND idauto = ? AND pago = 1 AND idpiloto <> ?`,
    [championshipId, carId, driverId]
  );
  if (Number(model.cantidad) >= modelLimit) {
    throw Object.assign(new Error('El modelo seleccionado ya no tiene lugares para confirmar este pago'), { statusCode: 409 });
  }
};

// ── GET /api/inscriptos?idcampeonato=X ────────────────────────────────────────
const getAll = async (req, res, next) => {
  try {
    const { idcampeonato } = req.query;
    let query = `
      SELECT i.numero, i.pago, i.tipo_inscripcion, i.idauto_oficial, i.precio_inscripcion, i.idcampeonato,
             p.id AS idpiloto, p.nombre, p.localidad, p.telefono, p.ig,
             a.id AS idauto, am.id AS idmarca, am.marca, a.modelo, am.logo AS auto_logo,
             official.descripcion AS auto_oficial_descripcion, official.foto AS auto_oficial_foto,
             c.temporada, c.anio, c.idcategoria, cat.categoria
      FROM inscriptos i
      JOIN pilotos p ON i.idpiloto = p.id
      JOIN autos a   ON i.idauto   = a.id
      JOIN autos_marcas am ON a.marca = am.id
      LEFT JOIN inscripciones_autos_oficiales official ON official.id = i.idauto_oficial
      JOIN campeonatos c ON i.idcampeonato = c.id
      JOIN categorias cat ON c.idcategoria = cat.id
    `;
    const params = [];
    if (idcampeonato) {
      query += ' WHERE i.idcampeonato = ?';
      params.push(idcampeonato);
    }
    query += ' ORDER BY c.anio DESC, c.temporada DESC, i.numero ASC';
    const [rows] = await pool.query(query, params);
    res.json({ data: rows, total: rows.length });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/inscriptos — inscribir piloto a campeonato ──────────────────────
const create = async (req, res, next) => {
  try {
    const { idcampeonato, idpiloto, idauto, numero, pago } = req.body;
    if (!idcampeonato || !idpiloto || !idauto || numero === '' || numero === undefined) {
      return res.status(400).json({ error: 'idcampeonato, idpiloto, idauto y numero son requeridos' });
    }
    const numericNumber = Number(numero);
    if (!Number.isInteger(numericNumber) || numericNumber < 0 || numericNumber > 199) {
      return res.status(400).json({ error: 'El número debe ser un entero entre 0 y 199' });
    }

    const [[championship]] = await pool.query('SELECT idcategoria FROM campeonatos WHERE id = ?', [idcampeonato]);
    const [[car]] = await pool.query('SELECT idcategoria FROM autos WHERE id = ?', [idauto]);
    if (!championship) return res.status(404).json({ error: 'Campeonato no encontrado' });
    if (!car) return res.status(404).json({ error: 'Auto no encontrado' });
    if (Number(championship.idcategoria) !== Number(car.idcategoria)) {
      return res.status(400).json({ error: 'El auto no pertenece a la categoría del campeonato' });
    }

    const duplicateQuery = numericNumber === 0
      ? 'SELECT idpiloto, numero FROM inscriptos WHERE idcampeonato = ? AND idpiloto = ? LIMIT 1'
      : 'SELECT idpiloto, numero FROM inscriptos WHERE idcampeonato = ? AND (idpiloto = ? OR numero = ?) LIMIT 1';
    const duplicateParams = numericNumber === 0
      ? [idcampeonato, idpiloto]
      : [idcampeonato, idpiloto, numericNumber];
    const [[duplicate]] = await pool.query(duplicateQuery, duplicateParams);
    if (duplicate) {
      const message = Number(duplicate.idpiloto) === Number(idpiloto)
        ? 'El piloto ya está inscripto en este campeonato'
        : `El número ${numero} ya está utilizado en este campeonato`;
      return res.status(409).json({ error: message });
    }

    await pool.query(
      'INSERT INTO inscriptos (idcampeonato, idpiloto, idauto, numero, pago) VALUES (?, ?, ?, ?, ?)',
      [idcampeonato, idpiloto, idauto, numericNumber, pago === true || pago === 1 ? 1 : 0]
    );
    res.status(201).json({ message: 'Piloto inscripto al campeonato', data: req.body });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'El piloto ya está inscripto en este campeonato' });
    }
    next(err);
  }
};

// ── PATCH /api/inscriptos/:idcampeonato/:idpiloto/pago ────────────────────────
const updatePayment = async (req, res, next) => {
  const connection = await pool.getConnection();
  try {
    const { idcampeonato, idpiloto } = req.params;
    const { pago } = req.body;
    await connection.beginTransaction();
    const [[registration]] = await connection.query(
      'SELECT idauto, pago FROM inscriptos WHERE idcampeonato=? AND idpiloto=? FOR UPDATE',
      [idcampeonato, idpiloto]
    );
    if (!registration) throw Object.assign(new Error('Inscripción no encontrada'), { statusCode: 404 });
    if (pago && !registration.pago) {
      await assertPaymentCapacity(connection, idcampeonato, idpiloto, registration.idauto);
    }
    await connection.query(
      'UPDATE inscriptos SET pago=? WHERE idcampeonato=? AND idpiloto=?',
      [pago ? 1 : 0, idcampeonato, idpiloto]
    );
    await connection.commit();
    res.json({ message: 'Estado de pago actualizado', pago: pago ? 1 : 0 });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally { connection.release(); }
};

const updateBulk = async (req, res, next) => {
  const changes = req.body?.changes;
  if (!Array.isArray(changes) || !changes.length) {
    return res.status(400).json({ error: 'No hay cambios de inscripciones para guardar' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    for (const change of changes) {
      const idcampeonato = Number(change.idcampeonato);
      const idpiloto = Number(change.idpiloto);
      const idauto = Number(change.idauto);
      const numero = Number(change.numero);
      const pago = change.pago === true || change.pago === 1 || change.pago === '1' ? 1 : 0;
      if (!idcampeonato || !idpiloto || !idauto) {
        const error = new Error('Campeonato, piloto y auto son requeridos');
        error.statusCode = 400;
        throw error;
      }
      if (!Number.isInteger(numero) || numero < 0 || numero > 199) {
        const error = new Error('El número debe ser un entero entre 0 y 199');
        error.statusCode = 400;
        throw error;
      }

      const [[registration]] = await connection.query(
        `SELECT c.idcategoria AS campeonato_categoria, a.idcategoria AS auto_categoria,
                i.idauto_oficial
         FROM inscriptos i
         JOIN campeonatos c ON c.id = i.idcampeonato
         JOIN autos a ON a.id = ?
         WHERE i.idcampeonato = ? AND i.idpiloto = ?`,
        [idauto, idcampeonato, idpiloto]
      );
      if (!registration) {
        const error = new Error('Inscripción o auto no encontrado');
        error.statusCode = 404;
        throw error;
      }
      if (Number(registration.campeonato_categoria) !== Number(registration.auto_categoria)) {
        const error = new Error('El auto no pertenece a la categoría del campeonato');
        error.statusCode = 400;
        throw error;
      }

      if (numero !== 0) {
        const [[duplicateNumber]] = await connection.query(
          `SELECT idpiloto, idauto_oficial FROM inscriptos
           WHERE idcampeonato = ? AND numero = ? AND idpiloto <> ?
           LIMIT 1`,
          [idcampeonato, numero, idpiloto]
        );
        const officialNumberPair = duplicateNumber
          && (registration.idauto_oficial || duplicateNumber.idauto_oficial);
        if (duplicateNumber && !officialNumberPair) {
          const error = new Error(`El número ${numero} ya está utilizado en este campeonato`);
          error.statusCode = 409;
          throw error;
        }
      }

      if (pago) await assertPaymentCapacity(connection, idcampeonato, idpiloto, idauto);

      await connection.query(
        'UPDATE inscriptos SET idauto = ?, numero = ?, pago = ? WHERE idcampeonato = ? AND idpiloto = ?',
        [idauto, numero, pago, idcampeonato, idpiloto]
      );
    }

    await connection.commit();
    res.json({ message: 'Inscripciones actualizadas', updated: changes.length });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
};

// ── DELETE /api/inscriptos/:idcampeonato/:idpiloto ────────────────────────────
const remove = async (req, res, next) => {
  try {
    const { idcampeonato, idpiloto } = req.params;
    const [result] = await pool.query(
      'DELETE FROM inscriptos WHERE idcampeonato=? AND idpiloto=?',
      [idcampeonato, idpiloto]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Inscripción no encontrada' });
    res.json({ message: 'Inscripción eliminada' });
  } catch (err) {
    next(err);
  }
};

module.exports = { getAll, create, updatePayment, updateBulk, remove };
