const pool = require('../config/db');

// ── GET /api/inscriptos?idcampeonato=X ────────────────────────────────────────
const getAll = async (req, res, next) => {
  try {
    const { idcampeonato } = req.query;
    let query = `
      SELECT i.numero, i.pago, i.idcampeonato,
             p.id AS idpiloto, p.nombre, p.localidad, p.telefono,
             a.id AS idauto, a.marca, a.modelo, a.logo AS auto_logo
      FROM inscriptos i
      JOIN pilotos p ON i.idpiloto = p.id
      JOIN autos a   ON i.idauto   = a.id
    `;
    const params = [];
    if (idcampeonato) {
      query += ' WHERE i.idcampeonato = ?';
      params.push(idcampeonato);
    }
    query += ' ORDER BY i.numero ASC';
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
    if (!idcampeonato || !idpiloto || !idauto || !numero) {
      return res.status(400).json({ error: 'idcampeonato, idpiloto, idauto y numero son requeridos' });
    }
    await pool.query(
      'INSERT INTO inscriptos (idcampeonato, idpiloto, idauto, numero, pago) VALUES (?, ?, ?, ?, ?)',
      [idcampeonato, idpiloto, idauto, numero, pago || 0]
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
