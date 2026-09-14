const { isValidSession } = require('../utils/adminSessions');

module.exports = (req, res, next) => {
  const authorization = req.get('authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!isValidSession(token)) return res.status(401).json({ error: 'Sesion administrativa invalida o vencida' });
  next();
};
