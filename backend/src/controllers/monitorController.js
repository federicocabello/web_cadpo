const monitor = require('../services/liveTimingMonitor');

const getStatus = async (req, res, next) => {
  try {
    res.json({ data: await monitor.getStatus() });
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    if (typeof req.body.enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled debe ser verdadero o falso' });
    }
    await monitor.setEnabled(req.body.enabled);
    if (req.body.enabled) monitor.runCheck();
    res.json({ message: req.body.enabled ? 'Monitoreo activado' : 'Monitoreo desactivado', data: await monitor.getStatus() });
  } catch (error) {
    next(error);
  }
};

const sendTest = async (req, res, next) => {
  try {
    await monitor.sendTestEmail();
    res.json({ message: 'Correo de prueba enviado correctamente' });
  } catch (error) {
    error.statusCode = 502;
    next(error);
  }
};

module.exports = { getStatus, sendTest, update };
