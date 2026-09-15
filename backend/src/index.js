const path = require('path');
const fs = require('fs');
const envPath = path.resolve(__dirname, '../.env');
require('dotenv').config({
  path: envPath,
  quiet: true,
});
const express = require('express');
const cors = require('cors');
const pool = require('./config/db');

const eventsRouter = require('./routes/events');
const championshipsRouter = require('./routes/championships');
const registrationsRouter = require('./routes/registrations');
const driversRouter = require('./routes/drivers');
const carsRouter = require('./routes/cars');
const carBrandsRouter = require('./routes/carBrands');
const categoriesRouter = require('./routes/categories');
const circuitsRouter = require('./routes/circuits');
const resultsRouter = require('./routes/results');
const mediaRouter = require('./routes/media');
const authRouter = require('./routes/auth');
const liveTimingRouter = require('./routes/liveTiming');
const monitorRouter = require('./routes/monitor');
const registrationFormsRouter = require('./routes/registrationForms');
const statisticsRouter = require('./routes/statistics');
const liveTimingMonitor = require('./services/liveTimingMonitor');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', async (req, res) => {
  try {
    const database = await pool.checkDatabase();

    res.json({
      status: 'ok',
      available: true,
      message: 'CADPO API corriendo',
      database,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({
      status: 'maintenance',
      available: false,
      message: 'El sitio esta en mantenimiento y no disponible',
      database: {
        connected: false,
        database: process.env.DB_NAME || 'web_cadpo',
        error: err.message,
      },
      timestamp: new Date().toISOString(),
    });
  }
});

app.use('/api/events', eventsRouter);
app.use('/api/championships', championshipsRouter);
app.use('/api/registrations', registrationsRouter);
app.use('/api/drivers', driversRouter);
app.use('/api/cars', carsRouter);
app.use('/api/car-brands', carBrandsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/circuits', circuitsRouter);
app.use('/api/results', resultsRouter);
app.use('/api/media', mediaRouter);
app.use('/api/auth', authRouter);
app.use('/api/live-timing', liveTimingRouter);
app.use('/api/monitor', monitorRouter);
app.use('/api/registration-forms', registrationFormsRouter);
app.use('/api/statistics', statisticsRouter);

// Servir el frontend desde Hostinger, desde el paquete de producción o desde Vite local.
const hostingerPublicPath = path.join(__dirname, '../../public_html');
const bundledPublicPath = path.join(__dirname, '../public');
const localDistPath = path.join(__dirname, '../../frontend/dist');
const staticPaths = [hostingerPublicPath, bundledPublicPath, localDistPath]
  .filter((candidate, index, paths) => fs.existsSync(candidate) && paths.indexOf(candidate) === index);
const indexPath = staticPaths
  .map(candidate => path.join(candidate, 'index.html'))
  .find(candidate => fs.existsSync(candidate));

staticPaths.forEach(staticPath => app.use(express.static(staticPath)));

if (indexPath) {
  // Middleware para fallback de SPA compatible con Express v5
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(indexPath);
    }
    next();
  });
}

app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  console.log(`API disponible en http://localhost:${PORT}/api`);
});

liveTimingMonitor.start();

module.exports = app;
