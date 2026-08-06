const express = require('express');
const router = express.Router();
const resultsController = require('../controllers/resultsController');

router.get('/', resultsController.getAll);
router.get('/:id', resultsController.getById);
router.post('/', resultsController.create);
router.post('/bulk', resultsController.saveBulk);
router.put('/:id', resultsController.update);
router.delete('/:id', resultsController.remove);

module.exports = router;
