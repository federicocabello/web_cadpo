const express = require('express');
const router = express.Router();
const circuitsController = require('../controllers/circuitsController');
const uploadCircuitImage = require('../middleware/uploadCircuitImage');
const requireAdmin = require('../middleware/requireAdmin');

router.get('/', circuitsController.getAll);
router.get('/:id', circuitsController.getById);
router.post('/:id/notas', requireAdmin, uploadCircuitImage.array('notas', 20), circuitsController.createNote);
router.put('/:id/notas/orden', requireAdmin, circuitsController.reorderNotes);
router.post('/:id/notas/reutilizar', requireAdmin, circuitsController.reuseNotes);
router.put('/:id/notas/:noteId', requireAdmin, uploadCircuitImage.array('notas', 20), circuitsController.updateNote);
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
router.delete('/:id/notas/:noteId/imagenes/:imageId', requireAdmin, circuitsController.removeNoteImage);
router.delete('/:id/notas/:noteId', requireAdmin, circuitsController.removeNote);
router.delete('/:id', circuitsController.remove);

module.exports = router;
