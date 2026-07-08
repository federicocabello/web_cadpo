require('dotenv').config();
const express = require('express');
const cors = require('cors');

const eventsRouter = require('./routes/events');
const championshipsRouter = require('./routes/championships');
const registrationsRouter = require('./routes/registrations');
const driversRouter = require('./routes/drivers');
const carsRouter = require('./routes/cars');
const circuitsRouter = require('./routes/circuits');
const resultsRouter = require('./routes/results');
const mediaRouter = require('./routes/media');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'CADPO API corriendo', timestamp: new Date().toISOString() });
});

app.use('/api/events', eventsRouter);
app.use('/api/championships', championshipsRouter);
app.use('/api/registrations', registrationsRouter);
app.use('/api/drivers', driversRouter);
app.use('/api/cars', carsRouter);
app.use('/api/circuits', circuitsRouter);
app.use('/api/results', resultsRouter);
app.use('/api/media', mediaRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  console.log(`API disponible en http://localhost:${PORT}/api`);
});

module.exports = app;
