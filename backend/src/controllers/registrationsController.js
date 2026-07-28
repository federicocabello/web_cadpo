const pool = require('../config/db');

// ── GET /api/inscriptos?idcampeonato=X ────────────────────────────────────────
const getAll = async (req, res, next) => {
  try {
    const { idcampeonato } = req.query;
    let query = `
      SELECT i.numero, i.pago, i.idcampeonato,
             p.id AS idpiloto, p.nombre, p.localidad, p.telefono,
             a.id AS idauto, am.marca, a.modelo, am.logo AS auto_logo,
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
    if (!Number.isInteger(numericNumber) || numericNumber < 0 || numericNumber > 999) {
      return res.status(400).json({ error: 'El número debe ser un entero entre 0 y 999' });
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

module.exports = { getAll, create, updatePayment, remove };
