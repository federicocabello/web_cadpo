const pool = require('../config/db');

const parseIds = value => {
  let values = value;
  if (typeof values === 'string') {
    try { values = JSON.parse(values); } catch { values = values.split(','); }
  }
  return [...new Set((Array.isArray(values) ? values : []).map(Number).filter(Number.isInteger))];
};

const planAliases = {
  extra: ['extra', 'extra-sin-diseno'],
  personalizado: ['personalizado', 'diseno-propio'],
  diseno_liga: ['diseno_liga', 'diseno-liga', 'personalizado_liga'],
  diseno_oficial: ['diseno_oficial', 'pintura_oficial'],
};

const canonicalPlanId = value => {
  const normalized = String(value || '').trim().toLocaleLowerCase('es-AR');
  return Object.entries(planAliases).find(([, aliases]) => aliases.includes(normalized))?.[0] || '';
};

const parsePlans = value => {
  let plans = value;
  if (typeof plans === 'string') {
    try { plans = JSON.parse(plans); } catch { plans = []; }
  }
  return (Array.isArray(plans) ? plans : []).map(plan => ({
    ...plan,
    id: canonicalPlanId(plan?.id),
    titulo: String(plan?.titulo || '').trim(),
    precio_adicional: Number(plan?.precio_adicional || 0),
    habilitado: plan?.habilitado !== false,
  })).filter(plan => plan.id);
};

const normalizeConfigPlans = config => {
  const configured = parsePlans(config.planes);
  const defaults = [
    { id: 'extra', titulo: 'Extra sin diseño', precio_adicional: 0, habilitado: Boolean(config.permite_extra) },
    { id: 'personalizado', titulo: 'Personalizado', precio_adicional: 0, habilitado: Boolean(config.permite_personalizado) },
    { id: 'diseno_liga', titulo: 'Diseño de la liga', precio_adicional: Number(config.precio_diseno || 0), habilitado: Boolean(config.permite_diseno_liga) },
    { id: 'diseno_oficial', titulo: 'Diseño oficial', precio_adicional: Number(config.precio_pintura_oficial || 0), habilitado: Boolean(config.permite_pintura_oficial) },
  ];
  return defaults.map(defaultPlan => configured.find(plan => plan.id === defaultPlan.id) || defaultPlan);
};

const planModality = planId => planId === 'extra'
  ? 'extra'
  : planId === 'diseno_oficial'
    ? 'pintura_oficial'
    : planId === 'diseno_liga' ? 'personalizado_liga' : 'personalizado';

const assertPaymentCapacity = async (connection, championshipId, driverId, carId, planId) => {
  const [[config]] = await connection.query(
    `SELECT limite_inscriptos, limite_por_modelo, preinscriptos, autos_habilitados
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

  if (planId === 'diseno_oficial') return;

  const modelLimit = enabledCars.length
    ? Math.ceil(Number(config.limite_inscriptos) / enabledCars.length)
    : 0;
  const [[model]] = await connection.query(
    `SELECT COUNT(*) AS cantidad FROM inscriptos i
     WHERE i.idcampeonato = ? AND i.idauto = ? AND i.pago = 1 AND i.idpiloto <> ?
       AND i.idauto_oficial IS NULL
       AND COALESCE(i.tipo_inscripcion, '') <> 'diseno_oficial'
       AND NOT EXISTS (
         SELECT 1 FROM inscripciones_autos_oficiales official
         WHERE official.idcampeonato = i.idcampeonato
           AND official.idauto = i.idauto AND official.numero = i.numero
       )`,
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
      SELECT i.numero, i.pago, i.tipo_inscripcion,
             COALESCE(i.idauto_oficial, inferred_official.id) AS idauto_oficial,
             i.precio_inscripcion, i.idcampeonato,
             p.id AS idpiloto, p.nombre, p.localidad, p.provincia, p.telefono, p.nacionalidad, p.steam, p.ig,
             a.id AS idauto, am.id AS idmarca, am.marca, a.modelo, am.logo AS auto_logo,
             COALESCE(official.descripcion, inferred_official.descripcion) AS auto_oficial_descripcion,
             COALESCE(official.foto, inferred_official.foto) AS auto_oficial_foto,
             CASE WHEN official.id IS NOT NULL OR inferred_official.id IS NOT NULL THEN 1 ELSE 0 END AS es_diseno_oficial,
             detail.modalidad_diseno, detail.plan_id, detail.plan_titulo,
             COALESCE(detail.precio_total, i.precio_inscripcion) AS total_abonar,
             c.temporada, c.anio, c.idcategoria, cat.categoria
      FROM inscriptos i
      JOIN pilotos p ON i.idpiloto = p.id
      JOIN autos a   ON i.idauto   = a.id
      JOIN autos_marcas am ON a.marca = am.id
      LEFT JOIN inscripciones_autos_oficiales official ON official.id = i.idauto_oficial
      LEFT JOIN inscripciones_autos_oficiales inferred_official
        ON i.idauto_oficial IS NULL
       AND inferred_official.idcampeonato = i.idcampeonato
       AND inferred_official.idauto = i.idauto
       AND inferred_official.numero = i.numero
      LEFT JOIN inscripciones_detalle detail
        ON detail.idcampeonato = i.idcampeonato AND detail.idpiloto = i.idpiloto
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
    if (!Number.isInteger(numericNumber) || numericNumber < 0 || numericNumber > 255) {
      return res.status(400).json({ error: 'El número debe ser un entero entre 0 y 255' });
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
    if (numericNumber > 0) {
      const [[officialNumber]] = await pool.query(
        'SELECT id FROM inscripciones_autos_oficiales WHERE idcampeonato = ? AND numero = ? LIMIT 1',
        [idcampeonato, numericNumber],
      );
      if (officialNumber) {
        return res.status(409).json({ error: `El número ${numericNumber} está reservado para una pintura oficial` });
      }
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
      `SELECT i.idauto, i.pago, i.tipo_inscripcion, i.idauto_oficial,
              EXISTS(
                SELECT 1 FROM inscripciones_autos_oficiales official
                WHERE official.idcampeonato = i.idcampeonato
                  AND official.idauto = i.idauto AND official.numero = i.numero
              ) AS es_diseno_oficial
       FROM inscriptos i WHERE i.idcampeonato=? AND i.idpiloto=? FOR UPDATE`,
      [idcampeonato, idpiloto]
    );
    if (!registration) throw Object.assign(new Error('Inscripción no encontrada'), { statusCode: 404 });
    if (pago && !registration.pago) {
      const planId = registration.idauto_oficial || registration.es_diseno_oficial
        ? 'diseno_oficial'
        : canonicalPlanId(registration.tipo_inscripcion);
      await assertPaymentCapacity(connection, idcampeonato, idpiloto, registration.idauto, planId);
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
      let idauto = Number(change.idauto);
      let numero = Number(change.numero);
      const pago = change.pago === true || change.pago === 1 || change.pago === '1' ? 1 : 0;
      const requestedPlanId = canonicalPlanId(change.plan_id);
      let officialCarId = change.idauto_oficial ? Number(change.idauto_oficial) : null;
      if (!idcampeonato || !idpiloto || !requestedPlanId) {
        const error = new Error('Campeonato, piloto y plan de inscripción son requeridos');
        error.statusCode = 400;
        throw error;
      }

      const [[registration]] = await connection.query(
        `SELECT c.idcategoria AS campeonato_categoria, i.idauto_oficial,
                i.numero AS numero_actual
         FROM inscriptos i
         JOIN campeonatos c ON c.id = i.idcampeonato
         WHERE i.idcampeonato = ? AND i.idpiloto = ?`,
        [idcampeonato, idpiloto]
      );
      if (!registration) {
        const error = new Error('Inscripción no encontrada');
        error.statusCode = 404;
        throw error;
      }

      const [[config]] = await connection.query(
        `SELECT precio, precio_diseno, precio_pintura_oficial, autos_habilitados, planes,
                permite_personalizado, permite_diseno_liga, permite_pintura_oficial, permite_extra
         FROM inscripciones_config WHERE idcampeonato = ? FOR UPDATE`,
        [idcampeonato]
      );
      if (!config) {
        const error = new Error('El campeonato no tiene un formulario de inscripción configurado');
        error.statusCode = 409;
        throw error;
      }
      const selectedPlan = normalizeConfigPlans(config)
        .find(plan => plan.id === requestedPlanId && plan.habilitado);
      if (!selectedPlan) {
        const error = new Error('El plan seleccionado no está habilitado en este formulario');
        error.statusCode = 400;
        throw error;
      }

      if (requestedPlanId === 'diseno_oficial') {
        if (!Number.isInteger(officialCarId) || officialCarId < 1) {
          const error = new Error('Seleccioná una pintura oficial');
          error.statusCode = 400;
          throw error;
        }
        const [[officialCar]] = await connection.query(
          `SELECT idauto, numero FROM inscripciones_autos_oficiales
           WHERE id = ? AND idcampeonato = ? FOR UPDATE`,
          [officialCarId, idcampeonato]
        );
        if (!officialCar) {
          const error = new Error('La pintura oficial seleccionada no existe en este campeonato');
          error.statusCode = 404;
          throw error;
        }
        idauto = Number(officialCar.idauto);
        numero = Number(officialCar.numero);
      } else {
        officialCarId = null;
        if (requestedPlanId === 'extra') numero = 0;
      }

      if (!idauto) {
        const error = new Error('Seleccioná un modelo habilitado');
        error.statusCode = 400;
        throw error;
      }
      if (!Number.isInteger(numero) || numero < 0 || numero > 255 || (requestedPlanId !== 'extra' && numero === 0)) {
        const error = new Error('El número debe ser un entero entre 1 y 255');
        error.statusCode = 400;
        throw error;
      }

      const enabledCars = parseIds(config.autos_habilitados);
      if (!enabledCars.includes(idauto)) {
        const error = new Error('El auto seleccionado no está habilitado en este formulario');
        error.statusCode = 409;
        throw error;
      }
      const [[car]] = await connection.query('SELECT idcategoria FROM autos WHERE id = ?', [idauto]);
      if (!car || Number(registration.campeonato_categoria) !== Number(car.idcategoria)) {
        const error = new Error('El auto no pertenece a la categoría del campeonato');
        error.statusCode = 400;
        throw error;
      }

      if (numero !== 0) {
        const [[duplicateNumber]] = await connection.query(
          `SELECT idpiloto FROM inscriptos
           WHERE idcampeonato = ? AND numero = ? AND idpiloto <> ?
           LIMIT 1`,
          [idcampeonato, numero, idpiloto]
        );
        if (duplicateNumber) {
          const error = new Error(`El número ${numero} ya está utilizado en este campeonato`);
          error.statusCode = 409;
          throw error;
        }
        if (requestedPlanId === 'diseno_oficial') {
          const [[officialUse]] = await connection.query(
            `SELECT idpiloto FROM inscriptos
             WHERE idcampeonato = ? AND idauto_oficial = ? AND idpiloto <> ? LIMIT 1`,
            [idcampeonato, officialCarId, idpiloto]
          );
          if (officialUse) {
            const error = new Error('La pintura oficial seleccionada ya está ocupada');
            error.statusCode = 409;
            throw error;
          }
        } else {
          const [[officialNumber]] = await connection.query(
            'SELECT id FROM inscripciones_autos_oficiales WHERE idcampeonato = ? AND numero = ? LIMIT 1',
            [idcampeonato, numero],
          );
          if (officialNumber) {
            const error = new Error(`El número ${numero} está reservado para una pintura oficial`);
            error.statusCode = 409;
            throw error;
          }
        }
      }

      if (pago) await assertPaymentCapacity(connection, idcampeonato, idpiloto, idauto, requestedPlanId);

      const registrationPrice = Number(config.precio || 0) + Number(selectedPlan.precio_adicional || 0);

      await connection.query(
        `UPDATE inscriptos
         SET idauto = ?, numero = ?, pago = ?, tipo_inscripcion = ?,
             idauto_oficial = ?, precio_inscripcion = ?
         WHERE idcampeonato = ? AND idpiloto = ?`,
        [idauto, numero, pago, requestedPlanId, officialCarId, registrationPrice, idcampeonato, idpiloto]
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
        [idcampeonato, idpiloto, planModality(requestedPlanId), requestedPlanId,
          selectedPlan.titulo, registrationPrice]
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
  const connection = await pool.getConnection();
  try {
    const { idcampeonato, idpiloto } = req.params;
    await connection.beginTransaction();
    const [result] = await connection.query(
      'DELETE FROM inscriptos WHERE idcampeonato=? AND idpiloto=?',
      [idcampeonato, idpiloto]
    );
    if (!result.affectedRows) {
      await connection.rollback();
      return res.status(404).json({ error: 'Inscripción no encontrada' });
    }
    await connection.query(
      'DELETE FROM inscripciones_detalle WHERE idcampeonato=? AND idpiloto=?',
      [idcampeonato, idpiloto]
    );
    await connection.commit();
    res.json({ message: 'Inscripción eliminada' });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
};

module.exports = { getAll, create, updatePayment, updateBulk, remove };
