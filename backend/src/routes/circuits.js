const express = require('express');
const router = express.Router();
const circuitsController = require('../controllers/circuitsController');
const uploadCircuitImage = require('../middleware/uploadCircuitImage');

router.get('/', circuitsController.getAll);
router.get('/geography', circuitsController.getGeography);
router.get('/:id', circuitsController.getById);
router.post(
  '/',
  uploadCircuitImage.fields([
    { name: 'imagen', maxCount: 1 },
    { name: 'trazado', maxCount: 1 },
  ]),
  circuitsController.create
);
router.put(
  '/:id',
  uploadCircuitImage.fields([
    { name: 'imagen', maxCount: 1 },
    { name: 'trazado', maxCount: 1 },
  ]),
  circuitsController.update
);
router.delete('/:id', circuitsController.remove);

module.exports = router;
