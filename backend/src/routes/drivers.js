const express = require('express');
const router = express.Router();
const driversController = require('../controllers/driversController');

// GET /api/drivers — obtener todos los pilotos
router.get('/', driversController.getAll);

// GET /api/drivers/:id — obtener piloto por ID
router.get('/:id', driversController.getById);

// POST /api/drivers — registrar nuevo piloto
router.post('/', driversController.create);

// PUT /api/drivers/:id — actualizar datos del piloto
router.put('/:id', driversController.update);

// DELETE /api/drivers/:id — eliminar piloto
router.delete('/:id', driversController.remove);

module.exports = router;
