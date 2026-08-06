const pool = require('../config/db');

// ── GET /api/inscriptos?idcampeonato=X ────────────────────────────────────────
const getAll = async (req, res, next) => {
  try {
    const { idcampeonato } = req.query;
    let query = `
      SELECT i.numero, i.pago, i.idcampeonato,
             p.id AS idpiloto, p.nombre, p.localidad, p.telefono,
             a.id AS idauto, am.id AS idmarca, am.marca, a.modelo, am.logo AS auto_logo,
             c.temporada, c.anio, c.idcategoria, cat.categoria
      FROM inscriptos i
      JOIN pilotos p ON i.idpiloto = p.id
      JOIN autos a   ON i.idauto   = a.id
      JOIN autos_marcas am ON a.marca = am.id
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
    if (!Number.isInteger(numericNumber) || numericNumber < 0 || numericNumber > 200) {
      return res.status(400).json({ error: 'El número debe ser un entero entre 0 y 200' });
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
  try {
    const { idcampeonato, idpiloto } = req.params;
    const { pago } = req.body;
    const [result] = await pool.query(
      'UPDATE inscriptos SET pago=? WHERE idcampeonato=? AND idpiloto=?',
      [pago ? 1 : 0, idcampeonato, idpiloto]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Inscripción no encontrada' });
    res.json({ message: 'Estado de pago actualizado', pago: pago ? 1 : 0 });
  } catch (err) {
    next(err);
  }
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
      if (!Number.isInteger(numero) || numero < 0 || numero > 200) {
        const error = new Error('El número debe ser un entero entre 0 y 200');
        error.statusCode = 400;
        throw error;
      }

      const [[registration]] = await connection.query(
        `SELECT c.idcategoria AS campeonato_categoria, a.idcategoria AS auto_categoria
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
      }

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
