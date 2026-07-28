const express = require('express');
const router = express.Router();
const carsController = require('../controllers/carsController');
const uploadCarMedia = require('../middleware/uploadCarMedia');

router.get('/', carsController.getAll);
router.get('/:id', carsController.getById);
router.post(
  '/',
  uploadCarMedia.fields([
    { name: 'imagen', maxCount: 1 },
  ]),
  carsController.create
);
router.put(
  '/:id',
  uploadCarMedia.fields([
    { name: 'imagen', maxCount: 1 },
  ]),
  carsController.update
);
router.delete('/:id', carsController.remove);

module.exports = router;
