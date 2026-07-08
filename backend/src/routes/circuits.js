const express = require('express');
const router = express.Router();
const circuitsController = require('../controllers/circuitsController');

router.get('/', circuitsController.getAll);
router.get('/:id', circuitsController.getById);
router.post('/', circuitsController.create);
router.put('/:id', circuitsController.update);
router.delete('/:id', circuitsController.remove);

module.exports = router;
