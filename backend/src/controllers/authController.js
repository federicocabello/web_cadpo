const pool = require('../config/db');

const adminLogin = async (req, res, next) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'La contraseña es requerida' });
    }

    const [[row]] = await pool.query('SELECT admin FROM auth LIMIT 1');

    if (!row?.admin || String(row.admin) !== String(password)) {
      return res.status(401).json({ error: 'Contraseña incorrecta' });
    }

    res.json({ ok: true, message: 'Administrador validado' });
  } catch (err) {
    next(err);
  }
};

module.exports = { adminLogin };
